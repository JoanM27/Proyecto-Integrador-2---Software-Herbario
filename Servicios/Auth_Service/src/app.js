import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { hashPassword, verifyPassword } from '../../shared/crypto/password.js';
import { SignJWT } from 'jose';
import { initKeys, getKid, getAlg } from './keys.js';
import { supabase } from './supabase.js';
import createLogger from '../../shared/logger/index.js';

dotenv.config();

// Crear logger
const logger = createLogger('Auth_Service', {
  logLevel: process.env.LOG_LEVEL || 'info'
});

const app = express();

// Guardar logger en app
app.set('logger', logger);

// Middleware de logging
app.use(logger.expressMiddleware());

app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));
app.use(cors());
app.use(helmet());

// Configurar charset UTF-8 para todas las respuestas
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Registro

/**
 * POST /auth/register
 * Registra un nuevo usuario en el sistema
 * @param {Object} req.body - Datos del usuario
 * @param {string} req.body.email - Email del usuario
 * @param {string} req.body.password - Contraseña del usuario
 * @param {string} req.body.nombres - Nombres del usuario
 * @param {string} req.body.apellidos - Apellidos del usuario
 * @param {string} [req.body.rol=consulta] - Rol del usuario
 * @param {number} [req.body.herbario_id] - ID del herbario
 * @returns {Object} Confirmación de registro exitoso
 */
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, nombres, apellidos, rol = 'consulta', herbario_id } = req.body;
    
    if (!email || !password) {
      logger.warn('Intento de registro sin credenciales completas', { email });
      return res.status(400).json({ error: 'email y password requeridos' });
    }
    
    if (!nombres || !apellidos) {
      logger.warn('Intento de registro sin nombres completos', { email });
      return res.status(400).json({ error: 'nombres y apellidos requeridos' });
    }

    logger.info('Intentando registrar usuario', { email, rol });

    // Registrar en auth.users
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      if (error.message.includes('already registered')) {
        logger.warn('Usuario ya existe', { email });
        return res.status(409).json({ error: 'Usuario ya existe' });
      }
      logger.error('Error en Supabase durante registro', {
        email,
        error: error.message
      });
      return res.status(400).json({ error: error.message });
    }

    logger.info('Usuario registrado exitosamente', { 
      email, 
      rol,
      userId: data.user.id 
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    logger.error('Error crítico en registro', {
      error: e.message,
      stack: e.stack
    });
    res.status(500).json({ error: 'error registrando usuario' });
  }
});

// Login -> emite JWT
await initKeys();

/**
 * POST /auth/login
 * Autentica un usuario y emite un token JWT
 * @param {Object} req.body - Credenciales del usuario
 * @param {string} req.body.email - Email del usuario
 * @param {string} req.body.password - Contraseña del usuario
 * @returns {Object} Token de acceso y información del usuario
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      logger.warn('Intento de login sin credenciales', { email });
      return res.status(400).json({ error: 'email y password requeridos' });
    }

    logger.info('Intento de login', { email });

    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      logger.warn('Login fallido', { 
        email, 
        error: error.message 
      });
      return res.status(401).json({ error: 'credenciales inválidas' });
    }

    // Cerrar sesión del usuario para las siguientes consultas
    await supabase.auth.signOut();
    
    // Obtener información del usuario desde info_usuario
    const { data: infoUsuario, error: infoError } = await supabase
      .from('info_usuario')
      .select('*')
      .eq('id_user', data.user.id)
      .single();

    let userRole = 'consulta';
    let userName = data.user.email;
    let herbarioData = null;

    if (infoUsuario && !infoError) {
      // Datos desde info_usuario
      userRole = infoUsuario.rol || 'consulta';
      userName = infoUsuario.nombre_completo || data.user.email;
      
      // Obtener datos del herbario si existe id_herbario
      if (infoUsuario.id_herbario) {
        const { data: herbario, error: herbarioError } = await supabase
          .from('herbario')
          .select('id, nombre, codigo_postal')
          .eq('id', infoUsuario.id_herbario)
          .single();
        
        if (!herbarioError && herbario) {
          herbarioData = herbario;
        }
      }
      
      logger.info('Usuario encontrado en info_usuario', {
        userId: data.user.id,
        rol: userRole,
        nombre: userName,
        herbario: herbarioData?.nombre || 'sin herbario'
      });
    } else {
      // Fallback: usar metadatos si existe
      if (data.user.user_metadata) {
        userRole = data.user.user_metadata.rol || userRole;
        userName = data.user.user_metadata.nombres || userName;
      }
      
      logger.warn('Usuario no encontrado en info_usuario, usando fallback', {
        userId: data.user.id,
        email: email
      });
    }

    const { alg } = await initKeys();
    const pk = (await initKeys()).privateKey;
    const claims = {
      sub: data.user.id,
      email: data.user.email,
      role: userRole,
      herbario_id: herbarioData?.id || null
    };

    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg, kid: getKid() })
      .setIssuer('ideam')
      .setAudience('ideam-services')
      .setExpirationTime('15m')
      .sign(pk);

    logger.info('Login exitoso', { 
      email: data.user.email,
      userId: data.user.id,
      rol: userRole 
    });

    res.json({ 
      access_token: token, 
      token_type: 'Bearer', 
      expires_in: 900,
      user: {
        id: data.user.id,
        email: data.user.email,
        nombre: userName,
        rol: userRole,
        herbario: herbarioData?.nombre || null,
        herbario_id: herbarioData?.id || null
      }
    });
  } catch (e) {
    logger.error('Error crítico en login', {
      error: e.message,
      stack: e.stack
    });
    res.status(500).json({ error: 'error autenticando' });
  }
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Validar contraseña (para firma de clasificación)

/**
 * POST /validate-password
 * Valida las credenciales de un usuario sin emitir token (para firma de clasificaciones)
 * @param {Object} req.body - Credenciales del usuario
 * @param {string} req.body.email - Email del usuario
 * @param {string} req.body.password - Contraseña del usuario
 * @returns {Object} Confirmación de validación exitosa
 */
app.post('/validate-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn('Intento de validación sin credenciales completas');
      return res.status(400).json({ error: 'email y password requeridos' });
    }

    logger.info('Validando contraseña para usuario', { email });

    // Validar contraseña con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.warn('Contraseña incorrecta', { email });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    logger.info('Contraseña validada exitosamente', { email });
    res.json({ valid: true, message: 'Contraseña correcta' });

  } catch (e) {
    logger.error('Error validando contraseña', {
      error: e.message,
      stack: e.stack
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// JWKS endpoint
app.get('/.well-known/jwks.json', async (req, res) => {
  try {
    const { jwk } = await initKeys();
    res.json({ keys: [{ kid: getKid(), alg: getAlg(), use: 'sig', kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, n: jwk.n, e: jwk.e }] });
  } catch (e) {
    res.status(500).json({ error: 'jwks error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  logger.info(`Auth_Service iniciado`, { 
    port, 
    logLevel: logger.logLevel,
    nodeVersion: process.version
  });
});
