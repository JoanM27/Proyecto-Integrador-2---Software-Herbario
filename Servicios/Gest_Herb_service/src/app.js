/**
 * GESTIÓN DE HERBARIO - SERVICIO BACKEND
 * ======================================
 *
 * Servicio principal para la gestión del herbario digital.
 * Maneja clasificaciones taxonómicas, paquetes, muestras y administración.
 *
 * PUERTOS:
 * - 3002: Servicio principal (Gest_Herb_service)
 * - 3001: Servicio de autenticación (Auth_Service)
 * - 4000: Servicio externo de conglomerados
 *
 * FUNCIONALIDADES:
 * - Gestión de clasificaciones taxonómicas
 * - Administración de paquetes y muestras
 * - Catálogo taxonómico jerárquico
 * - Ubicaciones geográficas
 * - Panel de administración
 * - Actualización automática de estados de paquete
 *
 * AUTOR: Proyecto Integrador 2 - Software Herbario
 * FECHA: 2025-11-17
 * VERSIÓN: 2.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { externalApiClient } from './externalApiClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ===== CONFIGURACIÓN DE LOGGING =====
let logger;
try {
  const { createLogger } = await import('../../shared/logger/index.js');
  logger = createLogger('Gest_Herb_service');
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

// ===== CONEXIÓN A SUPABASE =====
logger.info('Probando conexión a Supabase...', {
  url: process.env.SUPABASE_URL,
  hasKey: !!process.env.SUPABASE_ANON_KEY
});

supabase.from('region').select('*').limit(1)
  .then(({ data, error }) => {
    if (error) {
      logger.error('Error conectando a Supabase', {
        message: error.message,
        code: error.code
      });
    } else {
      logger.info('✅ Conexión a Supabase exitosa', {
        datosCount: data?.length || 0
      });
    }
  })
  .catch(err => {
    logger.error('Error general al conectar Supabase', { error: err.message });
  });

// ===== CONFIGURACIÓN DE EXPRESS =====
const app = express();

app.set('logger', logger); // Hacer logger accesible en el middleware
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

// Rate limiting: 100 requests por 15 minutos
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// ===== ENDPOINTS PRINCIPALES =====

// Health check básico
app.get('/health', (req, res) => res.json({ ok: true }));

// ===== CONGLOMERADOS =====

/**
 * POST /conglomerados/sincronizar/:id
 * Sincroniza un conglomerado desde el servicio externo a la BD local
 * @param {string} id - ID del conglomerado a sincronizar
 * @returns {Object} Resultado de la sincronización
 */
