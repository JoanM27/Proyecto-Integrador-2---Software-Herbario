// Servicio de API para comunicación con el backend
import axios from 'axios'

// Configuración base de URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001'
const GEST_HERB_URL = import.meta.env.VITE_GEST_HERB_URL || 'http://localhost:3002'
const RECEPCION_URL = import.meta.env.VITE_RECEPCION_URL || 'http://localhost:3004'
const LAB_URL = import.meta.env.VITE_LAB_URL || 'http://localhost:3005'

// Instancia de axios para Auth Service
const authAPI = axios.create({
  baseURL: AUTH_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8'
  }
})

// Instancia de axios para Gestión Herbario
const gestHerbAPI = axios.create({
  baseURL: GEST_HERB_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8'
  }
})

// Instancia de axios para API Gateway
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8'
  }
})

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      window.location.href = '/#/login'
    }
    return Promise.reject(error)
  }
)

// ===== SERVICIOS DE AUTENTICACIÓN =====
export const authService = {
  async login(email, password) {
    const response = await authAPI.post('/auth/login', { email, password })
    return response.data
  },

  async register(userData) {
    const response = await authAPI.post('/auth/register', userData)
    return response.data
  },

  logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
  },

  isAuthenticated() {
    return !!localStorage.getItem('auth_token')
  },

  getUser() {
    const userData = localStorage.getItem('user_data')
    return userData ? JSON.parse(userData) : null
  },

  saveAuthData(token, user) {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_data', JSON.stringify(user))
  }
}

// ===== SERVICIOS DE RECEPCIÓN =====
export const recepcionService = {
  async registrarPaquete(paqueteData) {
    const response = await api.post('/api/recepcion/paquetes', paqueteData)
    return response.data
  },

  async obtenerPaquetes(filtros = {}) {
    const response = await api.get('/api/recepcion/paquetes', { params: filtros })
    return response.data
  },

  async registrarMuestra(muestraData) {
    const response = await api.post('/api/recepcion/muestras', muestraData)
    return response.data
  },

  async obtenerMuestras(filtros = {}) {
    const response = await api.get('/api/recepcion/muestras', { params: filtros })
    return response.data
  }
}

// ===== SERVICIOS DE LABORATORIO =====
export const laboratorioService = {
  async obtenerMuestrasParaClasificar(filtros = {}) {
    const response = await api.get('/api/laboratorio/muestras', { params: filtros })
    return response.data
  },

  async clasificarMuestra(muestraId, clasificacionData) {
    const response = await api.put(`/api/laboratorio/muestras/${muestraId}/clasificar`, clasificacionData)
    return response.data
  },

  async actualizarEstado(muestraId, nuevoEstado) {
    const response = await api.put(`/api/laboratorio/muestras/${muestraId}/estado`, { estado: nuevoEstado })
    return response.data
  }
}

// ===== SERVICIOS DE ADMINISTRACIÓN =====
export const adminService = {
  // Herbarios
  async obtenerHerbarios() {
    const response = await gestHerbAPI.get('/admin/herbario')
    return response.data
  },

  async crearHerbario(herbarioData) {
    const response = await gestHerbAPI.post('/admin/herbario', herbarioData)
    return response.data
  },

  async actualizarHerbario(id, herbarioData) {
    const response = await gestHerbAPI.put(`/admin/herbario/${id}`, herbarioData)
    return response.data
  },

  async eliminarHerbario(id) {
    const response = await gestHerbAPI.delete(`/admin/herbario/${id}`)
    return response.data
  },

  // Usuarios
  async obtenerUsuarios(filtros = {}) {
    const response = await gestHerbAPI.get('/admin/usuarios', { params: filtros })
    return response.data
  },

  async crearUsuario(usuarioData) {
    const response = await gestHerbAPI.post('/admin/usuarios', usuarioData)
    return response.data
  },

  async actualizarUsuario(id, usuarioData) {
    const response = await gestHerbAPI.put(`/admin/usuarios/${id}`, usuarioData)
    return response.data
  },

  async eliminarUsuario(id) {
    const response = await gestHerbAPI.delete(`/admin/usuarios/${id}`)
    return response.data
  },

  // Estadísticas
  async obtenerEstadisticas() {
    const response = await gestHerbAPI.get('/admin/estadisticas')
    return response.data
  },

  // Regiones
  async obtenerRegiones() {
    const response = await gestHerbAPI.get('/admin/regiones')
    return response.data
  },

  async crearRegion(regionData) {
    const response = await gestHerbAPI.post('/admin/regiones', regionData)
    return response.data
  },

  async actualizarRegion(id, regionData) {
    const response = await gestHerbAPI.put(`/admin/regiones/${id}`, regionData)
    return response.data
  },

  async eliminarRegion(id) {
    const response = await gestHerbAPI.delete(`/admin/regiones/${id}`)
    return response.data
  },

  // Departamentos
  async obtenerDepartamentos(filtros = {}) {
    const response = await gestHerbAPI.get('/admin/departamentos', { params: filtros })
    return response.data
  },

  async crearDepartamento(departamentoData) {
    const response = await gestHerbAPI.post('/admin/departamentos', departamentoData)
    return response.data
  },

  async actualizarDepartamento(id, departamentoData) {
    const response = await gestHerbAPI.put(`/admin/departamentos/${id}`, departamentoData)
    return response.data
  },

  async eliminarDepartamento(id) {
    const response = await gestHerbAPI.delete(`/admin/departamentos/${id}`)
    return response.data
  },

  // Municipios
  async obtenerMunicipios(filtros = {}) {
    const response = await gestHerbAPI.get('/admin/municipios', { params: filtros })
    return response.data
  },

  async crearMunicipio(municipioData) {
    const response = await gestHerbAPI.post('/admin/municipios', municipioData)
    return response.data
  },

  async actualizarMunicipio(id, municipioData) {
    const response = await gestHerbAPI.put(`/admin/municipios/${id}`, municipioData)
    return response.data
  },

  async eliminarMunicipio(id) {
    const response = await gestHerbAPI.delete(`/admin/municipios/${id}`)
    return response.data
  }
}

// Export por defecto para importación simple
export default api
