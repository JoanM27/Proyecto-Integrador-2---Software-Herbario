import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validatePaqueteDTO, createPaqueteInsert, validateActualizarEstadoDTO, createActualizarEstadoUpdate } from './dto.js';
import { HerbarioService } from './herbarioService.js';
import { externalApiClient } from './externalApiClient.js';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Logger
let logger;
try {
  const { createLogger } = await import('../../shared/logger/index.js');
  logger = createLogger('Recepcion_service');
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
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));
app.use(cors());
app.use(helmet());

// Configurar charset UTF-8 para todas las respuestas
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(logger.expressMiddleware());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Health
app.get('/health', (req, res) => {
  logger.debug('Health check solicitado');
  res.json({ ok: true });
});

// ==================== NUEVOS ENDPOINTS PARA INTEGRACIÓN CON SERVICIO EXTERNO ====================

/**
 * GET /paquetes/buscar/:numeroPaquete
 * Busca un paquete en el servicio externo por número de paquete
 * @param {string} numeroPaquete - Número del paquete a buscar
 * @returns {Object} Información del paquete encontrado o mensaje de no encontrado
 */
app.get('/paquetes/buscar/:numeroPaquete', async (req, res) => {
  try {
    const { numeroPaquete } = req.params;
    
    if (!numeroPaquete) {
      return res.status(400).json({ error: 'Número de paquete requerido' });
    }

    logger.info(`Buscando paquete ${numeroPaquete} - Verificando primero en BD local`);

    // 1. PRIMERO: Verificar si el paquete ya existe en la base de datos local
    const { data: paqueteExistente, error: errorBusqueda } = await supabase
      .from('paquete')
      .select('id, num_paquete, estado, fecha_recibido_herbario, observaciones_generales, cantidad_ejemplares, id_conglomerado')
      .eq('num_paquete', String(numeroPaquete))
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorBusqueda) {
      logger.error('Error verificando paquete en BD local', { error: errorBusqueda.message });
    }

    // Si el paquete YA EXISTE en la BD local, informar y NO buscar en servicio externo
    if (paqueteExistente) {
      logger.info(`Paquete ${numeroPaquete} encontrado en BD local con estado: ${paqueteExistente.estado}`);
      return res.json({
        encontrado: true,
        yaRecibido: true,
        mensaje: `Este paquete ya fue recibido el ${paqueteExistente.fecha_recibido_herbario}. No se puede procesar nuevamente.`,
        paquete: paqueteExistente
      });
    }

    // 2. SOLO SI NO EXISTE EN BD LOCAL: Buscar en servicio externo
    logger.info(`Paquete ${numeroPaquete} NO encontrado en BD local, buscando en servicio externo`);
    
    const conectado = await externalApiClient.verificarConexion();
    if (!conectado) {
      return res.status(503).json({ 
        error: 'Servicio externo no disponible',
        detalles: 'No se puede conectar con el servicio de datos de campo'
      });
    }

    // Obtener datos completos del paquete desde servicio externo
    const resultado = await externalApiClient.obtenerDatosCompletosParaRecepcion(parseInt(numeroPaquete));
    
    if (!resultado.encontrado) {
      return res.status(404).json({ 
        encontrado: false,
        mensaje: 'Paquete no encontrado en el servicio externo',
        sugerencia: 'Puede registrar los datos manualmente'
      });
    }

    // Devolver datos encontrados
    res.json({
      encontrado: true,
      yaRecibido: false,
      mensaje: resultado.mensaje,
      datos: resultado.datos
    });

  } catch (error) {
    logger.error('Error buscando paquete en servicio externo', { error: error.message });
    res.status(500).json({ 
      error: 'Error al buscar paquete',
      detalles: error.message 
    });
  }
});

/**
 * PUT /paquetes/confirmar-recepcion
 * Confirma la recepción de un paquete encontrado en el servicio externo
 * @param {Object} req.body - Datos para confirmar recepción
 * @param {string} req.body.num_paquete - Número del paquete
 * @param {string} [req.body.observaciones_recepcion] - Observaciones de recepción
 * @param {number} req.body.id_conglomerado - ID del conglomerado
 * @param {Array} req.body.muestras - Datos de las muestras
 * @returns {Object} Confirmación de recepción exitosa
 */
