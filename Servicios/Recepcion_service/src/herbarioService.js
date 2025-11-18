import axios from 'axios';

const GESTION_HERBARIO_URL = process.env.GESTION_HERBARIO_URL || 'http://localhost:3002';

export class HerbarioService {
  // Crear evento de colección
  static async crearEvento(evento) {
    try {
      const response = await axios.post(`${GESTION_HERBARIO_URL}/eventos`, evento);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error creando evento:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error creando evento' };
    }
  }

  // Crear paquete
  static async crearPaquete(paquete) {
    try {
      const response = await axios.post(`${GESTION_HERBARIO_URL}/paquetes`, paquete);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error creando paquete:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error creando paquete' };
    }
  }

  // Crear muestras
  static async crearMuestras(muestras) {
    try {
      const response = await axios.post(`${GESTION_HERBARIO_URL}/muestras`, muestras);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error creando muestras:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error creando muestras' };
    }
  }

  // Obtener paquetes
  static async obtenerPaquetes(filtros = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filtros).forEach(key => {
        if (filtros[key] !== undefined) {
          params.append(key, filtros[key]);
        }
      });
      
      const response = await axios.get(`${GESTION_HERBARIO_URL}/paquetes?${params}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo paquetes:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error obteniendo paquetes' };
    }
  }

  // Obtener conglomerados
  static async obtenerConglomerados() {
    try {
      const response = await axios.get(`${GESTION_HERBARIO_URL}/ubicaciones/conglomerados`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo conglomerados:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error obteniendo conglomerados' };
    }
  }

  // Obtener subparcelas
  static async obtenerSubparcelas(conglomeradoId) {
    try {
      const response = await axios.get(`${GESTION_HERBARIO_URL}/ubicaciones/subparcelas/${conglomeradoId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo subparcelas:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error obteniendo subparcelas' };
    }
  }

  // Sincronizar conglomerado desde servicio externo
  static async sincronizarConglomerado(idConglomerado) {
    try {
      const response = await axios.post(`${GESTION_HERBARIO_URL}/conglomerados/sincronizar/${idConglomerado}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sincronizando conglomerado:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Error sincronizando conglomerado' };
    }
  }
}