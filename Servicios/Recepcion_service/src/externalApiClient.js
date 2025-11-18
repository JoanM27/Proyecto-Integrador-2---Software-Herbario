/**
 * Cliente para comunicación con el Servicio Externo API
 * Este módulo se encarga de obtener datos de campo (conglomerados, colecciones, envíos)
 * desde la base de datos externa
 */

import fetch from 'node-fetch';

export class ExternalApiClient {
  constructor(baseUrl = 'http://localhost:4000/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Método genérico para realizar peticiones HTTP
   */
  async _fetch(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en petición a ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== CONGLOMERADOS ====================

  /**
   * Buscar conglomerado por código
   * @param {string} codigo - Código del conglomerado (ej: "000001", "1")
   * @returns {Promise<Object>} Datos del conglomerado
   */
  async buscarConglomeradoPorCodigo(codigo) {
    const result = await this._fetch(`/conglomerados/${codigo}`);
    
    if (!result.success || !result.data) {
      throw new Error('Conglomerado no encontrado en el servicio externo');
    }

    return result.data;
  }

  /**
   * Obtener subparcelas de un conglomerado
   * @param {string} codigo - Código del conglomerado
   * @returns {Promise<Array>} Lista de subparcelas
   */
  async obtenerSubparcelasPorConglomerado(codigo) {
    const result = await this._fetch(`/conglomerados/${codigo}/subparcelas`);
    
    if (!result.success) {
      throw new Error('Error al obtener subparcelas');
    }

    return result.data || [];
  }

  // ==================== COLECCIONES BOTÁNICAS ====================

  /**
   * Obtener colecciones botánicas de un conglomerado
   * @param {string} codigoConglomerado - Código del conglomerado
   * @returns {Promise<Array>} Lista de colecciones
   */
  async obtenerColeccionesPorConglomerado(codigoConglomerado) {
    const result = await this._fetch(`/colecciones/conglomerado/${codigoConglomerado}`);
    
    if (!result.success) {
      throw new Error('Error al obtener colecciones');
    }

    return result.data || [];
  }

  /**
   * Obtener una colección específica por ID
   * @param {string} idColeccion - UUID de la colección
   * @returns {Promise<Object>} Datos de la colección
   */
  async obtenerColeccionPorId(idColeccion) {
    const result = await this._fetch(`/colecciones/${idColeccion}`);
    
    if (!result.success || !result.data) {
      throw new Error('Colección no encontrada');
    }

    return result.data;
  }

  // ==================== ENVÍOS DE MUESTRAS ====================

  /**
   * Buscar envío por número de paquete
   * IMPORTANTE: Este es el método principal para buscar paquetes
   * @param {number} noPaquete - Número de paquete (ej: 1006, 1007)
   * @returns {Promise<Object|null>} Datos del envío o null si no se encuentra
   */
  async buscarEnvioPorNumeroPaquete(noPaquete) {
    try {
      // Primero buscamos todos los envíos
      const result = await this._fetch('/envios?limit=1000');
      
      if (!result.success || !result.data) {
        return null;
      }

      // Buscar el envío que coincida con el número de paquete
      const envio = result.data.find(e => e.no_paquete_envio === parseInt(noPaquete));
      
      return envio || null;
    } catch (error) {
      console.error('Error al buscar envío por número de paquete:', error);
      return null;
    }
  }

  /**
   * Obtener envíos de un conglomerado específico
   * @param {string} codigoConglomerado - Código del conglomerado
   * @returns {Promise<Array>} Lista de envíos
   */
  async obtenerEnviosPorConglomerado(codigoConglomerado) {
    const result = await this._fetch(`/envios/conglomerado/${codigoConglomerado}`);
    
    if (!result.success) {
      throw new Error('Error al obtener envíos');
    }

    return result.data || [];
  }

  /**
   * Obtener envío específico por ID
   * @param {string} idEnvio - UUID del envío
   * @returns {Promise<Object>} Datos del envío
   */
  async obtenerEnvioPorId(idEnvio) {
    const result = await this._fetch(`/envios/${idEnvio}`);
    
    if (!result.success || !result.data) {
      throw new Error('Envío no encontrado');
    }

    return result.data;
  }

  // ==================== DATOS DE CAMPO ====================

  /**
   * Obtener coberturas y alteraciones de un conglomerado
   * @param {string} codigo - Código del conglomerado
   * @returns {Promise<Array>} Lista de coberturas
   */
  async obtenerCoberturas(codigo) {
    const result = await this._fetch(`/campo/coberturas/${codigo}`);
    
    if (!result.success) {
      throw new Error('Error al obtener coberturas');
    }

    return result.data || [];
  }

  // ==================== MÉTODO PRINCIPAL PARA RECEPCIÓN ====================

  /**
   * Obtener todos los datos necesarios para recepción de paquete
   * Este es el método principal que debe llamar el servicio de recepción
   * 
   * @param {number} numeroPaquete - Número del paquete a buscar
   * @returns {Promise<Object>} Objeto con todos los datos del paquete
   */
  async obtenerDatosCompletosParaRecepcion(numeroPaquete) {
    // 1. Buscar el envío por número de paquete
    const envio = await this.buscarEnvioPorNumeroPaquete(numeroPaquete);
    
    if (!envio) {
      return {
        encontrado: false,
        mensaje: 'No se encontró el paquete en el servicio externo',
        datos: null
      };
    }

    try {
      // 2. Obtener datos del conglomerado
      const conglomerado = await this.buscarConglomeradoPorCodigo(envio.id_conglomerado_txt);

      // 3. Obtener colecciones del conglomerado
      const colecciones = await this.obtenerColeccionesPorConglomerado(envio.id_conglomerado_txt);

      // 4. Obtener subparcelas del conglomerado
      const subparcelas = await this.obtenerSubparcelasPorConglomerado(envio.id_conglomerado_txt);

      return {
        encontrado: true,
        mensaje: 'Paquete encontrado exitosamente',
        datos: {
          // Datos del envío/paquete
          envio: {
            id: envio.id,
            no_paquete_envio: envio.no_paquete_envio,
            cantidad_ejemplares: envio.cantidad_ejemplares_paquete,
            fecha_envio: envio.fecha_envio,
            fecha_recibido_herbario: envio.fecha_recibido_herbario,
            fecha_inicio_coleccion: envio.fecha_inicio_coleccion,
            fecha_fin_coleccion: envio.fecha_fin_coleccion,
            diligenciado_por: envio.diligenciado_por,
            observaciones: envio.observaciones,
            contiene_subparcelas: envio.contiene_muestras_conglomerado_subparcelas === 'SI'
          },
          
          // Datos del conglomerado
          conglomerado: {
            id: conglomerado.id,
            codigo: conglomerado.codigo,
            latitud_dec: conglomerado.latitud_dec,
            longitud_dec: conglomerado.longitud_dec,
            id_municipio: conglomerado.id_municipio
          },
          
          // Colecciones botánicas (muestras) - Solo las colectadas
          colecciones: colecciones
            .filter(col => col.colectada === 'SI')
            .map(col => ({
              id: col.id,
              fecha: col.fecha,
              diligenciado_por: col.diligenciado_por,
              tamano_individuo: col.tamano_individuo,
              n_individuo_id: col.n_individuo_id,
              nombre_comun: col.nombre_comun,
              determinacion_campo: col.determinacion_campo_igualacion,
              observaciones_individuo: col.observaciones_individuo,
              colector_numero_coleccion: col.colector_numero_coleccion,
              observaciones_generales: col.observaciones_generales
            })),
          
          // Subparcelas disponibles
          subparcelas: subparcelas.map(sp => ({
            id: sp.id,
            subparcela: sp.subparcela,
            fecha: sp.fecha,
            se_establecio: sp.se_establecio_sn === 'S',
            latitud_centro: sp.latitud_centro,
            longitud_centro: sp.longitud_centro,
            error_centro_metros: sp.error_centro_metros
          }))
        }
      };
    } catch (error) {
      console.error('Error al obtener datos completos:', error);
      
      // Si falla alguna petición, devolvemos al menos lo que tenemos del envío
      return {
        encontrado: true,
        mensaje: 'Paquete encontrado pero con datos incompletos',
        error: error.message,
        datos: {
          envio: {
            id: envio.id,
            no_paquete_envio: envio.no_paquete_envio,
            cantidad_ejemplares: envio.cantidad_ejemplares_paquete,
            fecha_envio: envio.fecha_envio,
            fecha_recibido_herbario: envio.fecha_recibido_herbario,
            diligenciado_por: envio.diligenciado_por,
            observaciones: envio.observaciones
          },
          conglomerado: { id: envio.id_conglomerado },
          colecciones: [],
          subparcelas: []
        }
      };
    }
  }

  /**
   * Verificar conectividad con el servicio externo
   * @returns {Promise<boolean>} true si el servicio está disponible
   */
  async verificarConexion() {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('Servicio externo no disponible:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const externalApiClient = new ExternalApiClient();