app.put('/paquetes/confirmar-recepcion', async (req, res) => {
  try {
    const {
      num_paquete,
      observaciones_recepcion,
      id_conglomerado,
      muestras // Datos ya obtenidos del servicio externo
    } = req.body;

    if (!num_paquete || !id_conglomerado || !muestras) {
      return res.status(400).json({ error: 'Datos incompletos para confirmar recepción' });
    }

    logger.info(`Confirmando recepción de paquete ${num_paquete}`);

    // VERIFICAR SI EL PAQUETE YA EXISTE ANTES DE CREARLO
    const { data: paqueteExistente, error: errorVerificacion } = await supabase
      .from('paquete')
      .select('id, num_paquete, estado, fecha_recibido_herbario')
      .eq('num_paquete', String(num_paquete))
      .maybeSingle();

    if (errorVerificacion) {
      logger.error('Error verificando paquete existente', { error: errorVerificacion.message });
      return res.status(500).json({ error: 'Error verificando paquete', detalle: errorVerificacion.message });
    }

    if (paqueteExistente) {
      logger.warn(`Paquete ${num_paquete} ya existe con ID ${paqueteExistente.id}`);
      return res.status(409).json({ 
        error: 'Paquete duplicado', 
        mensaje: `El paquete ${num_paquete} ya fue recibido el ${paqueteExistente.fecha_recibido_herbario}`,
        paquete_id: paqueteExistente.id
      });
    }

    // Preparar datos para inserción
    const paqueteData = {
      id_conglomerado,
      num_paquete,
      cantidad_ejemplares: muestras.length,
      fecha_envio: req.body.fecha_envio || null,
      fecha_recibido_herbario: new Date().toISOString().split('T')[0], // HOY
      observaciones_generales: observaciones_recepcion || null,
      estado: 'recibido', // ESTADO CONFIRMADO
      muestras: muestras
    };

    // Validar datos
    const validation = validatePaqueteDTO(paqueteData);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Datos inválidos', details: validation.errors });
    }

    // Crear paquete y muestras
    const { paquete, muestras: muestrasProcessed } = createPaqueteInsert(paqueteData);
    
    // Sincronizar conglomerado antes de crear el paquete
    // Si el conglomerado no existe en nuestra BD, lo obtiene del servicio externo y lo crea
    logger.info(`Verificando/sincronizando conglomerado ${id_conglomerado}`);
    const syncResult = await HerbarioService.sincronizarConglomerado(id_conglomerado);
    if (!syncResult.success) {
      logger.error('Error sincronizando conglomerado', { error: syncResult.error });
      return res.status(500).json({ 
        error: 'Error sincronizando conglomerado', 
        detalle: syncResult.error 
      });
    }

    // ===== CÓDIGO ORIGINAL (ANTES DE TRIGGERS) =====
    // const paqueteResult = await HerbarioService.crearPaquete(paquete);
    // if (!paqueteResult.success) {
    //   return res.status(500).json({ error: paqueteResult.error });
    // }
    // 
    // const muestrasConPaquete = muestrasProcessed.map(muestra => ({
    //   ...muestra,
    //   id_paquete: paqueteResult.data.id
    // }));
    // 
    // const muestrasResult = await HerbarioService.crearMuestras(muestrasConPaquete);
    // if (!muestrasResult.success) {
    //   return res.status(500).json({ error: muestrasResult.error });
    // }
    // ===== FIN CÓDIGO ORIGINAL =====

    // CREAR PAQUETE Y MUESTRAS CON FUNCIÓN RPC (atomicidad garantizada)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('crear_paquete_con_muestras', {
      p_paquete: {
        num_paquete: paquete.num_paquete,
        id_conglomerado: paquete.id_conglomerado,
        cantidad_ejemplares: muestrasProcessed.length,
        fecha_envio: paquete.fecha_envio || null,
        fecha_recibido_herbario: new Date().toISOString().split('T')[0],
        observaciones_generales: paquete.observaciones_generales || null,
        estado: 'recibido'
      },
      p_muestras: muestrasProcessed.map(m => ({
        num_individuo: m.num_individuo || null,
        colector: m.colector || null,
        num_coleccion: m.num_coleccion || null,
        observaciones: m.observaciones || null,
        fecha_coleccion: m.fecha_coleccion || null,
        id_subparcelas: m.id_subparcelas || null
      }))
    });

    if (rpcError) {
      logger.error('Error en RPC crear_paquete_con_muestras', { error: rpcError });
      return res.status(500).json({ 
        error: 'Error creando paquete y muestras',
        detalle: rpcError.message 
      });
    }

    if (!rpcResult?.ok) {
      logger.warn('RPC retornó error', { resultado: rpcResult });
      if (rpcResult?.error === 'paquete_duplicado') {
        return res.status(409).json({ 
          error: 'Paquete duplicado', 
          mensaje: rpcResult.mensaje 
        });
      }
      return res.status(500).json({ error: rpcResult?.error || 'Error desconocido' });
    }

    logger.info(`Paquete creado con ID ${rpcResult.paquete_id}, ${rpcResult.total_muestras} muestras`);
    const paqueteResult = { success: true, data: { id: rpcResult.paquete_id } };

    res.status(201).json({
      ok: true,
      mensaje: 'Recepción confirmada exitosamente',
      paquete_id: paqueteResult.data.id,
      muestras_creadas: muestrasProcessed.length,
      estado: 'recibido',
      fecha_recepcion: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error confirmando recepción', { error: error.message, stack: error.stack });
    console.error('Error completo:', error);
    res.status(500).json({ error: 'Error al confirmar recepción', detalle: error.message });
  }
});

