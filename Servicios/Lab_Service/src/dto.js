// DTO y validaciones para clasificación taxonómica
import { supabase, supabaseCatalog } from './supabase.js';

// Validar datos de clasificación taxonómica
export function validateClasificacionDTO(data) {
  const errors = [];
  
  // Validaciones requeridas
  if (!data.id_muestra || typeof data.id_muestra !== 'number') {
    errors.push('id_muestra es requerido y debe ser un número');
  }

  if (!data.id_especie || typeof data.id_especie !== 'number') {
    errors.push('id_especie es requerido y debe ser un número');
  }

  // Validar estado reproductivo
  const estadosReproductivos = [
    'Vegetativo', 
    'Floración', 
    'Fructificación', 
    'Floración y Fructificación', 
    'Estéril'
  ];
  if (data.estado_reproductivo && !estadosReproductivos.includes(data.estado_reproductivo)) {
    errors.push(`estado_reproductivo debe ser uno de: ${estadosReproductivos.join(', ')}`);
  }

  // Validar ID determinador (usuario que clasifica)
  if (!data.id_determinador || typeof data.id_determinador !== 'string') {
    errors.push('id_determinador es requerido y debe ser un UUID (string)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Crear objeto para inserción en clasificacion_herbario
export async function createClasificacionInsert(data, fotoFile = null) {
  let idFoto = null;

  // Si hay foto, crear registro en tabla archivos
  if (fotoFile) {
    const { bucketId, path, name, mime, size, userId } = fotoFile;
    
    const { data: archivoData, error: archivoError } = await supabase
      .from('archivos')
      .insert({
        bucket_id: bucketId,
        path: path,
        name: name,
        mime: mime,
        size: size,
        user_id: userId
      })
      .select('id')
      .single();

    if (archivoError) {
      console.error('Error creando registro de archivo:', archivoError);
      throw new Error('No se pudo registrar el archivo de la foto');
    }

    idFoto = archivoData.id;
  }

  const clasificacion = {
    id_muestra: data.id_muestra,
    id_especie: data.id_especie,
    id_foto: idFoto,
    id_determinador: data.id_determinador,
    estado: 'clasificado', // CORREGIDO: estado_clasificacion enum es 'clasificado' no 'clasificada'
    estado_reproductivo: data.estado_reproductivo || null
  };

  return clasificacion;
}

// Validar filtros para búsqueda de muestras
export function validateFiltrosMuestras(query) {
  const filtros = {};

  // Estado de muestra
  const estadosValidos = ['Pendiente', 'En análisis', 'Clasificada'];
  if (query.estado && estadosValidos.includes(query.estado)) {
    filtros.estado = query.estado;
  }

  // Conglomerado
  if (query.conglomerado) {
    const conglomeradoId = parseInt(query.conglomerado);
    if (!isNaN(conglomeradoId)) {
      filtros.conglomerado = conglomeradoId;
    }
  }

  // Rango de fechas
  if (query.fecha_desde) {
    const fechaDesde = new Date(query.fecha_desde);
    if (!isNaN(fechaDesde.getTime())) {
      filtros.fecha_desde = fechaDesde.toISOString().split('T')[0];
    }
  }

  if (query.fecha_hasta) {
    const fechaHasta = new Date(query.fecha_hasta);
    if (!isNaN(fechaHasta.getTime())) {
      filtros.fecha_hasta = fechaHasta.toISOString().split('T')[0];
    }
  }

  // Paginación
  const limit = parseInt(query.limit) || 20;
  const offset = parseInt(query.offset) || 0;
  
  filtros.limit = Math.min(limit, 100); // Máximo 100 registros
  filtros.offset = Math.max(offset, 0);

  return filtros;
}

// Buscar en taxonomía con autocompletado
export async function buscarTaxonomia(termino, tipo = 'especie') {
  try {
    let query;
    
    switch (tipo) {
      case 'familia':
        query = supabaseCatalog
          .from('familia')
          .select('id, nombre')
          .ilike('nombre', `%${termino}%`)
          .limit(10);
        break;

      case 'genero':
        query = supabaseCatalog
          .from('genero')
          .select(`
            id, 
            nombre,
            familia!inner(id, nombre)
          `)
          .ilike('nombre', `%${termino}%`)
          .limit(10);
        break;

      case 'especie':
      default:
        query = supabaseCatalog
          .from('especie')
          .select(`
            id, 
            nombre,
            nombre_comun,
            tipo_amenaza,
            genero!inner(
              id, 
              nombre,
              familia!inner(id, nombre)
            )
          `)
          .ilike('nombre', `%${termino}%`)
          .limit(10);
        break;
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`Error buscando ${tipo}:`, error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error(`Error en búsqueda taxonómica:`, e);
    return [];
  }
}