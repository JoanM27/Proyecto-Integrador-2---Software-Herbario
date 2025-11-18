/**
 * Cliente para comunicación con el Servicio Externo API
 * Obtiene datos de conglomerados desde la base de datos externa (puerto 4000)
 */

import fetch from 'node-fetch';
import { supabase } from './supabase.js';

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
   * Obtener todos los conglomerados con información completa
   * @returns {Promise<Array>} Lista de conglomerados
   */
  async obtenerConglomerados(filtros = {}) {
    const { limit = 1000, offset = 0, codigo } = filtros;
    
    let queryParams = `?limit=${limit}&offset=${offset}`;
    if (codigo) {
      queryParams += `&codigo=${codigo}`;
    }

    const result = await this._fetch(`/conglomerados${queryParams}`);
    
    if (!result.success) {
      throw new Error('Error al obtener conglomerados');
    }

    return result.data || [];
  }

  /**
   * Buscar conglomerado por código
   * @param {string} codigo - Código del conglomerado
   * @returns {Promise<Object>} Datos del conglomerado
   */
  async buscarConglomeradoPorCodigo(codigo) {
    const result = await this._fetch(`/conglomerados/${codigo}`);
    
    if (!result.success || !result.data) {
      throw new Error('Conglomerado no encontrado en el servicio externo');
    }

    return result.data;
  }  /**
   * Obtener información geográfica (municipio/departamento) desde Supabase local
   * @param {number} idMunicipio - ID del municipio
   * @returns {Promise<Object>} Datos de municipio y departamento
   */
  async obtenerInfoGeografica(idMunicipio) {
    try {
      const { data, error } = await supabase
        .from('municipio')
        .select(`
          nombre,
          departamento(nombre)
        `)
        .eq('id', idMunicipio)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn(`No se pudo obtener info geográfica del municipio ${idMunicipio}:`, error.message);
      return { nombre: 'N/A', departamento: { nombre: 'N/A' } };
    }
  }

  /**
   * Obtener múltiples conglomerados por sus códigos CON INFORMACIÓN COMPLETA
   * Incluye municipio y departamento directamente del servicio externo
   * @param {Array<string>} codigos - Array de códigos de conglomerado
   * @returns {Promise<Object>} Mapa de código -> datos completos del conglomerado (incluye municipio/departamento)
   */
  async obtenerConglomeradosPorCodigos(codigos) {
    if (!codigos || codigos.length === 0) {
      return {};
    }

    try {
      // Obtener todos los conglomerados del servicio externo
      // (ya vienen con municipio y departamento incluidos)
      const todosConglomerados = await this.obtenerConglomerados({ limit: 2000 });
      
      // Filtrar solo los que necesitamos y crear mapa
      const mapa = {};
      for (const codigo of codigos) {
        const conglomerado = todosConglomerados.find(c => c.codigo === codigo);
        if (conglomerado) {
          mapa[codigo] = conglomerado;
        }
      }

      return mapa;
    } catch (error) {
      console.error('Error obteniendo conglomerados por códigos:', error);
      return {};
    }
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