// Registrar paquete con muestras (lógica de negocio + delegación a Gestión Herbario)
// ACTUALIZADO SCHEMA V3.0: Sin evento_colección, relación directa con conglomerado

/**
 * POST /paquetes
 * Registra un nuevo paquete con sus muestras en el sistema
 * @param {Object} req.body - Datos del paquete y muestras
 * @param {number} req.body.id_conglomerado - ID del conglomerado
 * @param {Array} req.body.muestras - Array de muestras del paquete
 * @param {string} [req.body.observaciones_generales] - Observaciones del paquete
 * @returns {Object} Información del paquete creado
 */
app.post('/paquetes', async (req, res) => {
  try {
    // 1. VALIDACIÓN DE DATOS (Lógica de Negocio)
    const validation = validatePaqueteDTO(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Datos inválidos', details: validation.errors });
    }

    // 2. TRANSFORMACIÓN DE DATOS (Lógica de Negocio)
    const { paquete, muestras } = createPaqueteInsert(req.body);

    // 2.1 VERIFICAR SI EL PAQUETE YA EXISTE
    logger.info(`Verificando si paquete ${paquete.num_paquete} ya existe`);
    const { data: paqueteExistente, error: errorVerificacion } = await supabase
      .from('paquete')
      .select('id, num_paquete, estado, fecha_recibido_herbario')
      .eq('num_paquete', String(paquete.num_paquete))
      .maybeSingle();

    if (errorVerificacion) {
      logger.error('Error verificando paquete existente', { error: errorVerificacion.message });
      return res.status(500).json({ error: 'Error verificando paquete', detalle: errorVerificacion.message });
    }

    if (paqueteExistente) {
      logger.warn(`Paquete ${paquete.num_paquete} ya existe con ID ${paqueteExistente.id}`);
      return res.status(409).json({ 
        error: 'Paquete duplicado', 
        mensaje: `El paquete ${paquete.num_paquete} ya fue recibido el ${paqueteExistente.fecha_recibido_herbario}`,
        paquete_id: paqueteExistente.id
      });
    }

    // 3. VALIDACIONES ADICIONALES DE NEGOCIO
    if (muestras.length === 0) {
      return res.status(400).json({ error: 'El paquete debe contener al menos una muestra' });
    }

    if (muestras.length > 100) {
      return res.status(400).json({ error: 'El paquete no puede exceder 100 muestras por razones de procesamiento' });
    }

    // 4. CÁLCULOS DERIVADOS (Lógica de Negocio)
    paquete.cantidad_ejemplares = muestras.length;
    paquete.fecha_recibido_herbario = paquete.fecha_recibido_herbario || new Date().toISOString().split('T')[0];

    // 5. SINCRONIZACIÓN DEL CONGLOMERADO
    // Asegurar que el conglomerado existe antes de crear el paquete
    logger.info(`Verificando/sincronizando conglomerado ${paquete.id_conglomerado}`);
    const syncResult = await HerbarioService.sincronizarConglomerado(paquete.id_conglomerado);
    if (!syncResult.success) {
      logger.error(`Error sincronizando conglomerado ${paquete.id_conglomerado}`, { error: syncResult.error });
      return res.status(500).json({ error: 'Error sincronizando conglomerado: ' + syncResult.error });
    }
    logger.info(`Conglomerado ${paquete.id_conglomerado} verificado/sincronizado correctamente`);

    // 6-7. CREAR PAQUETE Y MUESTRAS EN UNA SOLA TRANSACCIÓN (RPC)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('crear_paquete_con_muestras', {
      p_paquete: {
        num_paquete: paquete.num_paquete,
        id_conglomerado: paquete.id_conglomerado,
        cantidad_ejemplares: paquete.cantidad_ejemplares,
        fecha_envio: paquete.fecha_envio || null,
        fecha_recibido_herbario: paquete.fecha_recibido_herbario,
        observaciones_generales: paquete.observaciones_generales || null,
        estado: paquete.estado || 'recibido'
      },
      p_muestras: muestras.map(m => ({
        num_individuo: m.num_individuo || null,
        colector: m.colector || null,
        num_coleccion: m.num_coleccion || null,
        observaciones: m.observaciones || null,
        fecha_coleccion: m.fecha_coleccion || null,
        id_subparcelas: m.id_subparcelas || null
      }))
    });

    if (rpcError) {
      logger.error('Error en RPC crear_paquete_con_muestras', { error: rpcError });
      return res.status(500).json({ 
        error: 'Error creando paquete y muestras',
        detalle: rpcError.message 
      });
    }

    if (!rpcResult?.ok) {
      logger.warn('RPC retornó error', { resultado: rpcResult });
      if (rpcResult?.error === 'paquete_duplicado') {
        return res.status(409).json({ 
          error: 'Paquete duplicado', 
          mensaje: rpcResult.mensaje 
        });
      }
      return res.status(500).json({ error: rpcResult?.error || 'Error desconocido' });
    }

    logger.info(`Paquete creado con ID ${rpcResult.paquete_id}, ${rpcResult.total_muestras} muestras`);
    const paqueteResult = { success: true, data: { id: rpcResult.paquete_id } };

    // 8. RESPUESTA CON DATOS PROCESADOS (Lógica de Negocio)
    res.status(201).json({
      ok: true,
      mensaje: 'Paquete recibido exitosamente',
      paquete_id: paqueteResult.data.id,
      muestras_creadas: muestras.length,
      estado: paquete.estado || 'recibido',
      fecha_procesamiento: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error en POST /paquetes:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener paquetes recibidos (con filtros y lógica de presentación)
app.get('/paquetes', async (req, res) => {
  try {
    // 1. VALIDACIÓN DE PARÁMETROS (Lógica de Negocio)
    const { desde, hasta, conglomerado, page = 1, limit = 50 } = req.query;
    
    // Validar formato de fechas
    if (desde && isNaN(Date.parse(desde))) {
      return res.status(400).json({ error: 'Formato de fecha "desde" inválido' });
    }
    if (hasta && isNaN(Date.parse(hasta))) {
      return res.status(400).json({ error: 'Formato de fecha "hasta" inválido' });
    }

    // 2. PREPARAR FILTROS (Lógica de Negocio)
    const filtros = { page, limit };
    if (desde) filtros.desde = desde;
    if (hasta) filtros.hasta = hasta;  
    if (conglomerado) filtros.conglomerado = conglomerado;

    // 3. DELEGACIÓN A GESTIÓN HERBARIO
    const result = await HerbarioService.obtenerPaquetes(filtros);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // 4. PROCESAMIENTO DE RESPUESTA (Lógica de Negocio)
    const paquetes = result.data.map(paquete => ({
      ...paquete,
      // Cálculos derivados
      dias_desde_recepcion: paquete.fecha_recibido_herbario 
        ? Math.floor((new Date() - new Date(paquete.fecha_recibido_herbario)) / (1000 * 60 * 60 * 24))
        : null,
      ubicacion_completa: paquete.evento_coleccion?.conglomerado 
        ? `${paquete.evento_coleccion.conglomerado.municipio.nombre} - ${paquete.evento_coleccion.conglomerado.codigo}`
        : 'Sin ubicación'
    }));

    // 5. ESTADÍSTICAS AGREGADAS (Lógica de Negocio)
    const estadisticas = {
      total_paquetes: paquetes.length,
      promedio_muestras_por_paquete: paquetes.length > 0 
        ? Math.round(paquetes.reduce((sum, p) => sum + (p.cantidad_ejemplares || 0), 0) / paquetes.length)
        : 0,
      ubicaciones_unicas: [...new Set(paquetes.map(p => p.ubicacion_completa))].length
    };

    res.json({ 
      paquetes,
      estadisticas,
      filtros_aplicados: filtros,
      fecha_consulta: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error en GET /paquetes:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener conglomerados disponibles
app.get('/conglomerados', async (req, res) => {
  try {
    const result = await HerbarioService.obtenerConglomerados();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Transformar para vista de recepción
    const conglomerados = result.data.map(c => ({
      id: c.id,
      codigo: c.codigo,
      nombre_completo: `${c.codigo} - ${c.municipio.nombre}, ${c.municipio.departamento.nombre}`,
      municipio: c.municipio.nombre,
      departamento: c.municipio.departamento.nombre,
      region: c.municipio.departamento.region.nombre,
      latitud: c.latitud_dec,
      longitud: c.longitud_dec
    }));

    res.json(conglomerados);
  } catch (e) {
    console.error('Error en GET /conglomerados:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener subparcelas de un conglomerado
app.get('/conglomerados/:id/subparcelas', async (req, res) => {
  try {
    const result = await HerbarioService.obtenerSubparcelas(req.params.id);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (e) {
    logger.error('Error en GET /conglomerados/:id/subparcelas', { error: e.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const port = process.env.PORT || 3004;
app.listen(port, () => {
  logger.info(`Servidor ejecutándose en puerto ${port}`, { url: `http://localhost:${port}` });
});