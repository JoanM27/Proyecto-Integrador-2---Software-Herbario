<template>
  <div class="admin-dashboard">
    <div class="view-header">Panel de Administración</div>

    <div class="dashboard-content">
      <!-- Acciones Rápidas -->
      <div class="quick-actions">
        <h2>Acciones Rápidas</h2>
        
        <div class="actions-grid">
          <div class="action-card" @click="$emit('navigate', 'AdminHerbarios')">
            <div class="action-icon">🏛️</div>
            <h3>Gestionar Herbarios</h3>
            <p>Crear, editar y administrar herbarios del sistema</p>
          </div>

          <div class="action-card" @click="$emit('navigate', 'AdminUsuarios')">
            <div class="action-icon">👥</div>
            <h3>Gestionar Usuarios</h3>
            <p>Administrar usuarios y sus permisos por herbario</p>
          </div>

          <div class="action-card" @click="$emit('navigate', 'AdminRegiones')">
            <div class="action-icon">🌍</div>
            <h3>Gestionar Regiones</h3>
            <p>Configurar las regiones del país</p>
          </div>

          <div class="action-card" @click="$emit('navigate', 'AdminDepartamentos')">
            <div class="action-icon">🏞️</div>
            <h3>Gestionar Departamentos</h3>
            <p>Administrar departamentos por región</p>
          </div>

          <div class="action-card" @click="$emit('navigate', 'AdminMunicipios')">
            <div class="action-icon">🏘️</div>
            <h3>Gestionar Municipios</h3>
            <p>Configurar municipios por departamento</p>
          </div>

          <div class="action-card" @click="refreshStats">
            <div class="action-icon">📊</div>
            <h3>Actualizar Estadísticas</h3>
            <p>Refrescar los datos del panel de control</p>
          </div>
        </div>
      </div>

      <!-- Distribución de Roles -->
      <div v-if="stats.usuariosPorRol && Object.keys(stats.usuariosPorRol).length > 0" class="roles-section">
        <h2>Distribución de Roles</h2>
        <div class="roles-grid">
          <div 
            v-for="(count, role) in stats.usuariosPorRol" 
            :key="role" 
            class="role-card"
          >
            <div class="role-count">{{ count }}</div>
            <div class="role-name">{{ formatRoleName(role) }}</div>
          </div>
        </div>
      </div>

      <!-- Mensaje de carga -->
      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>

      <!-- Mensaje de error -->
      <div v-if="error" class="error-message">
        <p>⚠️ {{ error }}</p>
        <button class="btn btn-primary" @click="loadStats">Reintentar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminService } from '../../services/api.js'

// Props
defineProps({
  currentUser: {
    type: Object,
    default: () => ({})
  }
})

// Emits
defineEmits(['navigate', 'logout'])

// Estado
const stats = ref({})
const loading = ref(false)
const error = ref(null)

// Cargar estadísticas
const loadStats = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await adminService.obtenerEstadisticas()
    stats.value = data
  } catch (err) {
    console.error('Error cargando estadísticas:', err)
    error.value = err.response?.data?.error || 'Error al cargar las estadísticas'
    
    // Mostrar datos de ejemplo si hay error
    stats.value = {
      totalHerbarios: 0,
      herbariosActivos: 0,
      totalUsuarios: 0,
      totalRegiones: 0,
      totalDepartamentos: 0,
      totalMunicipios: 0,
      usuariosPorRol: {}
    }
  } finally {
    loading.value = false
  }
}

const refreshStats = () => {
  loadStats()
}

const formatRoleName = (role) => {
  const roleNames = {
    'admin': 'Administrador',
    'recepcionista': 'Recepcionista',
    'laboratorista': 'Laboratorista'
  }
  return roleNames[role] || role
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: var(--background-color);
}

.dashboard-content {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 32px;
}

.dashboard-header h1 {
  color: var(--primary-green);
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 8px;
}

.dashboard-header p {
  color: var(--text-light);
  font-size: 16px;
}

/* Estadísticas */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-light);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-medium);
}

.stat-icon {
  font-size: 32px;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.herbarios {
  background: linear-gradient(135deg, #e8f5e8, #c8e6c9);
}

.stat-icon.usuarios {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
}

.stat-icon.roles {
  background: linear-gradient(135deg, #fff3e0, #ffcc80);
}

.stat-icon.regiones {
  background: linear-gradient(135deg, #e8f5e8, #c8e6c9);
}

.stat-icon.departamentos {
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
}

.stat-icon.municipios {
  background: linear-gradient(135deg, #fce4ec, #f8bbd0);
}

.stat-info h3 {
  font-size: 28px;
  font-weight: 600;
  color: var(--primary-green);
  margin-bottom: 4px;
}

.stat-info p {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.stat-detail {
  font-size: 12px;
  color: var(--text-light);
}

/* Acciones Rápidas */
.quick-actions h2 {
  color: var(--primary-green);
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}

.action-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--shadow-light);
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-medium);
}

.action-icon {
  font-size: 32px;
  margin-bottom: 16px;
}

.action-card h3 {
  color: var(--primary-green);
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.action-card p {
  color: var(--text-light);
  font-size: 14px;
  line-height: 1.4;
}

/* Roles */
.roles-section {
  margin-top: 48px;
}

.roles-section h2 {
  color: var(--primary-green);
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.role-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: var(--shadow-light);
  text-align: center;
}

.role-count {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-green);
  margin-bottom: 8px;
}

.role-name {
  font-size: 14px;
  color: var(--text-light);
  font-weight: 500;
}

/* Loading y Error */
.loading-message {
  text-align: center;
  padding: 40px;
  color: var(--text-light);
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--primary-green);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  margin: 20px 0;
}

.error-message p {
  margin-bottom: 16px;
}
</style>
