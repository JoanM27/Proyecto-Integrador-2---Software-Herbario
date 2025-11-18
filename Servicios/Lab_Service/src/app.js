import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  validateClasificacionDTO, 
  createClasificacionInsert, 
  validateFiltrosMuestras,
  buscarTaxonomia
} from './dto.js';
import { HerbarioLabService } from './herbarioLabService.js';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Logger
let logger;
try {
  const { createLogger } = await import('../../shared/logger/index.js');
  logger = createLogger('Lab_Service');
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

// Health check
app.get('/health', (req, res) => {
  logger.debug('Health check solicitado');
  res.json({ ok: true });
});

// ===== OBTENER MUESTRAS PENDIENTES (con lógica de priorización) =====

/**
 * GET /muestras/pendientes
 * Obtiene muestras pendientes de clasificación con priorización inteligente
 * @param {Object} req.query - Parámetros de consulta
 * @param {string} [req.query.conglomerado] - Filtro por conglomerado
 * @param {number} [req.query.limit=50] - Límite de resultados
 * @param {number} [req.query.offset=0] - Offset para paginación
 * @returns {Object} Muestras agrupadas por conglomerado con estadísticas
 */
app.get('/muestras/pendientes', async (req, res) => {
  try {
    // 1. VALIDACIÓN DE FILTROS (Lógica de Negocio)
    const filtros = validateFiltrosMuestras(req.query);
    
    // 2. OBTENER DATOS DEL SERVICIO DE GESTIÓN HERBARIO
    const result = await HerbarioLabService.obtenerMuestrasPendientes(filtros);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // 3. LÓGICA DE NEGOCIO: PRIORIZACIÓN Y AGRUPAMIENTO
    const muestras = result.data;

    // Calcular prioridad de cada muestra
    const muestrasConPrioridad = muestras.map(muestra => {
      let prioridad = 0;
      const diasDesdeRecepcion = Math.floor((new Date() - new Date(muestra.paquete.fecha_recibido_herbario)) / (1000 * 60 * 60 * 24));
      
      // Algoritmo de priorización (Lógica de Negocio)
      if (diasDesdeRecepcion > 30) prioridad += 50; // Muestras antiguas
      if (muestra.familia_identificada) prioridad += 20; // Ya tienen clasificación previa
      if (muestra.estado_muestra === 'en_proceso') prioridad += 30; // En proceso
      if (!muestra.observaciones || muestra.observaciones.trim() === '') prioridad -= 10; // Sin observaciones

      return {
        ...muestra,
        prioridad,
        dias_desde_recepcion: diasDesdeRecepcion,
        nivel_dificultad: determinarDificultadClasificacion(muestra),
        sugerencias_inicial: []
      };
    });

    // Agrupar por conglomerado y ordenar por prioridad
    const muestrasPorConglomerado = muestrasConPrioridad.reduce((acc, muestra) => {
      const conglomerado = muestra.paquete.evento_coleccion.conglomerado;
      const key = conglomerado.codigo;
      
      if (!acc[key]) {
        acc[key] = {
          conglomerado: {
            codigo: conglomerado.codigo,
            municipio: conglomerado.municipio.nombre,
            ubicacion: `${conglomerado.latitud_dec}, ${conglomerado.longitud_dec}`,
            prioridad_promedio: 0
          },
          muestras: [],
          estadisticas: {
            total: 0,
            alta_prioridad: 0,
            con_identificacion_previa: 0
          }
        };
      }
      
      acc[key].muestras.push(muestra);
      acc[key].estadisticas.total++;
      if (muestra.prioridad > 40) acc[key].estadisticas.alta_prioridad++;
      if (muestra.familia_identificada) acc[key].estadisticas.con_identificacion_previa++;
      
      return acc;
    }, {});

    // Calcular prioridad promedio por conglomerado
    Object.values(muestrasPorConglomerado).forEach(grupo => {
      grupo.conglomerado.prioridad_promedio = Math.round(
        grupo.muestras.reduce((sum, m) => sum + m.prioridad, 0) / grupo.muestras.length
      );
      // Ordenar muestras por prioridad
      grupo.muestras.sort((a, b) => b.prioridad - a.prioridad);
    });

    // 4. ESTADÍSTICAS AGREGADAS (Lógica de Negocio)
    const estadisticas = {
      total_muestras: muestras.length,
      promedio_dias_pendientes: muestras.length > 0 
        ? Math.round(muestrasConPrioridad.reduce((sum, m) => sum + m.dias_desde_recepcion, 0) / muestras.length)
        : 0,
      distribucion_dificultad: calcularDistribucionDificultad(muestrasConPrioridad),
      conglomerados_activos: Object.keys(muestrasPorConglomerado).length
    };

    res.json({ 
      muestras_pendientes: Object.values(muestrasPorConglomerado).sort((a, b) => 
        b.conglomerado.prioridad_promedio - a.conglomerado.prioridad_promedio
      ),
      estadisticas,
      filtros_aplicados: filtros
    });
  } catch (e) {
    console.error('Error en GET /muestras/pendientes:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== OBTENER CLASIFICACIÓN POR ID DE MUESTRA =====

/**
 * GET /clasificaciones/muestra/:idMuestra
 * Obtiene la clasificación más reciente de una muestra específica
 * @param {string} idMuestra - ID de la muestra
 * @returns {Object} Clasificación de la muestra
 */
app.get('/clasificaciones/muestra/:idMuestra', async (req, res) => {
  try {
    const { idMuestra } = req.params;
    
    logger.info(`Buscando clasificación para muestra ${idMuestra}`);
    
    const { data, error } = await supabase
      .from('clasificacion_herbario')
      .select('*')
      .eq('id_muestra', idMuestra)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      logger.error('Error buscando clasificación:', error);
      return res.status(500).json({ error: 'Error buscando clasificación' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'No se encontró clasificación para esta muestra' });
    }
    
    logger.info(`Clasificación encontrada: ID ${data.id}, Estado: ${data.estado}`);
    res.json(data);
    
  } catch (e) {
    logger.error('Error en GET /clasificaciones/muestra/:idMuestra:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== REGISTRAR CLASIFICACIÓN (con validaciones y algoritmos) =====

/**
 * POST /clasificaciones
 * Registra una nueva clasificación taxonómica con validaciones y algoritmos de negocio
 * @param {Object} req.body - Datos de la clasificación
 * @param {number} req.body.id_muestra_botanica - ID de la muestra
 * @param {string} req.body.familia_final - Familia identificada
 * @param {string} req.body.genero_final - Género identificado
 * @param {string} req.body.especie_final - Especie identificada
 * @param {string} [req.body.estado_reproductivo] - Estado reproductivo
 * @param {string} [req.body.observaciones_clasificacion] - Observaciones
 * @returns {Object} Resultado de la clasificación creada
 */
app.post('/clasificaciones', async (req, res) => {
  try {
    // 1. VALIDACIÓN DE DATOS (Lógica de Negocio)
    const validation = validateClasificacionDTO(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Datos inválidos', details: validation.errors });
    }

    // 2. OBTENER MUESTRA PARA VALIDACIÓN
    const muestraResult = await HerbarioLabService.obtenerMuestra(req.body.id_muestra_botanica);
    if (!muestraResult.success) {
      return res.status(404).json({ error: 'Muestra no encontrada' });
    }

    const muestra = muestraResult.data;
    if (muestra.clasificacion_taxonomica && muestra.clasificacion_taxonomica.length > 0) {
      return res.status(409).json({ error: 'La muestra ya tiene clasificaciones registradas' });
    }

    // 3. VALIDACIÓN TAXONÓMICA BÁSICA
    if (!req.body.familia_final || !req.body.genero_final || !req.body.especie_final) {
      return res.status(400).json({ 
        error: 'Se requiere familia, género y especie para la clasificación'
      });
    }

    // 4. CÁLCULO DE CONFIANZA (Algoritmo de Negocio)
    const nivelConfianza = calcularNivelConfianza(req.body, muestra);
    
    // 5. CREAR OBJETO DE CLASIFICACIÓN
    const clasificacionData = createClasificacionInsert({
      ...req.body,
      nivel_confianza: nivelConfianza,
      fecha_clasificacion: new Date().toISOString(),
      observaciones_algoritmo: generarObservacionesAlgoritmo(req.body, muestra)
    });

    // 6. GUARDAR EN GESTIÓN HERBARIO
    const clasificacionResult = await HerbarioLabService.crearClasificacion(clasificacionData);
    if (!clasificacionResult.success) {
      // MANEJO DE ERRORES DE TRIGGERS
      const error = clasificacionResult.error;
      
      // El trigger validar_clasificacion_unica lanza este error si hay duplicado
      if (error && (error.includes('ya tiene una clasificación en proceso') || 
                     error.includes('integrity_constraint_violation'))) {
        logger.warn('Clasificación duplicada detectada por trigger', { 
          id_muestra: req.body.id_muestra_botanica 
        });
        return res.status(409).json({ 
          error: 'Clasificación duplicada',
          mensaje: 'Esta muestra ya tiene una clasificación en proceso. Complete o elimine la clasificación existente antes de crear una nueva.',
          detalle: error
        });
      }
      
      return res.status(500).json({ error: clasificacionResult.error });
    }

    // 7. ACTUALIZAR ESTADO DE MUESTRA
    const updateData = {
      estado_muestra: 'clasificada',
      familia_identificada: req.body.familia,
      genero_identificado: req.body.genero,
      especie_identificada: req.body.especie,
      fecha_actualizacion: new Date().toISOString()
    };

    const updateResult = await HerbarioLabService.actualizarMuestra(req.body.id_muestra_botanica, updateData);
    if (!updateResult.success) {
      console.error('Error actualizando muestra:', updateResult.error);
      // No fallar la operación, solo loguear
    }

    // 8. GENERAR RECOMENDACIONES PARA SIGUIENTE CLASIFICACIÓN
    const recomendaciones = await generarRecomendacionesSiguiente(req.body);

    res.status(201).json({
      ok: true,
      clasificacion_id: clasificacionResult.data.id,
      muestra_id: req.body.id_muestra_botanica,
      nivel_confianza: nivelConfianza,
      recomendaciones,
      mensaje: 'Clasificación registrada exitosamente'
    });
  } catch (e) {
    console.error('Error en POST /clasificaciones:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== ASISTENTE DE CLASIFICACIÓN (búsquedas inteligentes) =====
app.get('/asistente/buscar', async (req, res) => {
  try {
    const { familia, genero, especie, region, tipo_busqueda = 'exacta' } = req.query;

    if (!familia && !genero && !especie) {
      return res.status(400).json({ error: 'Se requiere al menos un criterio de búsqueda' });
    }

    // 1. BÚSQUEDA PRINCIPAL
    const criterios = { familia, genero, especie };
    const resultados = await HerbarioLabService.buscarTaxonomia(criterios);
    
    if (!resultados.success) {
      return res.status(500).json({ error: resultados.error });
    }

    // 2. ALGORITMOS DE SUGERENCIAS (Lógica de Negocio)
    let sugerencias = resultados.data;

    if (tipo_busqueda === 'difusa' && sugerencias.length < 5) {
      // Búsqueda difusa si hay pocos resultados exactos
      const sugerenciasDifusas = await buscarSugerenciasDifusas({ familia, genero, especie });
      sugerencias = [...sugerencias, ...sugerenciasDifusas];
    }

    // 3. ENRIQUECIMIENTO CON DATOS GEOGRÁFICOS
    if (region) {
      sugerencias = sugerencias.filter(s => 
        s.distribuciones_geograficas?.includes(region) || 
        !s.distribuciones_geograficas
      );
    }

    // 4. CÁLCULO DE SIMILITUD Y RANKING
    sugerencias = sugerencias.map(sugerencia => ({
      ...sugerencia,
      similitud: 0.85, // Valor por defecto para MVP
      frecuencia_clasificacion: obtenerFrecuenciaClasificacion(sugerencia.id)
    })).sort((a, b) => b.similitud - a.similitud);

    res.json({
      resultados: sugerencias.slice(0, 20), // Limitar a top 20
      criterios_busqueda: criterios,
      tipo_busqueda,
      total_encontrados: sugerencias.length
    });
  } catch (e) {
    console.error('Error en GET /asistente/buscar:', e);
    res.status(500).json({ error: 'Error en búsqueda asistida' });
  }
});

// ===== ESTADÍSTICAS DE LABORATORIO =====
app.get('/estadisticas', async (req, res) => {
  try {
    // Consultar muestras botánicas con sus relaciones completas
    const { data: muestras, error: errorMuestras } = await supabase
      .from('muestra_botanica')
      .select(`
        id,
        id_paquete,
        paquete:paquete(
          id,
          id_conglomerado,
          conglomerado:conglomerado(
            id,
            id_municipio,
            municipio:municipio(
              id,
              nombre,
              departamento:departamento(
                id,
                nombre,
                region:region(nombre)
              )
            )
          )
        )
      `);

    if (errorMuestras) {
      console.error('❌ Error obteniendo muestras:', errorMuestras);
      throw errorMuestras;
    }

    // Consultar clasificaciones con taxonomía completa - COMPLETADO Y FIRMADO
    const { data: clasificaciones, error: errorClasif } = await supabase
      .from('clasificacion_herbario')
      .select(`
        id,
        id_muestra,
        id_especie,
        estado,
        especie:especie(
          id,
          nombre,
          tipo_amenaza,
          genero:genero(
            id,
            nombre,
            familia:familia(nombre)
          )
        )
      `)
      .in('estado', ['completado', 'firmado']);

    if (errorClasif) {
      console.error('❌ Error obteniendo clasificaciones:', errorClasif);
      throw errorClasif;
    }

    // Filtrar solo clasificaciones con especie asignada (para ser consistente con Herbario Digital)
    const clasificacionesConEspecie = clasificaciones?.filter(c => c.id_especie !== null && c.especie !== null) || [];
    console.log(`🔬 Clasificaciones con especie: ${clasificacionesConEspecie.length}`);

    // Crear set de IDs de muestras que tienen clasificación con especie
    const muestrasConEspecieIds = new Set(clasificacionesConEspecie.map(c => c.id_muestra));

    // Filtrar muestras que tienen clasificación con especie
    const muestrasClasificadas = muestras?.filter(m => muestrasConEspecieIds.has(m.id)) || [];
    console.log(`✅ Muestras clasificadas (con especie): ${muestrasClasificadas.length}`);

    // Agrupar por departamento
    const departamentosMap = new Map();
    const regionesMap = new Map();
    
    muestrasClasificadas.forEach(muestra => {
      const dept = muestra.paquete?.conglomerado?.municipio?.departamento;
      const region = dept?.region;
      
      if (dept) {
        const deptNombre = dept.nombre;
        if (!departamentosMap.has(deptNombre)) {
          departamentosMap.set(deptNombre, {
            name: deptNombre,
            specimens: 0,
            species: new Set(),
            region: region?.nombre
          });
        }
        const deptData = departamentosMap.get(deptNombre);
        deptData.specimens++;
      }
      
      if (region) {
        const regionNombre = region.nombre;
        if (!regionesMap.has(regionNombre)) {
          regionesMap.set(regionNombre, {
            name: regionNombre,
            specimens: 0,
            species: new Set(),
            families: new Set(),
            departments: new Set()
          });
        }
        const regionData = regionesMap.get(regionNombre);
        regionData.specimens++;
        if (dept) regionData.departments.add(dept.nombre);
      }
    });

    // Agregar especies a departamentos y regiones (solo clasificaciones con especie)
    clasificacionesConEspecie.forEach(clasif => {
      const muestra = muestrasClasificadas.find(m => m.id === clasif.id_muestra);
      const dept = muestra?.paquete?.conglomerado?.municipio?.departamento;
      const region = dept?.region;
      const especie = clasif.especie;
      
      if (dept && especie) {
        const deptData = departamentosMap.get(dept.nombre);
        if (deptData && especie.nombre) {
          deptData.species.add(especie.nombre);
        }
      }
      
      if (region && especie) {
        const regionData = regionesMap.get(region.nombre);
        if (regionData) {
          if (especie.nombre) regionData.species.add(especie.nombre);
          if (especie.genero?.familia?.nombre) regionData.families.add(especie.genero.familia.nombre);
        }
      }
    });

    // Convertir departamentos a array y calcular porcentajes
    const totalMuestras = muestrasClasificadas.length;
    const departamentos = Array.from(departamentosMap.values())
      .map(d => ({
        name: d.name,
        specimens: d.specimens,
        species: d.species.size,
        percentage: totalMuestras > 0 ? Math.round((d.specimens / totalMuestras) * 100) : 0
      }))
      .sort((a, b) => b.specimens - a.specimens)
      .slice(0, 10); // Top 10 departamentos

    // Normalizar nombres de regiones (quitar prefijo "Región ")
    const normalizarRegion = (nombre) => {
      if (!nombre) return null;
      return nombre.replace(/^Región\s+/i, '').trim();
    };

    // Asegurar que todas las regiones estén presentes
    const regionesBase = ['Andina', 'Caribe', 'Pacífica', 'Orinoquía', 'Amazonía'];
    const regiones = regionesBase.map(nombreBase => {
      // Buscar en el mapa con diferentes variantes del nombre
      let data = regionesMap.get(nombreBase) || 
                 regionesMap.get(`Región ${nombreBase}`) ||
                 Array.from(regionesMap.entries()).find(([key]) => 
                   normalizarRegion(key) === nombreBase
                 )?.[1];
      
      if (data) {
        return {
          name: nombreBase,
          departments: data.departments.size,
          specimens: data.specimens,
          species: data.species.size,
          families: data.families.size,
          percentage: totalMuestras > 0 ? Math.round((data.specimens / totalMuestras) * 100) : 0
        };
      }
      return {
        name: nombreBase,
        departments: 0,
        specimens: 0,
        species: 0,
        families: 0,
        percentage: 0
      };
    });

    // Calcular proporción de especies por grado de amenaza
    const amenazaMap = new Map();
    
    clasificacionesConEspecie.forEach(c => {
      const tipoAmenaza = c.especie?.tipo_amenaza || 'No Amenazado';
      amenazaMap.set(tipoAmenaza, (amenazaMap.get(tipoAmenaza) || 0) + 1);
    });

    const especiesPorAmenaza = Array.from(amenazaMap.entries())
      .map(([categoria, count]) => ({
        categoria,
        count,
        porcentaje: clasificacionesConEspecie.length > 0 
          ? parseFloat(((count / clasificacionesConEspecie.length) * 100).toFixed(1))
          : 0
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`🚨 Especies por grado de amenaza:`, especiesPorAmenaza);

    const resultado = {
      departamentos,
      regiones,
      total_especimenes: totalMuestras,
      total_clasificaciones: clasificacionesConEspecie.length,
      especies_amenazadas: especiesPorAmenaza
    };

    console.log('✅ Estadísticas calculadas:', {
      departamentos: departamentos.length,
      regiones: regiones.length,
      totalMuestrasClasificadas: totalMuestras,
      totalClasificacionesConEspecie: clasificacionesConEspecie.length
    });
    
    res.json(resultado);
  } catch (e) {
    console.error('❌ Error en GET /estadisticas:', e);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas',
      details: e.message
    });
  }
});

// Endpoint para estadísticas por ubicación y nivel taxonómico
app.get('/estadisticas/taxonomia', async (req, res) => {
  try {
    const { ubicacion, tipo, nivel } = req.query;

    if (!ubicacion || !tipo || !nivel) {
      return res.status(400).json({ 
        error: 'Parámetros requeridos: ubicacion, tipo (departamento/region), nivel (familia/genero)' 
      });
    }

    console.log(`🔍 Estadísticas taxonomía: ${ubicacion} (${tipo}) - nivel: ${nivel}`);

    // Consultar muestras con clasificaciones - SOLO COMPLETADO Y FIRMADO
    const { data: muestras, error: errorMuestras } = await supabase
      .from('muestra_botanica')
      .select(`
        id,
        clasificacion:clasificacion_herbario!inner(
          id,
          id_especie,
          estado,
          especie:especie(
            nombre,
            genero:genero(
              nombre,
              familia:familia(nombre)
            )
          )
        ),
        paquete:paquete(
          conglomerado:conglomerado(
            municipio:municipio(
              nombre,
              departamento:departamento(
                nombre,
                region:region(nombre)
              )
            )
          )
        )
      `)
      .in('clasificacion.estado', ['completado', 'firmado'])
      .not('clasificacion.id_especie', 'is', null);

    if (errorMuestras) {
      console.error('❌ Error obteniendo muestras:', errorMuestras);
      throw errorMuestras;
    }

    // Filtrar por ubicación
    const normalizarRegion = (nombre) => {
      if (!nombre) return null;
      return nombre.replace(/^Región\s+/i, '').trim();
    };

    const muestrasFiltradas = muestras?.filter(m => {
      const dept = m.paquete?.conglomerado?.municipio?.departamento;
      const region = dept?.region;
      
      if (tipo === 'departamento') {
        return dept?.nombre === ubicacion;
      } else if (tipo === 'region') {
        // Comparar nombres normalizados de región
        const regionNormalizada = normalizarRegion(region?.nombre);
        return regionNormalizada === ubicacion || region?.nombre === ubicacion || region?.nombre === `Región ${ubicacion}`;
      }
      return false;
    }) || [];

    console.log(`📊 Muestras filtradas: ${muestrasFiltradas.length}`);

    // Contar por nivel taxonómico
    const taxonMap = new Map();
    
    muestrasFiltradas.forEach(muestra => {
      // Una muestra puede tener múltiples clasificaciones o ninguna
      const clasificaciones = Array.isArray(muestra.clasificacion) ? muestra.clasificacion : (muestra.clasificacion ? [muestra.clasificacion] : []);
      
      clasificaciones.forEach(clasif => {
        // Filtrar solo clasificaciones con especie válida (id_especie no null)
        if (!clasif || !clasif.id_especie || !clasif.especie) {
          return;
        }
        
        const especie = clasif.especie;
        
        let taxonNombre;
        if (nivel === 'familia') {
          taxonNombre = especie.genero?.familia?.nombre;
        } else if (nivel === 'genero') {
          taxonNombre = especie.genero?.nombre;
        }
        
        if (taxonNombre) {
          taxonMap.set(taxonNombre, (taxonMap.get(taxonNombre) || 0) + 1);
        }
      });
    });

    console.log(`🔬 ${nivel}(s) únicos encontrados: ${taxonMap.size}`);

    // Convertir a array y calcular porcentajes
    const total = muestrasFiltradas.length;
    const resultado = Array.from(taxonMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    console.log(`✅ Top ${resultado.length} ${nivel}(s) en ${ubicacion}`);

    res.json(resultado);
  } catch (e) {
    console.error('❌ Error en GET /estadisticas/taxonomia:', e);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas taxonómicas',
      details: e.message
    });
  }
});

// ===== FUNCIONES AUXILIARES (Lógica de Negocio) =====

function calcularEstadisticasPorDepartamentoSimple(especimenes, clasificaciones) {
  const departamentos = {};
  
  // Crear mapa de especies por especimen
  const especiePorEspecimen = new Map();
  clasificaciones.forEach(clasif => {
    if (clasif.especie) {
      especiePorEspecimen.set(clasif.especimen_id, clasif.especie);
    }
  });
  
  especimenes.forEach(esp => {
    if (!esp.departamento) return;
    
    const deptNombre = esp.departamento;
    
    if (!departamentos[deptNombre]) {
      departamentos[deptNombre] = {
        name: deptNombre,
        specimens: 0,
        species: new Set()
      };
    }
    
    departamentos[deptNombre].specimens++;
    
    const especie = especiePorEspecimen.get(esp.especimen_id);
    if (especie) departamentos[deptNombre].species.add(especie);
  });

  const total = Object.values(departamentos).reduce((sum, d) => sum + d.specimens, 0);
  
  const resultado = Object.values(departamentos)
    .map(d => ({
      name: d.name,
      specimens: d.specimens,
      species: d.species.size,
      percentage: total > 0 ? Math.round((d.specimens / total) * 100) : 0
    }))
    .sort((a, b) => b.specimens - a.specimens)
    .slice(0, 6);

  // Si no hay datos, retornar estructura vacía
  if (resultado.length === 0) {
    return [
      { name: 'Sin datos', specimens: 0, species: 0, percentage: 0 }
    ];
  }

  return resultado;
}

function calcularEstadisticasPorRegionSimple(especimenes, clasificaciones) {
  const regiones = {
    'Andina': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Caribe': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Pacífica': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Orinoquía': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Amazonía': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() }
  };

  // Crear mapas de clasificación
  const especiePorEspecimen = new Map();
  const familiaPorEspecimen = new Map();
  clasificaciones.forEach(clasif => {
    if (clasif.especie) especiePorEspecimen.set(clasif.especimen_id, clasif.especie);
    if (clasif.familia) familiaPorEspecimen.set(clasif.especimen_id, clasif.familia);
  });

  especimenes.forEach(esp => {
    if (!esp.departamento) return;
    
    const deptNombre = esp.departamento;
    const region = obtenerRegionDeDepartamento(deptNombre);
    
    if (regiones[region]) {
      regiones[region].specimens++;
      regiones[region].departments.add(deptNombre);
      
      const especie = especiePorEspecimen.get(esp.especimen_id);
      const familia = familiaPorEspecimen.get(esp.especimen_id);
      
      if (especie) regiones[region].species.add(especie);
      if (familia) regiones[region].families.add(familia);
    }
  });

  const total = Object.values(regiones).reduce((sum, r) => sum + r.specimens, 0);

  return Object.entries(regiones).map(([name, data]) => ({
    name,
    departments: data.departments.size,
    specimens: data.specimens,
    species: data.species.size,
    families: data.families.size,
    percentage: total > 0 ? Math.round((data.specimens / total) * 100) : 0
  }));
}

function calcularEstadisticasPorDepartamento(especimenes) {
  const departamentos = {};
  
  especimenes.forEach(esp => {
    if (!esp.paquete || !esp.paquete.conglomerado || !esp.paquete.conglomerado.departamento) return;
    
    const deptNombre = esp.paquete.conglomerado.departamento.nombre;
    
    if (!departamentos[deptNombre]) {
      departamentos[deptNombre] = {
        name: deptNombre,
        specimens: 0,
        species: new Set()
      };
    }
    
    departamentos[deptNombre].specimens++;
    
    if (esp.clasificacion && esp.clasificacion.length > 0) {
      const especie = esp.clasificacion[0].especie;
      if (especie) departamentos[deptNombre].species.add(especie);
    }
  });

  const total = Object.values(departamentos).reduce((sum, d) => sum + d.specimens, 0);
  
  return Object.values(departamentos)
    .map(d => ({
      name: d.name,
      specimens: d.specimens,
      species: d.species.size,
      percentage: total > 0 ? Math.round((d.specimens / total) * 100) : 0
    }))
    .sort((a, b) => b.specimens - a.specimens)
    .slice(0, 6);
}

function calcularEstadisticasPorRegion(especimenes) {
  const regiones = {
    'Andina': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Caribe': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Pacífica': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Orinoquía': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() },
    'Amazonía': { specimens: 0, species: new Set(), families: new Set(), departments: new Set() }
  };

  especimenes.forEach(esp => {
    if (!esp.paquete || !esp.paquete.conglomerado || !esp.paquete.conglomerado.departamento) return;
    
    const deptNombre = esp.paquete.conglomerado.departamento.nombre;
    const region = obtenerRegionDeDepartamento(deptNombre);
    
    if (regiones[region]) {
      regiones[region].specimens++;
      regiones[region].departments.add(deptNombre);
      
      if (esp.clasificacion && esp.clasificacion.length > 0) {
        const clasif = esp.clasificacion[0];
        if (clasif.especie) regiones[region].species.add(clasif.especie);
        if (clasif.familia) regiones[region].families.add(clasif.familia);
      }
    }
  });

  const total = Object.values(regiones).reduce((sum, r) => sum + r.specimens, 0);

  return Object.entries(regiones).map(([name, data]) => ({
    name,
    departments: data.departments.size,
    specimens: data.specimens,
    species: data.species.size,
    families: data.families.size,
    percentage: total > 0 ? Math.round((data.specimens / total) * 100) : 0
  }));
}

function calcularEstadisticasTaxonomicas(clasificaciones, nivel) {
  const conteo = {};
  
  clasificaciones.forEach(clasif => {
    const valor = nivel === 'familia' ? clasif.familia : clasif.genero;
    if (valor) {
      conteo[valor] = (conteo[valor] || 0) + 1;
    }
  });

  const total = Object.values(conteo).reduce((sum, val) => sum + val, 0);

  return Object.entries(conteo)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function obtenerRegionDeDepartamento(departamento) {
  const regionMap = {
    'Cundinamarca': 'Andina',
    'Boyacá': 'Andina',
    'Antioquia': 'Andina',
    'Santander': 'Andina',
    'Tolima': 'Andina',
    'Huila': 'Andina',
    'Caldas': 'Andina',
    'Risaralda': 'Andina',
    'Quindío': 'Andina',
    'Norte de Santander': 'Andina',
    'Atlántico': 'Caribe',
    'Bolívar': 'Caribe',
    'Cesar': 'Caribe',
    'Córdoba': 'Caribe',
    'La Guajira': 'Caribe',
    'Magdalena': 'Caribe',
    'Sucre': 'Caribe',
    'Valle del Cauca': 'Pacífica',
    'Cauca': 'Pacífica',
    'Nariño': 'Pacífica',
    'Chocó': 'Pacífica',
    'Meta': 'Orinoquía',
    'Casanare': 'Orinoquía',
    'Arauca': 'Orinoquía',
    'Vichada': 'Orinoquía',
    'Amazonas': 'Amazonía',
    'Caquetá': 'Amazonía',
    'Guainía': 'Amazonía',
    'Guaviare': 'Amazonía',
    'Putumayo': 'Amazonía',
    'Vaupés': 'Amazonía'
  };

  return regionMap[departamento] || 'Andina';
}

/**
 * Determina el nivel de dificultad para clasificar una muestra basado en varios factores
 * @param {Object} muestra - Objeto de muestra botánica
 * @returns {string} Nivel de dificultad ('Fácil', 'Moderada', 'Difícil')
 */
function determinarDificultadClasificacion(muestra) {
  let puntos = 0;
  
  // Factores que aumentan dificultad
  if (!muestra.familia_identificada) puntos += 30;
  if (!muestra.genero_identificado) puntos += 20;
  if (!muestra.observaciones || muestra.observaciones.length < 10) puntos += 15;
  
  // Factores que disminuyen dificultad
  if (muestra.familia_identificada && muestra.genero_identificado) puntos -= 25;
  if (muestra.observaciones && muestra.observaciones.length > 50) puntos -= 10;
  
  if (puntos < 20) return 'Fácil';
  if (puntos < 40) return 'Moderada';
  return 'Difícil';
}

function calcularDistribucionDificultad(muestras) {
  const distribucion = { 'Fácil': 0, 'Moderada': 0, 'Difícil': 0 };
  muestras.forEach(m => distribucion[m.nivel_dificultad]++);
  return distribucion;
}

/**
 * Calcula el nivel de confianza de una clasificación basado en varios factores
 * @param {Object} clasificacion - Datos de la clasificación
 * @param {Object} muestra - Datos de la muestra
 * @returns {number} Nivel de confianza (0-100)
 */
function calcularNivelConfianza(clasificacion, muestra) {
  let confianza = 50; // Base
  
  // Factores que aumentan confianza
  if (clasificacion.estado_reproductivo) confianza += 15;
  if (clasificacion.observaciones_clasificacion && clasificacion.observaciones_clasificacion.length > 20) confianza += 10;
  if (muestra.familia_identificada === clasificacion.familia) confianza += 20;
  
  // Limitar entre 0 y 100
  return Math.max(0, Math.min(100, confianza));
}

function generarObservacionesAlgoritmo(clasificacion, muestra) {
  const observaciones = [];
  
  if (muestra.familia_identificada && muestra.familia_identificada !== clasificacion.familia) {
    observaciones.push(`Discrepancia con identificación previa: ${muestra.familia_identificada} → ${clasificacion.familia}`);
  }
  
  if (clasificacion.nivel_confianza < 70) {
    observaciones.push('Clasificación requiere revisión por nivel de confianza bajo');
  }
  
  return observaciones.join('; ');
}

/**
 * Genera recomendaciones para la siguiente clasificación basada en la actual
 * @param {Object} clasificacionActual - Datos de la clasificación actual
 * @returns {Object} Recomendaciones para próximas clasificaciones
 */
async function generarRecomendacionesSiguiente(clasificacionActual) {
  // Lógica para sugerir próximas muestras similares o relacionadas
  return {
    muestras_similares: `Buscar muestras de la familia ${clasificacionActual.familia}`,
    areas_enfoque: ['Revisar clasificaciones con baja confianza', 'Priorizar muestras antiguas']
  };
}

async function buscarSugerenciasDifusas(criterios) {
  // Implementar búsqueda difusa usando algoritmos de similitud
  return []; // Placeholder
}

function obtenerFrecuenciaClasificacion(especieId) {
  // Retornar qué tan frecuentemente se clasifica esta especie
  return Math.floor(Math.random() * 100); // Placeholder
}

function calcularProductividad(periodo) {
  // Calcular clasificaciones por día/semana
  return { clasificaciones_por_dia: 15 }; // Placeholder
}

function calcularTiempoPromedioClasificacion(periodo) {
  return { minutos: 45 }; // Placeholder
}

async function calcularDistribucionConfianza(periodo) {
  return { alta: 60, media: 25, baja: 15 }; // Placeholder
}

async function calcularTendenciasClasificacion(periodo) {
  return { tendencia: 'creciente', porcentaje: 12 }; // Placeholder
}

// ===== ENDPOINT PARA HERBARIO DIGITAL - MUESTRAS CLASIFICADAS =====
app.get('/muestras/clasificadas', async (req, res) => {
  try {
    // Consultar muestras con clasificaciones completadas o firmadas
    const { data: clasificaciones, error } = await supabase
      .from('clasificacion_herbario')
      .select(`
        id,
        id_muestra,
        id_especie,
        id_foto,
        estado,
        estado_reproductivo,
        muestra:muestra_botanica(
          id,
          num_individuo,
          colector,
          num_coleccion,
          observaciones,
          fecha_coleccion,
          id_subparcelas,
          paquete:paquete(
            id,
            num_paquete,
            conglomerado:conglomerado(
              codigo,
              municipio:municipio(
                nombre,
                departamento:departamento(nombre)
              )
            )
          )
        ),
        especie:especie(
          id,
          nombre,
          nombre_comun,
          genero:genero(
            id,
            nombre,
            familia:familia(nombre)
          )
        )
      `)
      .in('estado', ['completado', 'firmado', 'clasificado'])
      .not('id_especie', 'is', null);

    if (error) {
      console.error('❌ Error obteniendo clasificaciones:', error);
      throw error;
    }

    // Transformar datos al formato esperado por el frontend
    const muestrasClasificadas = clasificaciones?.map(clasif => {
      const muestra = clasif.muestra;
      const especie = clasif.especie;
      const genero = especie?.genero;
      const familia = genero?.familia;
      
      // Construir nombre científico
      let nombreCientifico = '';
      if (genero?.nombre && especie?.nombre) {
        nombreCientifico = `${genero.nombre} ${especie.nombre}`;
      } else if (especie?.nombre) {
        nombreCientifico = especie.nombre;
      }

      // Construir ubicación
      let ubicacion = '';
      const municipio = muestra?.paquete?.conglomerado?.municipio;
      if (municipio) {
        ubicacion = `${municipio.departamento?.nombre || ''}, ${municipio.nombre || ''}`.trim();
        if (ubicacion.startsWith(',')) ubicacion = ubicacion.substring(1).trim();
      }

      return {
        id: muestra?.id,
        codigo: `${muestra?.paquete?.num_paquete || 'N/A'}-${muestra?.num_individuo || '?'}`,
        nombre_cientifico: nombreCientifico || null,
        nombre_comun: especie?.nombre_comun,
        familia: familia?.nombre,
        genero: genero?.nombre,
        especie: especie?.nombre,
        colector: muestra?.colector,
        num_coleccion: muestra?.num_coleccion,
        fecha_coleccion: muestra?.fecha_coleccion,
        ubicacion,
        conglomerado: muestra?.paquete?.conglomerado?.codigo,
        observaciones: muestra?.observaciones,
        estado_clasificacion: clasif.estado,
        estado_reproductivo: clasif.estado_reproductivo,
        id_foto: clasif.id_foto,
        id_clasificacion: clasif.id
      };
    }) || [];

    console.log(`📊 Muestras transformadas: ${muestrasClasificadas.length}`);
    
    res.json(muestrasClasificadas);
  } catch (e) {
    console.error('❌ Error en GET /muestras/clasificadas:', e);
    res.status(500).json({ 
      error: 'Error obteniendo muestras clasificadas',
      details: e.message
    });
  }
});

// Instalar axios y configurar
const port = process.env.PORT || 3005;
app.listen(port, () => {
  logger.info(`Servidor ejecutándose en puerto ${port}`, { 
    url: `http://localhost:${port}`,
    gestionHerbarioUrl: process.env.GESTION_HERBARIO_URL || 'http://localhost:3002'
  });
});

export default app;