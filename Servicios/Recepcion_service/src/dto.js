// DTOs y validaciones para el servicio de recepción
// Schema v3.0: Sin evento_colección, relación directa con conglomerado

/**
 * Validar datos para recepción de paquete
 * Ya NO se usa evento_colección - solo id_conglomerado directo
 */
export function validatePaqueteDTO(body) {
  const errors = [];
  
  // Validar conglomerado (requerido)
  if (!body.id_conglomerado) {
    errors.push('id_conglomerado es requerido');
  }

  // Validar número de paquete (requerido)
  if (!body.num_paquete) {
    errors.push('num_paquete es requerido');
  }

  // Validar muestras (requerido, array no vacío)
  if (!body.muestras || !Array.isArray(body.muestras) || body.muestras.length === 0) {
    errors.push('muestras debe ser un array no vacío');
  } else {
    body.muestras.forEach((muestra, index) => {
      if (!muestra.num_individuo) {
        errors.push(`muestras[${index}].num_individuo es requerido`);
      }
      if (!muestra.colector) {
        errors.push(`muestras[${index}].colector es requerido`);
      }
      // fecha_coleccion es fecha única (no rango)
      if (muestra.fecha_coleccion && !isValidDate(muestra.fecha_coleccion)) {
        errors.push(`muestras[${index}].fecha_coleccion debe ser una fecha válida (YYYY-MM-DD)`);
      }
    });
  }

  // Validar estado (opcional, valores permitidos)
  if (body.estado && !['enviado', 'recibido', 'en_proceso'].includes(body.estado)) {
    errors.push('estado debe ser: enviado, recibido o en_proceso');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validar datos para actualización de estado de paquete
 */
export function validateActualizarEstadoDTO(body) {
  const errors = [];

  if (!body.num_paquete) {
    errors.push('num_paquete es requerido');
  }

  if (!body.estado) {
    errors.push('estado es requerido');
  }

  if (body.estado && !['enviado', 'recibido', 'en_proceso'].includes(body.estado)) {
    errors.push('estado debe ser: enviado, recibido o en_proceso');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper para validar fecha
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Crear objeto para inserción de paquete
 * Schema v3.0: Sin evento_colección, con id_conglomerado directo y estado
 */
export function createPaqueteInsert(body) {
  const { 
    id_conglomerado, 
    num_paquete, 
    cantidad_ejemplares, 
    fecha_envio, 
    fecha_recibido_herbario, 
    observaciones_generales,
    estado 
  } = body;
  
  return {
    paquete: {
      id_conglomerado: id_conglomerado, // Relación directa con conglomerado (NO evento_colección)
      num_paquete,
      cantidad_ejemplares: cantidad_ejemplares || body.muestras?.length,
      fecha_envio: fecha_envio || null,
      fecha_recibido_herbario: fecha_recibido_herbario || new Date().toISOString().split('T')[0],
      observaciones_generales: observaciones_generales || null,
      estado: estado || 'recibido' // Por defecto 'recibido' al crear desde recepción
    },
    muestras: body.muestras.map(muestra => ({
      num_individuo: muestra.num_individuo,
      colector: muestra.colector,
      num_coleccion: muestra.num_coleccion || null,
      observaciones: muestra.observaciones || null,
      fecha_coleccion: muestra.fecha_coleccion || null, // FECHA ÚNICA (no rango)
      id_subparcelas: muestra.id_subparcelas || null
    }))
  };
}

/**
 * Crear objeto para actualización de estado de paquete
 */
export function createActualizarEstadoUpdate(body) {
  return {
    num_paquete: body.num_paquete,
    estado: body.estado,
    observaciones_recepcion: body.observaciones_recepcion || null,
    fecha_actualizacion: new Date().toISOString()
  };
}