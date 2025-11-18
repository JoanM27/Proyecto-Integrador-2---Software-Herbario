import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './middleware/auth.js';
import { initJwtFromEnv } from '../../shared/crypto/jwt.js';
import proxy from 'express-http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Logger
let logger;
try {
  const { createLogger } = await import('../../shared/logger/index.js');
  logger = createLogger('Api_Gateway');
  logger.info('Logger inicializado correctamente');
} catch (error) {
  console.warn('⚠️  Logger no disponible, usando console:', error.message);
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log,
    middleware: (req, res, next) => next()
  };
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(logger.expressMiddleware());

// Rate limiting básico
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Healthcheck público
app.get('/health', (req, res) => {
  logger.debug('Health check solicitado');
  res.json({ ok: true });
});

// Ejemplo de proxy/ruta protegida (placeholder)
app.get('/secure/ping', requireAuth, (req, res) => {
  res.json({ ok: true, service: 'api-gateway' });
});

// Utilidad simple para autorización por roles
function requireRole(role) {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (userRole !== role) {
        return res.status(403).json({ error: `Role required: ${role}. Current role: ${userRole}` });
      }
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Role validation failed' });
    }
  };
}

// URLs de microservicios
const LAB_URL = process.env.LAB_SERVICE_URL || 'http://localhost:3005';
const RECEPCION_URL = process.env.RECEPCION_SERVICE_URL || 'http://localhost:3004';
const GESTION_HERBARIO_URL = process.env.GESTION_HERBARIO_URL || 'http://localhost:3002';

// ===== RUTAS DE LABORATORIO (solo laboratoristas) =====
app.use('/laboratorio/muestras', requireAuth, requireRole('laboratorista'), proxy(LAB_URL, {
  proxyReqPathResolver: (req) => `/muestras${req.url}`
}));

app.use('/laboratorio/clasificaciones', requireAuth, requireRole('laboratorista'), proxy(LAB_URL, {
  proxyReqPathResolver: (req) => `/clasificaciones${req.url}`
}));

app.use('/laboratorio/asistente', requireAuth, requireRole('laboratorista'), proxy(LAB_URL, {
  proxyReqPathResolver: (req) => `/asistente${req.url}`
}));

app.use('/laboratorio/estadisticas', requireAuth, requireRole('laboratorista'), proxy(LAB_URL, {
  proxyReqPathResolver: (req) => `/estadisticas${req.url}`
}));

// ===== RUTAS DE RECEPCIÓN (solo recepcionistas) =====
app.use('/recepcion/paquetes', requireAuth, requireRole('recepcionista'), proxy(RECEPCION_URL, {
  proxyReqPathResolver: (req) => `/paquetes${req.url}`
}));

app.use('/recepcion/conglomerados', requireAuth, requireRole('recepcionista'), proxy(RECEPCION_URL, {
  proxyReqPathResolver: (req) => `/conglomerados${req.url}`
}));

// ===== RUTAS DE GESTIÓN HERBARIO (acceso directo limitado - principalmente para servicios internos) =====
// Solo operaciones de consulta para usuarios finales
app.use('/herbario/taxonomia', requireAuth, proxy(GESTION_HERBARIO_URL, {
  proxyReqPathResolver: (req) => `/taxonomia${req.url}`,
  filter: (req) => req.method === 'GET' // Solo lectura
}));

app.use('/herbario/herbarios', requireAuth, proxy(GESTION_HERBARIO_URL, {
  proxyReqPathResolver: (req) => `/herbarios${req.url}`,
  filter: (req) => req.method === 'GET' // Solo lectura
}));

app.use('/herbario/ubicaciones', requireAuth, proxy(GESTION_HERBARIO_URL, {
  proxyReqPathResolver: (req) => `/ubicaciones${req.url}`,
  filter: (req) => req.method === 'GET' // Solo lectura
}));

// ===== RUTAS DE CONSULTA PÚBLICA (sin autenticación) =====
// Estadísticas generales para público
app.use('/publico/estadisticas', proxy(GESTION_HERBARIO_URL, {
  proxyReqPathResolver: (req) => `/estadisticas/resumen${req.url}`,
  filter: (req) => req.method === 'GET'
}));

// Búsqueda taxonómica pública
app.use('/publico/taxonomia', proxy(GESTION_HERBARIO_URL, {
  proxyReqPathResolver: (req) => `/taxonomia/buscar${req.url}`,
  filter: (req) => req.method === 'GET'
}));

// ===== RUTAS DE SALUD DE SERVICIOS =====
app.get('/health/all', async (req, res) => {
  try {
    const servicios = [
      { nombre: 'Lab_Service', url: LAB_URL },
      { nombre: 'Recepcion_Service', url: RECEPCION_URL },
      { nombre: 'Gestion_Herbario', url: GESTION_HERBARIO_URL }
    ];

    const estadoServicios = await Promise.allSettled(
      servicios.map(async servicio => {
        try {
          const response = await fetch(`${servicio.url}/health`);
          const data = await response.json();
          return {
            servicio: servicio.nombre,
            estado: response.ok ? 'activo' : 'error',
            url: servicio.url,
            respuesta: data
          };
        } catch (error) {
          return {
            servicio: servicio.nombre,
            estado: 'inactivo',
            url: servicio.url,
            error: error.message
          };
        }
      })
    );

    const resultados = estadoServicios.map(result => 
      result.status === 'fulfilled' ? result.value : {
        servicio: 'error',
        estado: 'error',
        error: result.reason
      }
    );

    const todosActivos = resultados.every(r => r.estado === 'activo');

    logger.info('Health check de todos los servicios', { 
      todosActivos, 
      serviciosActivos: resultados.filter(r => r.estado === 'activo').length,
      serviciosTotal: resultados.length
    });

    res.status(todosActivos ? 200 : 503).json({
      estado_general: todosActivos ? 'saludable' : 'degradado',
      servicios: resultados,
      fecha_verificacion: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error verificando estado de servicios', { error: error.message });
    res.status(500).json({ 
      error: 'Error verificando estado de servicios',
      detalles: error.message 
    });
  }
});

const port = process.env.PORT || 3000;

// Inicializar JWT antes de empezar el servidor
async function startServer() {
  try {
    await initJwtFromEnv();
    logger.info('JWT inicializado correctamente');
    app.listen(port, () => {
      logger.info(`API Gateway ejecutándose en puerto ${port}`, { url: `http://localhost:${port}` });
    });
  } catch (error) {
    logger.error('Error inicializando JWT', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();