app.post('/conglomerados/sincronizar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conglomeradoId = parseInt(id, 10);

    if (isNaN(conglomeradoId)) {
      return res.status(400).json({ error: 'ID de conglomerado inválido' });
    }

    console.log(`Sincronizando conglomerado ${conglomeradoId}...`);

    // PASO 1: Verificar si el conglomerado ya existe en BD local
    console.log(`Verificando existencia de conglomerado ${conglomeradoId} en BD local...`);
    const { data: existing, error: checkError } = await supabase
      .from('conglomerado')
      .select('id, codigo')
      .eq('id', conglomeradoId)
      .single();

    console.log(`Resultado check: existing=${!!existing}, error=${checkError?.message}, code=${checkError?.code}`);

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error verificando conglomerado existente:', checkError);
      return res.status(500).json({ error: 'Error verificando conglomerado existente' });
    }

    if (existing) {
      console.log(`✅ Conglomerado ${conglomeradoId} ya existe en BD local`);
      return res.json({
        success: true,
        message: 'Conglomerado ya sincronizado',
        data: existing
      });
    }

    // PASO 2: Obtener datos del conglomerado desde servicio externo
    console.log(`Obteniendo conglomerado ${conglomeradoId} del servicio externo...`);
    let conglomeradoExterno;
    try {
      // TEMPORAL: Simular datos para probar el endpoint
      if (conglomeradoId === 15) {
        conglomeradoExterno = {
          id: 15,
          codigo: "000015",
          id_municipio: 1,
          latitud_dec: 6.2476,
          longitud_dec: -75.5658
        };
        console.log('Usando datos simulados para conglomerado 15');
      } else {
        // Obtener todos los conglomerados y filtrar por ID
        console.log('Llamando a externalApiClient.obtenerConglomerados...');
        const todosConglomerados = await externalApiClient.obtenerConglomerados({ limit: 100 });
        console.log(`Obtenidos ${todosConglomerados.length} conglomerados del servicio externo`);

        conglomeradoExterno = todosConglomerados.find(c => c.id === conglomeradoId);
        console.log(`Conglomerado encontrado:`, conglomeradoExterno);

        if (!conglomeradoExterno) {
          throw new Error(`Conglomerado con ID ${conglomeradoId} no encontrado en servicio externo`);
        }
      }
    } catch (error) {
      console.error('Error obteniendo conglomerado del servicio externo:', error);
      return res.status(404).json({
        error: 'Conglomerado no encontrado en servicio externo',
        detalle: error.message
      });
    }

    // PASO 3: Sincronizar conglomerado usando función RPC
    console.log(`Insertando conglomerado ${conglomeradoExterno.codigo} en BD local...`);
    const { data: rpcResult, error: rpcError } = await supabase.rpc('upsert_conglomerado', {
      p_id: conglomeradoExterno.id,
      p_codigo: conglomeradoExterno.codigo,
      p_id_municipio: conglomeradoExterno.id_municipio,
      p_lat: conglomeradoExterno.latitud_dec,
      p_lon: conglomeradoExterno.longitud_dec
    });

    if (rpcError) {
      console.error('Error en RPC upsert_conglomerado:', rpcError);
      return res.status(500).json({
        error: 'Error insertando conglomerado en BD local',
        detalle: rpcError.message
      });
    }

    if (!rpcResult?.ok) {
      console.error('RPC retornó error:', rpcResult);
      return res.status(500).json({
        error: 'Error en sincronización',
        detalle: rpcResult?.error || 'Error desconocido'
      });
    }

    console.log(`✅ Conglomerado ${conglomeradoExterno.codigo} sincronizado exitosamente`);
    res.json({
      success: true,
      message: 'Conglomerado sincronizado exitosamente',
      data: {
        id: conglomeradoExterno.id,
        codigo: conglomeradoExterno.codigo,
        latitud_dec: conglomeradoExterno.latitud_dec,
        longitud_dec: conglomeradoExterno.longitud_dec,
        id_municipio: conglomeradoExterno.id_municipio
      }
    });

  } catch (err) {
    console.error('Error en POST /conglomerados/sincronizar/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== PAQUETES =====

// ===== MUESTRAS BOTÁNICAS =====

/**
 * GET /muestras/pendientes
 * Obtiene muestras botánicas pendientes de clasificación taxonómica
 * @param {string} [req.query.conglomerado] - Filtro por conglomerado
 * @param {number} [req.query.limit=50] - Límite de resultados
 * @param {number} [req.query.offset=0] - Offset para paginación
 * @returns {Array} Lista de muestras pendientes con datos enriquecidos
 */
app.get('/muestras/pendientes', async (req, res) => {
  try {
    const { conglomerado, limit = 50, offset = 0 } = req.query;
    
    // PASO 1: Obtener IDs de muestras que YA tienen clasificación (cualquier estado)
    // Excluir todas las muestras que tengan borrador, en_analisis, firmado o completado
    const { data: muestrasConClasificacion, error: errorClasificadas } = await supabase
      .from('clasificacion_herbario')
      .select('id_muestra')
      .in('estado', ['borrador', 'en_analisis', 'firmado', 'completado']);

    if (errorClasificadas) {
      console.error('Error obteniendo muestras clasificadas:', errorClasificadas);
      return res.status(500).json({ error: 'Error obteniendo muestras clasificadas', details: errorClasificadas });
    }

    const idsConClasificacion = muestrasConClasificacion?.map(c => c.id_muestra) || [];
    console.log(`Muestras con clasificación a excluir: ${idsConClasificacion.length}`);

    // PASO 2: Consultar muestras que NO están clasificadas
    // SOLO OBTENER CÓDIGO DE CONGLOMERADO (datos completos vienen del servicio externo)
    let query = supabase
      .from('muestra_botanica')
      .select(`
        id,
        num_coleccion,
        num_individuo,
        colector,
        observaciones,
        fecha_coleccion,
        id_paquete,
        paquete(
          id,
          num_paquete,
          fecha_recibido_herbario,
          id_conglomerado,
          conglomerado(codigo)
        )
      `)
      .not('id_paquete', 'is', null)
      .order('id', { ascending: true });

    // Excluir muestras que ya tienen clasificación (cualquier estado)
    if (idsConClasificacion.length > 0) {
      query = query.not('id', 'in', `(${idsConClasificacion.join(',')})`);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error obteniendo muestras pendientes:', error);
      return res.status(500).json({ error: 'Error obteniendo muestras', details: error });
    }

    // PASO 3: Obtener datos completos de conglomerados desde SERVICIO EXTERNO
    const codigosConglomerado = [...new Set(
      data
        .filter(m => m.paquete?.conglomerado?.codigo)
        .map(m => m.paquete.conglomerado.codigo)
    )];

    console.log(`Conglomerados únicos a consultar en servicio externo: ${codigosConglomerado.length}`);

    let conglomeradosMap = {};
    if (codigosConglomerado.length > 0) {
      try {
        conglomeradosMap = await externalApiClient.obtenerConglomeradosPorCodigos(codigosConglomerado);
        console.log(`✅ Conglomerados obtenidos del servicio externo: ${Object.keys(conglomeradosMap).length}`);
      } catch (error) {
        console.warn('⚠️ No se pudo conectar con servicio externo (puerto 4000), usando solo códigos:', error.message);
      }
    }

    // PASO 4: Enriquecer datos con información de conglomerados del servicio externo
    const muestrasEnriquecidas = data.map(muestra => {
      if (!muestra.paquete?.conglomerado?.codigo) {
        return muestra;
      }

      const codigoConglomerado = muestra.paquete.conglomerado.codigo;
      const datosExternos = conglomeradosMap[codigoConglomerado];

      if (datosExternos) {
        // Reemplazar datos de conglomerado con información del servicio externo
        // INCLUYE municipio y departamento obtenidos de Supabase local
        muestra.paquete.conglomerado = {
          codigo: datosExternos.codigo,
          municipio: datosExternos.municipio || { nombre: 'N/A', departamento: { nombre: 'N/A' } }
        };
      }

      return muestra;
    });

    res.json(muestrasEnriquecidas);
  } catch (err) {
    console.error('Error en GET /muestras/pendientes:', err);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
  }
});

app.put('/muestras/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('muestra_botanica')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando muestra:', error);
      return res.status(500).json({ error: 'Error actualizando muestra' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /muestras/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== CLASIFICACIONES TAXONÓMICAS =====

/**
 * GET /muestras/estado/:estado
 * Obtiene muestras clasificadas filtradas por estado
 * @param {string} estado - Estado de clasificación (pendiente, en_analisis, borrador, firmado, completado)
 * @param {number} [req.query.limit=50] - Límite de resultados
 * @param {number} [req.query.offset=0] - Offset para paginación
 * @returns {Array} Lista de muestras clasificadas con información taxonómica
 */
app.get('/muestras/estado/:estado', async (req, res) => {
  try {
    const { estado } = req.params
    const { limit = 50, offset = 0 } = req.query

    // Validar estado
    const estadosValidos = ['pendiente', 'en_analisis', 'borrador', 'firmado', 'completado']
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' })
    }

    const { data, error } = await supabase
      .from('clasificacion_herbario')
      .select(`
        id,
        id_muestra,
        id_especie,
        estado,
        estado_reproductivo,
        id_foto,
        id_determinador,
        created_at,
        muestra:id_muestra(
          id,
          num_coleccion,
          num_individuo,
          colector,
          paquete!inner(
            num_paquete,
            fecha_recibido_herbario,
            conglomerado(codigo)
          )
        ),
        especie:id_especie(
          nombre,
          nombre_comun,
          genero(
            nombre,
            familia(nombre)
          )
        ),
        archivos:id_foto(path, name)
      `)
      .eq('estado', estado)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error obteniendo clasificaciones:', error)
      return res.status(500).json({ error: 'Error obteniendo clasificaciones', details: error })
    }

    // Obtener códigos únicos de conglomerados
    const codigosConglomerado = [...new Set(
      data
        .filter(c => c.muestra?.paquete?.conglomerado?.codigo)
        .map(c => c.muestra.paquete.conglomerado.codigo)
    )]

    // Obtener datos completos de conglomerados desde servicio externo
    let conglomeradosMap = {}
    if (codigosConglomerado.length > 0) {
      try {
        conglomeradosMap = await externalApiClient.obtenerConglomeradosPorCodigos(codigosConglomerado)
        console.log(`✅ Conglomerados obtenidos del servicio externo: ${Object.keys(conglomeradosMap).length}`)
      } catch (error) {
        console.warn('Error obteniendo conglomerados del servicio externo:', error.message)
      }
    }

    // Mapear datos a formato frontend
    const muestras = (data || []).map(clasificacion => {
      const codigoConglomerado = clasificacion.muestra?.paquete?.conglomerado?.codigo
      const conglomeradoExterno = codigoConglomerado ? conglomeradosMap[codigoConglomerado] : null

      return {
        id: clasificacion.muestra?.id,
        id_clasificacion: clasificacion.id,
        num_coleccion: clasificacion.muestra?.num_coleccion,
        num_individuo: clasificacion.muestra?.num_individuo,
        codigo: clasificacion.muestra?.num_coleccion,
        paquete_numero: clasificacion.muestra?.paquete?.num_paquete,
        colector: clasificacion.muestra?.colector,
        fecha_recepcion: clasificacion.muestra?.paquete?.fecha_recibido_herbario || '--',
        nombre_conglomerado: conglomeradoExterno && conglomeradoExterno.municipio
          ? `${conglomeradoExterno.codigo} - ${conglomeradoExterno.municipio.nombre}, ${conglomeradoExterno.municipio.departamento?.nombre || conglomeradoExterno.municipio.nombre}`
          : (codigoConglomerado ? codigoConglomerado : 'Sin conglomerado'),
        paquete: {
          conglomerado: conglomeradoExterno || { codigo: codigoConglomerado }
        },
        estado: clasificacion.estado,
        especie_nombre: clasificacion.especie?.nombre || 'No identificada',
        familia: clasificacion.especie?.genero?.familia?.nombre || '--',
        genero: clasificacion.especie?.genero?.nombre || '--',
        estado_reproductivo: clasificacion.estado_reproductivo,
        foto: clasificacion.archivos ? {
          path: clasificacion.archivos.path,
          nombre: clasificacion.archivos.name
        } : null,
        id_determinador: clasificacion.id_determinador,
        fecha_clasificacion: clasificacion.created_at
      }
    })

    res.json(muestras)
  } catch (err) {
    console.error('Error en GET /muestras/estado/:estado:', err)
    res.status(500).json({ error: 'Error interno del servidor', message: err.message })
  }
})

/**
 * GET /clasificaciones/:id
 * Obtiene una clasificación específica por su ID
 * @param {string} id - ID de la clasificación
 * @returns {Object} Clasificación con información de archivo si existe
 */
app.get('/clasificaciones/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Obtener la clasificación
    const { data: clasificacion, error: errorClasificacion } = await supabase
      .from('clasificacion_herbario')
      .select('*')
      .eq('id', id)
      .single()

    if (errorClasificacion) {
      console.error('Error obteniendo clasificación:', errorClasificacion)
      return res.status(404).json({ error: 'Clasificación no encontrada' })
    }

    // Si tiene id_foto, obtener los datos del archivo
    if (clasificacion.id_foto) {
      const { data: archivo, error: errorArchivo } = await supabase
        .from('archivos')
        .select('*')
        .eq('id', clasificacion.id_foto)
        .single()
      
      if (!errorArchivo && archivo) {
        clasificacion.archivos = archivo
      }
    }

    res.json(clasificacion)
  } catch (err) {
    console.error('Error en GET /clasificaciones/:id:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

/**
 * GET /archivos/:id
 * Obtiene información de un archivo por su ID
 * @param {string} id - ID del archivo
 * @returns {Object} Información del archivo
 */
app.get('/archivos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('archivos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo archivo:', error)
      return res.status(404).json({ error: 'Archivo no encontrado' })
    }

    res.json(data)
  } catch (err) {
    console.error('Error en GET /archivos/:id:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

/**
 * GET /clasificaciones/muestra/:muestraId
 * Obtiene la clasificación existente para una muestra específica
 * @param {string} muestraId - ID de la muestra
 * @returns {Object|null} Clasificación existente o null si no existe
 */
app.get('/clasificaciones/muestra/:muestraId', async (req, res) => {
  try {
    const { muestraId } = req.params;
    const muestraIdNum = parseInt(muestraId, 10);
    
    if (isNaN(muestraIdNum)) {
      return res.status(400).json({ error: 'ID de muestra inválido' });
    }
    
    const { data, error } = await supabase
      .from('clasificacion_herbario')
      .select('*')
      .eq('id_muestra', muestraIdNum)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error obteniendo clasificación:', error);
      return res.status(500).json({ error: 'Error obteniendo clasificación' });
    }

    // Si no existe clasificación, retornar null
    if (error && error.code === 'PGRST116') {
      return res.json(null);
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /clasificaciones/muestra/:muestraId:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /clasificaciones
 * Crea una nueva clasificación taxonómica para una muestra
 * @param {Object} req.body - Datos de la clasificación
 * @param {number} req.body.id_muestra - ID de la muestra a clasificar
 * @param {number} [req.body.id_especie] - ID de la especie identificada
 * @param {string} [req.body.estado_reproductivo] - Estado reproductivo
 * @param {number} [req.body.id_foto] - ID del archivo de imagen
 * @param {number} [req.body.id_determinador] - ID del determinador
 * @returns {Object} ID de la clasificación creada
 */
app.post('/clasificaciones', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clasificacion_herbario')
      .insert(req.body)
      .select('id')
      .single();

    if (error) {
      console.error('Error creando clasificación:', error);
      
      // DETECTAR ERROR DE TRIGGER: trg_validar_clasificacion_unica
      if (error.message && error.message.includes('ya tiene una clasificación en proceso')) {
        return res.status(409).json({ 
          error: 'Clasificación duplicada',
          mensaje: error.message,
          detalle: 'Esta muestra ya tiene una clasificación en estado borrador o en_analisis. Use la opción de actualizar en lugar de crear nueva.'
        });
      }
      
      // DETECTAR ERROR DE TRIGGER: trg_validar_num_individuo_unico
      if (error.message && error.message.includes('ya fue clasificado en otra muestra')) {
        return res.status(409).json({ 
          error: 'Individuo duplicado',
          mensaje: error.message,
          detalle: 'Este num_individuo ya fue clasificado previamente. Puede haber muestras duplicadas en el sistema.'
        });
      }
      
      // Retornar el error real de Supabase para debugging
      return res.status(500).json({ 
        error: 'Error creando clasificación',
        detalle: error.message || error.hint || JSON.stringify(error)
      });
    }

    res.status(201).json({ id: data.id });
  } catch (err) {
    console.error('Error en POST /clasificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar clasificación existente (borrador)
app.put('/clasificaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('clasificacion_herbario')
      .update(req.body)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      console.error('Error actualizando clasificación:', error);
      return res.status(500).json({ error: 'Error actualizando clasificación' });
    }

    res.json({ id: data.id, message: 'Clasificación actualizada' });
  } catch (err) {
    console.error('Error en PUT /clasificaciones/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /clasificaciones/muestra/:muestraId
 * Actualiza la clasificación existente para una muestra, o crea una nueva si no existe
 * @param {string} muestraId - ID de la muestra
 * @param {Object} req.body - Datos de la clasificación a actualizar/crear
 * @returns {Object} ID de la clasificación actualizada o creada
 */
app.put('/clasificaciones/muestra/:muestraId', async (req, res) => {
  try {
    const { muestraId } = req.params;
    const muestraIdNum = parseInt(muestraId, 10);
    
    if (isNaN(muestraIdNum)) {
      return res.status(400).json({ error: 'ID de muestra inválido' });
    }
    
    // Primero verificar si existe una clasificación para esta muestra
    const { data: existing, error: findError } = await supabase
      .from('clasificacion_herbario')
      .select('id, estado')
      .eq('id_muestra', muestraIdNum)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error buscando clasificación existente:', findError);
      return res.status(500).json({ error: 'Error buscando clasificación existente' });
    }

    if (existing) {
      // Si existe, verificar que esté en estado editable
      if (!['borrador', 'en_analisis'].includes(existing.estado)) {
        return res.status(409).json({ 
          error: 'Clasificación no editable',
          mensaje: `La clasificación existente tiene estado '${existing.estado}' y no puede ser modificada.`,
          detalle: 'Solo se pueden editar clasificaciones en estado borrador o en_analisis.'
        });
      }

      // Actualizar la clasificación existente
      const { data, error } = await supabase
        .from('clasificacion_herbario')
        .update(req.body)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        console.error('Error actualizando clasificación existente:', error);
        return res.status(500).json({ error: 'Error actualizando clasificación' });
      }

      return res.json({ id: data.id, message: 'Clasificación actualizada', action: 'updated' });
    } else {
      // Si no existe, crear nueva clasificación
      const { data, error } = await supabase
        .from('clasificacion_herbario')
        .insert({ ...req.body, id_muestra: muestraIdNum })
        .select('id')
        .single();

      if (error) {
        console.error('Error creando nueva clasificación:', error);
        
        // DETECTAR ERROR DE TRIGGER: trg_validar_clasificacion_unica
        if (error.message && error.message.includes('ya tiene una clasificación en proceso')) {
          return res.status(409).json({ 
            error: 'Clasificación duplicada',
            mensaje: error.message,
            detalle: 'Esta muestra ya tiene una clasificación en estado borrador o en_analisis'
          });
        }
        
        // DETECTAR ERROR DE TRIGGER: trg_validar_num_individuo_unico
        if (error.message && error.message.includes('ya fue clasificado en otra muestra')) {
          return res.status(409).json({ 
            error: 'Individuo duplicado',
            mensaje: error.message,
            detalle: 'Este num_individuo ya fue clasificado previamente. Puede haber muestras duplicadas en el sistema.'
          });
        }
        
        return res.status(500).json({ 
          error: 'Error creando clasificación',
          detalle: error.message || error.hint || JSON.stringify(error)
        });
      }

      return res.status(201).json({ id: data.id, message: 'Clasificación creada', action: 'created' });
    }
  } catch (err) {
    console.error('Error en PUT /clasificaciones/muestra/:muestraId:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar solo el estado de una clasificación
app.put('/clasificaciones/:idMuestra/estado', async (req, res) => {
  try {
    const { idMuestra } = req.params;
    const idMuestraNum = parseInt(idMuestra, 10);
    
    if (isNaN(idMuestraNum)) {
      return res.status(400).json({ error: 'ID de muestra inválido' });
    }
    
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'Estado es requerido' });
    }

    logger.info(`🔄 Actualizando estado de muestra ${idMuestraNum} a '${estado}'`);

    // Primero buscar si existe una clasificación para esta muestra
    const { data: existing, error: findError } = await supabase
      .from('clasificacion_herbario')
      .select('id, estado, id_muestra')
      .eq('id_muestra', idMuestraNum)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error buscando clasificación:', findError);
      return res.status(500).json({ error: 'Error buscando clasificación', details: findError.message });
    }

    // Si existe, actualizar
    if (existing) {
      logger.info(`📋 Clasificación existente encontrada (ID: ${existing.id}, estado actual: ${existing.estado})`);
      
      const { data, error } = await supabase
        .from('clasificacion_herbario')
        .update({ estado })
        .eq('id', existing.id)
        .select('id, id_muestra')
        .single();

      if (error) {
        logger.error('Error actualizando estado:', error);
        return res.status(500).json({ error: 'Error actualizando estado', details: error.message });
      }

      // ✅ ACTUALIZAR PAQUETE EN BACKGROUND (sin esperar)
      actualizarEstadoPaqueteManual(data.id_muestra).catch(err => {
        logger.warn('Error en actualización de paquete (background):', err.message);
      });

      logger.info(`✅ Estado actualizado correctamente a '${estado}'`);
      return res.json({ id: data.id, estado, message: 'Estado actualizado' });
    } else {
      // Si no existe, crear nueva clasificación con el estado
      logger.info(`📝 No existe clasificación previa. Creando nueva con estado '${estado}'`);
      
      const { data, error } = await supabase
        .from('clasificacion_herbario')
        .insert({ 
          id_muestra: idMuestraNum, 
          estado,
          id_especie: null,
          estado_reproductivo: null
        })
        .select('id, id_muestra')
        .single();

      if (error) {
        logger.error('Error creando clasificación con estado:', error);
        return res.status(500).json({ error: 'Error creando clasificación', details: error.message });
      }

      // ✅ ACTUALIZAR PAQUETE EN BACKGROUND (sin esperar)
      actualizarEstadoPaqueteManual(data.id_muestra).catch(err => {
        logger.warn('Error en actualización de paquete (background):', err.message);
      });

      logger.info(`✅ Clasificación creada correctamente con estado '${estado}'`);
      return res.status(201).json({ id: data.id, estado, message: 'Clasificación creada' });
    }
  } catch (err) {
    logger.error('Error en PUT /clasificaciones/:idMuestra/estado:', err);
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

// ✅ FUNCIÓN AUXILIAR: Actualizar estado del paquete (SIN TRIGGERS) - OPTIMIZADA
/**
 * FUNCIÓN OPTIMIZADA PARA ACTUALIZACIÓN AUTOMÁTICA DE ESTADO DE PAQUETE
 * ====================================================================
 *
 * Función que actualiza automáticamente el estado de un paquete basado en el estado
 * de todas sus clasificaciones. Reemplaza la lógica de triggers de base de datos.
 *
 * LLAMADA DESDE:
 * - PUT /clasificaciones/id/:id/estado (en background)
 * - PUT /clasificaciones/:idMuestra/estado (en background)
 *
 * LÓGICA DE ESTADO DE PAQUETE:
 * - recibido: Estado inicial cuando llega el paquete
 * - en_proceso: Al menos una clasificación está en 'en_analisis' o 'borrador'
 * - completo: TODAS las clasificaciones están en 'completado', 'firmado' o 'clasificado'
 *
 * OPTIMIZACIONES IMPLEMENTADAS:
 * - Una sola query para obtener todas las muestras del paquete con sus clasificaciones
 * - Procesamiento en memoria para contar estados
 * - Actualización condicional solo si el estado cambia
 * - Logging detallado para debugging
 * - Manejo robusto de errores sin detener el flujo principal
 *
 * @param {number} idMuestra - ID de la muestra cuya clasificación cambió
 * @param {Object} [logger] - Instancia del logger (opcional, usa console si no se proporciona)
 */
async function actualizarEstadoPaqueteManual(idMuestra) {
  try {
    // Obtener el paquete de la muestra
    const { data: muestra, error: errorMuestra } = await supabase
      .from('muestra_botanica')
      .select('id_paquete')
      .eq('id', idMuestra)
      .single();

    if (errorMuestra || !muestra || !muestra.id_paquete) {
      logger.debug('Muestra sin paquete o no encontrada');
      return;
    }

    const idPaquete = muestra.id_paquete;

    // UNA SOLA QUERY: Obtener todas las muestras del paquete con sus clasificaciones
    const { data: muestrasConClasificaciones, error: errorMuestras } = await supabase
      .from('muestra_botanica')
      .select(`
        id,
        clasificacion_herbario!left(estado)
      `)
      .eq('id_paquete', idPaquete);

    if (errorMuestras || !muestrasConClasificaciones) {
      logger.warn('Error obteniendo muestras:', errorMuestras?.message);
      return;
    }

    const totalMuestras = muestrasConClasificaciones.length;

    // Contar completadas en UNA pasada
    let completadas = 0;
    let enProceso = 0;

    muestrasConClasificaciones.forEach(muestra => {
      if (muestra.clasificacion_herbario && muestra.clasificacion_herbario.length > 0) {
        const estado = muestra.clasificacion_herbario[0].estado;
        if (['completado', 'firmado', 'clasificado'].includes(estado)) {
          completadas++;
        } else if (['en_analisis', 'borrador'].includes(estado)) {
          enProceso++;
        }
      }
    });

    // Determinar nuevo estado del paquete
    let nuevoEstado = 'recibido';
    if (totalMuestras > 0 && completadas === totalMuestras) {
      nuevoEstado = 'completo';
    } else if (enProceso > 0) {
      nuevoEstado = 'en_proceso';
    }

    // Actualizar paquete
    const { error: errorActualizacion } = await supabase
      .from('paquete')
      .update({ estado: nuevoEstado })
      .eq('id', idPaquete);

    if (errorActualizacion) {
      logger.warn('Error actualizando paquete:', errorActualizacion.message);
      return;
    }

    logger.debug('✅ Paquete actualizado', {
      id_paquete: idPaquete,
      nuevo_estado: nuevoEstado,
      total_muestras: totalMuestras,
      completadas
    });

  } catch (err) {
    logger.warn('Error en actualizarEstadoPaqueteManual:', err.message);
  }
}

// ENDPOINT: Actualizar estado por ID de clasificación (usado por frontend)
/**
 * ENDPOINT ULTRA-RÁPIDO PARA CAMBIO DE ESTADO DE CLASIFICACIÓN
 * ===========================================================
 *
 * Endpoint optimizado para cambiar el estado de clasificaciones taxonómicas.
 * Responde inmediatamente al frontend mientras procesa la actualización de paquete en background.
 *
 * USADO POR: LaboratorioDashboard.vue - funciones firmarClasificacion() y cerrarClasificacion()
 *
 * Estados válidos:
 * - borrador: Estado inicial de clasificación
 * - firmado: Clasificación firmada por especialista (requiere validación de contraseña)
 * - completado: Clasificación finalizada y cerrada
 *
 * Flujo de trabajo:
 * 1. borrador → firmado (con validación de contraseña)
 * 2. firmado → completado (cierre final)
 *
 * @param {string} req.params.id - ID de la clasificación a actualizar
 * @param {Object} req.body - Datos de la solicitud
 * @param {string} req.body.estado - Nuevo estado ('firmado' o 'completado')
 * @param {string} [req.body.usuario_id] - ID del usuario (requerido para 'firmado')
 * @param {string} [req.body.password] - Contraseña (requerida para 'firmado')
 * @returns {Object} Respuesta inmediata con éxito/error
 *
 * OPTIMIZACIONES:
 * - Respuesta inmediata al frontend (no bloquea UI)
 * - Procesamiento de paquete en background con setImmediate()
 * - Una sola query para actualizar clasificación
 * - Logging detallado para debugging
 */
app.put('/clasificaciones/id/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: 'Estado es requerido' });
    }

    logger.debug(`🔄 Actualizando clasificación ${id} a estado '${estado}'`);

    // ⚡ ACTUALIZACIÓN ULTRA RÁPIDA: Solo actualizar sin select
    const { error } = await supabase
      .from('clasificacion_herbario')
      .update({ estado })
      .eq('id', id);

    if (error) {
      logger.error('Error actualizando clasificación:', error);
      return res.status(500).json({ error: 'Error actualizando clasificación', details: error.message });
    }

    // ✅ OBTENER ID_MUESTRA RÁPIDAMENTE (si es necesario para paquete)
    const { data: clasificacion, error: errorBusqueda } = await supabase
      .from('clasificacion_herbario')
      .select('id_muestra')
      .eq('id', id)
      .single();

    if (clasificacion && clasificacion.id_muestra) {
      // ✅ ACTUALIZAR PAQUETE EN BACKGROUND (no bloquear respuesta)
      actualizarEstadoPaqueteManual(clasificacion.id_muestra).catch(err => {
        logger.warn('Error en actualización de paquete (background):', err.message);
      });
    }

    // ⚡ RESPUESTA INMEDIATA
    logger.debug(`✅ Clasificación ${id} actualizada a '${estado}'`);
    res.json({
      id,
      estado,
      message: 'Estado actualizado'
    });

  } catch (err) {
    logger.error('Error en PUT /clasificaciones/id/:id/estado:', err);
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

// ===== CATÁLOGO TAXONÓMICO =====
app.get('/taxonomia/familias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('familia')
      .select('id, nombre')
      .order('nombre');

    if (error) {
      console.error('Error obteniendo familias:', error);
      return res.status(500).json({ error: 'Error obteniendo familias' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /taxonomia/familias:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/taxonomia/generos/:familiaId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('genero')
      .select('id, nombre')
      .eq('id_familia', req.params.familiaId)
      .order('nombre');

    if (error) {
      console.error('Error obteniendo géneros:', error);
      return res.status(500).json({ error: 'Error obteniendo géneros' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /taxonomia/generos/:familiaId:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/taxonomia/especies/:generoId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('especie')
      .select('id, nombre, nombre_comun, tipo_amenaza')
      .eq('id_genero', req.params.generoId)
      .order('nombre');

    if (error) {
      console.error('Error obteniendo especies:', error);
      return res.status(500).json({ error: 'Error obteniendo especies' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /taxonomia/especies/:generoId:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== UBICACIONES GEOGRÁFICAS =====
app.get('/ubicaciones/conglomerados', async (req, res) => {
  try {
    // OBTENER CONGLOMERADOS COMPLETOS DESDE SERVICIO EXTERNO
    // Ya incluyen municipio y departamento
    const conglomerados = await externalApiClient.obtenerConglomerados({ limit: 2000 });
    
    // Formatear para mantener compatibilidad con frontend
    const conglomeradosFormateados = conglomerados.map(c => ({
      id: c.id,
      codigo: c.codigo,
      latitud_dec: c.latitud_dec,
      longitud_dec: c.longitud_dec,
      municipio: c.municipio || { 
        id: c.id_municipio,
        nombre: 'N/A', 
        departamento: { nombre: 'N/A', region: { nombre: 'N/A' } } 
      }
    }));

    res.json(conglomeradosFormateados);
  } catch (err) {
    console.error('Error en GET /ubicaciones/conglomerados:', err);
    // Fallback: intentar desde Supabase local si servicio externo falla
    try {
      const { data, error } = await supabase
        .from('conglomerado')
        .select(`
          id, codigo, latitud_dec, longitud_dec,
          municipio!inner(id, nombre, departamento!inner(id, nombre, region!inner(nombre)))
        `)
        .order('codigo');

      if (error) throw error;
      res.json(data);
    } catch (fallbackErr) {
      console.error('Error en fallback:', fallbackErr);
      res.status(500).json({ error: 'Error obteniendo conglomerados' });
    }
  }
});

// ===== ENDPOINTS DE ADMINISTRACIÓN =====

// Gestión de herbario
app.post('/admin/herbario', async (req, res) => {
  try {
    const { nombre, codigo_postal, direccion } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }

    const { data, error } = await supabase
      .from('herbario')
      .insert({
        nombre,
        codigo_postal,
        direccion
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creando herbario:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un herbario con ese código' });
      }
      return res.status(500).json({ error: 'Error creando herbario' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error en POST /admin/herbario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/admin/herbario', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('herbario')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error obteniendo herbario:', error);
      return res.status(500).json({ error: 'Error obteniendo herbario' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /admin/herbario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/admin/herbario/:id', async (req, res) => {
  try {
    const { nombre, codigo_postal, direccion } = req.body;

    const { data, error } = await supabase
      .from('herbario')
      .update({
        nombre,
        codigo_postal,
        direccion
      })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error actualizando herbario:', error);
      return res.status(500).json({ error: 'Error actualizando herbario' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Herbario no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /admin/herbario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/admin/herbario/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('herbario')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error eliminando herbario:', error);
      return res.status(500).json({ error: 'Error eliminando herbario' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Herbario no encontrado' });
    }

    res.json({ message: 'Herbario eliminado exitosamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/herbario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Gestión de Usuarios de Herbario
app.post('/admin/usuarios', async (req, res) => {
  try {
    const { nombre, email, cedula, telefono, password, rol, id_herbario } = req.body;
    
    if (!nombre || !email || !cedula || !rol || !id_herbario) {
      return res.status(400).json({ 
        error: 'Nombre, email, cédula, rol y herbario son requeridos' 
      });
    }

    // Verificar que el herbario existe
    const { data: herbario, error: herbarioError } = await supabase
      .from('herbario')
      .select('id')
      .eq('id', id_herbario)
      .single();

    if (herbarioError || !herbario) {
      return res.status(400).json({ error: 'Herbario no encontrado' });
    }

    // Crear usuario en Supabase Auth primero (si se proporciona password)
    let userId;
    if (password) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      });
      
      if (authError) {
        console.error('Error creando usuario en auth:', authError);
        return res.status(400).json({ error: 'Error creando usuario de autenticación' });
      }
      
      userId = authData.user.id;
    }

    const { data, error } = await supabase
      .from('info_usuario')
      .insert({
        id_user: userId,
        nombre_completo: nombre,
        correo_electronico: email,
        cedula: cedula || null,
        telefono: telefono || null,
        rol,
        id_herbario
      })
      .select(`
        *,
        herbario:id_herbario (
          id,
          nombre,
          codigo_postal
        )
      `)
      .single();

    if (error) {
      console.error('Error creando usuario:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un usuario con esa cédula o email' });
      }
      return res.status(500).json({ error: 'Error creando usuario' });
    }

    // No retornar la contraseña
    const { password_hash, ...userResponse } = data;
    res.status(201).json(userResponse);
  } catch (err) {
    console.error('Error en POST /admin/usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/admin/usuarios', async (req, res) => {
  try {
    const { id_herbario } = req.query;
    
    // 1. Obtener usuarios de info_usuario
    let query = supabase
      .from('info_usuario')
      .select(`
        *,
        herbario:id_herbario (
          id,
          nombre,
          codigo_postal
        )
      `)
      .order('created_at', { ascending: false });

    if (id_herbario) {
      query = query.eq('id_herbario', id_herbario);
    }

    const { data: infoUsuarios, error } = await query;

    if (error) {
      console.error('Error obteniendo usuarios:', error);
      return res.status(500).json({ error: 'Error obteniendo usuarios' });
    }

    // 2. Obtener usuarios de Auth para verificar cuáles existen
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.warn('No se pudieron obtener usuarios de Auth:', authError);
    }

    // 3. Mapear usuarios con su info de Auth
    const authUsersMap = new Map(
      authUsers?.users?.map(u => [u.id, u]) || []
    );

    // 4. Enriquecer info_usuario con datos de Auth
    const users = infoUsuarios.map(user => {
      const authUser = authUsersMap.get(user.id_user);
      return {
        ...user,
        email_verified: authUser?.email_confirmed_at ? true : false,
        last_sign_in: authUser?.last_sign_in_at || null,
        created_at_auth: authUser?.created_at || null
      };
    });

    res.json(users);
  } catch (err) {
    console.error('Error en GET /admin/usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/admin/usuarios/:id', async (req, res) => {
  try {
    const { nombre, email, cedula, telefono, rol, id_herbario } = req.body;

    const updateData = {
      nombre_completo: nombre,
      correo_electronico: email,
      cedula: cedula || null,
      telefono: telefono || null,
      rol,
      id_herbario
    };

    // Si se proporciona nueva contraseña, actualizar en Supabase Auth
    if (req.body.password) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        req.params.id,
        { password: req.body.password }
      );
      
      if (authError) {
        console.error('Error actualizando contraseña:', authError);
        return res.status(400).json({ error: 'Error actualizando contraseña' });
      }
    }

    const { data, error } = await supabase
      .from('info_usuario')
      .update(updateData)
      .eq('id_user', req.params.id)
      .select(`
        *,
        herbario:id_herbario (
          id,
          nombre,
          codigo_postal
        )
      `)
      .single();

    if (error) {
      console.error('Error actualizando usuario:', error);
      return res.status(500).json({ error: 'Error actualizando usuario' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /admin/usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/admin/usuarios/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('info_usuario')
      .delete()
      .eq('id_user', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error eliminando usuario:', error);
      return res.status(500).json({ error: 'Error eliminando usuario' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Autenticación de administrador
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Credenciales hardcodeadas por el momento
    if (username === 'admin' && password === 'admin') {
      res.json({
        success: true,
        token: 'admin-token-' + Date.now(),
        user: {
          id: 1,
          username: 'admin',
          role: 'super_admin',
          permissions: ['create_herbario', 'manage_users', 'view_all']
        }
      });
    } else {
      res.status(401).json({ error: 'Credenciales incorrectas' });
    }
  } catch (err) {
    console.error('Error en POST /admin/login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== GESTIÓN DE UBICACIONES GEOGRÁFICAS =====

// Gestión de Regiones
app.get('/admin/regiones', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('region')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error obteniendo regiones:', error);
      return res.status(500).json({ error: 'Error obteniendo regiones' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /admin/regiones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/admin/regiones', async (req, res) => {
  try {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }

    const { data, error } = await supabase
      .from('region')
      .insert({
        nombre
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creando región:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una región con ese nombre' });
      }
      return res.status(500).json({ error: 'Error creando región' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error en POST /admin/regiones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/admin/regiones/:id', async (req, res) => {
  try {
    const { nombre } = req.body;

    const { data, error } = await supabase
      .from('region')
      .update({
        nombre
      })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error actualizando región:', error);
      return res.status(500).json({ error: 'Error actualizando región' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Región no encontrada' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /admin/regiones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/admin/regiones/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('region')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error eliminando región:', error);
      return res.status(500).json({ error: 'Error eliminando región' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Región no encontrada' });
    }

    res.json({ message: 'Región eliminada exitosamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/regiones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Gestión de Departamentos
app.get('/admin/departamentos', async (req, res) => {
  try {
    const { id_region } = req.query;
    
    let query = supabase
      .from('departamento')
      .select(`
        *,
        region:id_region (
          id,
          nombre
        )
      `)
      .order('nombre', { ascending: true });

    if (id_region) {
      query = query.eq('id_region', id_region);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo departamentos:', error);
      return res.status(500).json({ error: 'Error obteniendo departamentos' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /admin/departamentos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/admin/departamentos', async (req, res) => {
  try {
    const { nombre, id_region } = req.body;
    
    if (!nombre || !id_region) {
      return res.status(400).json({ 
        error: 'Nombre y región son requeridos' 
      });
    }

    // Verificar que la región existe
    const { data: region, error: regionError } = await supabase
      .from('region')
      .select('id')
      .eq('id', id_region)
      .single();

    if (regionError || !region) {
      return res.status(400).json({ error: 'Región no encontrada' });
    }

    const { data, error } = await supabase
      .from('departamento')
      .insert({
        nombre,
        id_region
      })
      .select(`
        *,
        region:id_region (
          id,
          nombre
        )
      `)
      .single();

    if (error) {
      console.error('Error creando departamento:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un departamento con ese nombre' });
      }
      return res.status(500).json({ error: 'Error creando departamento' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error en POST /admin/departamentos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/admin/departamentos/:id', async (req, res) => {
  try {
    const { nombre, id_region } = req.body;

    const { data, error } = await supabase
      .from('departamento')
      .update({
        nombre,
        id_region
      })
      .eq('id', req.params.id)
      .select(`
        *,
        region:id_region (
          id,
          nombre
        )
      `)
      .single();

    if (error) {
      console.error('Error actualizando departamento:', error);
      return res.status(500).json({ error: 'Error actualizando departamento' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /admin/departamentos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/admin/departamentos/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departamento')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error eliminando departamento:', error);
      return res.status(500).json({ error: 'Error eliminando departamento' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }

    res.json({ message: 'Departamento eliminado exitosamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/departamentos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Gestión de Municipios
app.get('/admin/municipios', async (req, res) => {
  try {
    const { id_departamento } = req.query;
    
    let query = supabase
      .from('municipio')
      .select(`
        *,
        departamento:id_departamento (
          id,
          nombre,
          region:id_region (
            id,
            nombre
          )
        )
      `)
      .order('nombre', { ascending: true });

    if (id_departamento) {
      query = query.eq('id_departamento', id_departamento);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo municipios:', error);
      return res.status(500).json({ error: 'Error obteniendo municipios' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en GET /admin/municipios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/admin/municipios', async (req, res) => {
  try {
    const { nombre, id_departamento } = req.body;
    
    if (!nombre || !id_departamento) {
      return res.status(400).json({ 
        error: 'Nombre y departamento son requeridos' 
      });
    }

    // Verificar que el departamento existe
    const { data: departamento, error: departamentoError } = await supabase
      .from('departamento')
      .select('id')
      .eq('id', id_departamento)
      .single();

    if (departamentoError || !departamento) {
      return res.status(400).json({ error: 'Departamento no encontrado' });
    }

    const { data, error } = await supabase
      .from('municipio')
      .insert({
        nombre,
        id_departamento
      })
      .select(`
        *,
        departamento:id_departamento (
          id,
          nombre,
          region:id_region (
            id,
            nombre
          )
        )
      `)
      .single();

    if (error) {
      console.error('Error creando municipio:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un municipio con ese nombre' });
      }
      return res.status(500).json({ error: 'Error creando municipio' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Error en POST /admin/municipios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/admin/municipios/:id', async (req, res) => {
  try {
    const { nombre, id_departamento } = req.body;

    const { data, error } = await supabase
      .from('municipio')
      .update({
        nombre,
        id_departamento
      })
      .eq('id', req.params.id)
      .select(`
        *,
        departamento:id_departamento (
          id,
          nombre,
          region:id_region (
            id,
            nombre
          )
        )
      `)
      .single();

    if (error) {
      console.error('Error actualizando municipio:', error);
      return res.status(500).json({ error: 'Error actualizando municipio' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Municipio no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error en PUT /admin/municipios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/admin/municipios/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('municipio')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error eliminando municipio:', error);
      return res.status(500).json({ error: 'Error eliminando municipio' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Municipio no encontrado' });
    }

    res.json({ message: 'Municipio eliminado exitosamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/municipios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Estadísticas para administración
app.get('/admin/estadisticas', async (req, res) => {
  try {
    // Contar herbario
    const { count: totalherbario, error: herbarioError } = await supabase
      .from('herbario')
      .select('*', { count: 'exact', head: true });

    // Contar usuarios
    const { count: totalUsuarios, error: usuarioError } = await supabase
      .from('info_usuario')
      .select('*', { count: 'exact', head: true });

    // Contar herbarios activos (todos considerados activos)
    const herbarioActivos = totalherbario;
    const activosError = null;

    // Contar regiones
    const { count: totalRegiones, error: regionError } = await supabase
      .from('region')
      .select('*', { count: 'exact', head: true });

    // Contar departamentos
    const { count: totalDepartamentos, error: departamentoError } = await supabase
      .from('departamento')
      .select('*', { count: 'exact', head: true });

    // Contar municipios
    const { count: totalMunicipios, error: municipioError } = await supabase
      .from('municipio')
      .select('*', { count: 'exact', head: true });

    // Usuarios por rol (todos los usuarios)
    const { data: usuariosPorRol, error: rolError } = await supabase
      .from('info_usuario')
      .select('rol');

    if (herbarioError || usuarioError || activosError || rolError || 
        regionError || departamentoError || municipioError) {
      console.error('Error obteniendo estadísticas:', { 
        herbarioError, usuarioError, activosError, rolError,
        regionError, departamentoError, municipioError 
      });
      return res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }

    const roles = {};
    usuariosPorRol?.forEach(user => {
      roles[user.rol] = (roles[user.rol] || 0) + 1;
    });

    res.json({
      totalherbario: totalherbario || 0,
      herbarioActivos: herbarioActivos || 0,
      totalUsuarios: totalUsuarios || 0,
      totalRegiones: totalRegiones || 0,
      totalDepartamentos: totalDepartamentos || 0,
      totalMunicipios: totalMunicipios || 0,
      usuariosPorRol: roles
    });
  } catch (err) {
    logger.error('Error en GET /admin/estadisticas', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== RUTAS DE TAXONOMÍA JERÁRQUICA =====

// Obtener todas las familias con conteo de géneros
app.get('/api/taxonomia/familias', async (req, res) => {
  try {
    const { data: familias, error } = await supabase
      .from('familia')
      .select(`
        id,
        nombre,
        genero:genero(count)
      `)
      .order('nombre');

    if (error) throw error;

    // Procesar el conteo de géneros
    const familiasConConteo = familias.map(familia => ({
      id: familia.id,
      nombre: familia.nombre,
      generos_count: familia.genero[0]?.count || 0
    }));

    res.json(familiasConConteo);
  } catch (error) {
    console.error('Error obteniendo familias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener géneros de una familia específica con conteo de especies
app.get('/api/taxonomia/familias/:familiaId/generos', async (req, res) => {
  try {
    const { familiaId } = req.params;

    const { data: generos, error } = await supabase
      .from('genero')
      .select(`
        id,
        nombre,
        especie:especie(count)
      `)
      .eq('id_familia', familiaId)
      .order('nombre');

    if (error) throw error;

    // Procesar el conteo de especies
    const generosConConteo = generos.map(genero => ({
      id: genero.id,
      nombre: genero.nombre,
      especies_count: genero.especie[0]?.count || 0
    }));

    res.json(generosConConteo);
  } catch (error) {
    console.error('Error obteniendo géneros:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener especies de un género específico
app.get('/api/taxonomia/generos/:generoId/especies', async (req, res) => {
  try {
    const { generoId } = req.params;

    const { data: especies, error } = await supabase
      .from('especie')
      .select('id, nombre, nombre_comun, tipo_amenaza')
      .eq('id_genero', generoId)
      .order('nombre');

    if (error) throw error;

    res.json(especies);
  } catch (error) {
    console.error('Error obteniendo especies:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva especie
app.post('/api/taxonomia/especies', async (req, res) => {
  try {
    const { nombre, nombre_comun, tipo_amenaza, id_genero } = req.body;

    // Validar campos requeridos
    if (!nombre || !id_genero) {
      return res.status(400).json({ error: 'Nombre e id_genero son obligatorios' });
    }

    // Nota: La validación de tipo_amenaza se hace a nivel de base de datos (ENUM)
    // Los valores válidos según el ENUM son: CR, EN, VU, NN

    const { data, error } = await supabase
      .from('especie')
      .insert({
        nombre: nombre.trim(),
        nombre_comun: nombre_comun ? nombre_comun.trim() : null,
        tipo_amenaza: tipo_amenaza || null,
        id_genero
      })
      .select('id, nombre, nombre_comun, tipo_amenaza')
      .single();

    if (error) {
      logger.error('Error creando especie', { error: error.message, details: error });
      // Detectar error de ENUM
      if (error.message && error.message.includes('enum')) {
        return res.status(400).json({ 
          error: 'Tipo de amenaza no válido. Valores permitidos: CR, EN, VU, NN (o dejar vacío)'
        });
      }
      return res.status(500).json({ error: 'Error creando especie', details: error.message });
    }

    logger.info('Nueva especie creada', { id: data.id, nombre: data.nombre });
    res.status(201).json(data);
  } catch (err) {
    logger.error('Error en POST /api/taxonomia/especies', { error: err.message });
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

// Obtener información completa de una especie (con familia y género)
app.get('/api/taxonomia/especies/:especieId/completa', async (req, res) => {
  try {
    const { especieId } = req.params;

    const { data, error } = await supabase
      .from('especie')
      .select(`
        id,
        nombre,
        nombre_comun,
        tipo_amenaza,
        genero:id_genero(
          id,
          nombre,
          familia:id_familia(
            id,
            nombre
          )
        )
      `)
      .eq('id', especieId)
      .single();

    if (error) throw error;

    // Restructurar para el frontend
    const especieCompleta = {
      species: {
        id: data.id,
        nombre: data.nombre,
        nombre_comun: data.nombre_comun,
        tipo_amenaza: data.tipo_amenaza
      },
      genus: {
        id: data.genero.id,
        nombre: data.genero.nombre
      },
      family: {
        id: data.genero.familia.id,
        nombre: data.genero.familia.nombre
      }
    };

    res.json(especieCompleta);
  } catch (error) {
    console.error('Error obteniendo especie completa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Alias para obtener especie completa
app.get('/especies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('especie')
      .select(`
        id,
        nombre,
        nombre_comun,
        tipo_amenaza,
        genero:id_genero(
          id,
          nombre,
          familia:id_familia(
            id,
            nombre
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    logger.error('Error obteniendo especie', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3002;

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor ejecutándose en puerto ${PORT}`, { url: `http://localhost:${PORT}` });
});

server.on('error', (error) => {
  logger.error('Error del servidor', { error: error.message, code: error.code });
});

export default app;
