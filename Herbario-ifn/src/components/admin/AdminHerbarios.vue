<template>
  <div class="herbarios-manager">
    <div class="view-header">Gestión de Herbarios</div>
    
    <div class="manager-content">
      <div class="manager-header">
        <h1>Herbarios del Sistema</h1>
        <div class="header-actions">
          <button @click="$emit('navigate', 'AdminDashboard')" class="btn btn-secondary">
            ← Volver al Dashboard
          </button>
          <button @click="openCreateModal" class="btn btn-primary">
            ➕ Nuevo Herbario
          </button>
        </div>
      </div>

      <!-- Lista de Herbarios -->
      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando herbarios...</p>
      </div>

      <div v-else-if="error && herbarios.length === 0" class="error-message">
        <p>⚠️ {{ error }}</p>
        <button class="btn btn-primary" @click="loadHerbarios">Reintentar</button>
      </div>

      <div v-else-if="herbarios.length === 0" class="empty-message">
        <div class="empty-icon">🏛️</div>
        <h3>No hay herbarios registrados</h3>
        <p>Comienza creando tu primer herbario</p>
        <button @click="openCreateModal" class="btn btn-primary">
          Crear Herbario
        </button>
      </div>

      <div v-else class="herbarios-grid">
        <div 
          v-for="herbario in herbarios" 
          :key="herbario.id" 
          class="herbario-card"
        >
          <div class="herbario-header">
            <h3>{{ herbario.nombre }}</h3>
          </div>

          <div class="herbario-details">
            <div v-if="herbario.codigo_postal" class="detail-item">
              <strong>Código Postal:</strong> {{ herbario.codigo_postal }}
            </div>
            <div v-if="herbario.direccion" class="detail-item">
              <strong>Dirección:</strong> {{ herbario.direccion }}
            </div>
          </div>

          <div class="herbario-actions">
            <button 
              @click="editHerbario(herbario)" 
              class="btn btn-outline"
            >
              ✏️ Editar
            </button>
            <button 
              @click="confirmDelete(herbario)" 
              class="btn btn-danger"
            >
              🗑️ Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingHerbario ? 'Editar Herbario' : 'Nuevo Herbario' }}</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="saveHerbario" class="modal-form">
          <div class="form-group">
            <label>Nombre *</label>
            <input
              v-model="formData.nombre"
              type="text"
              class="form-control"
              placeholder="Ej: Herbario Nacional de Colombia"
              required
            />
          </div>

          <div class="form-group">
            <label>Código Postal</label>
            <input
              v-model="formData.codigo_postal"
              type="text"
              class="form-control"
              placeholder="Ej: 110111"
            />
          </div>

          <div class="form-group">
            <label>Dirección</label>
            <input
              v-model="formData.direccion"
              type="text"
              class="form-control"
              placeholder="Ej: Calle 123 #45-67, Bogotá"
            />
          </div>

          <div v-if="modalError" class="error-message">
            {{ modalError }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : (editingHerbario ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Confirmación -->
    <div v-if="deletingHerbario" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content confirm-modal" @click.stop>
        <div class="modal-header">
          <h2>Confirmar Eliminación</h2>
          <button @click="cancelDelete" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>¿Estás seguro de eliminar el herbario <strong>{{ deletingHerbario.nombre }}</strong>?</p>
          <p class="warning-text">Esta acción no se puede deshacer.</p>
        </div>

        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">
            Cancelar
          </button>
          <button @click="deleteHerbario" class="btn btn-danger" :disabled="deleting">
            {{ deleting ? 'Eliminando...' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminService } from '../../services/api.js'

// Emits
defineEmits(['navigate'])

// Estado
const herbarios = ref([])
const loading = ref(false)
const error = ref(null)
const showModal = ref(false)
const editingHerbario = ref(null)
const deletingHerbario = ref(null)
const saving = ref(false)
const deleting = ref(false)
const modalError = ref(null)

const formData = ref({
  nombre: '',
  codigo_postal: '',
  direccion: ''
})

// Cargar herbarios
const loadHerbarios = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await adminService.obtenerHerbarios()
    herbarios.value = data
  } catch (err) {
    console.error('Error cargando herbarios:', err)
    error.value = err.response?.data?.error || 'Error al cargar los herbarios'
  } finally {
    loading.value = false
  }
}

// Abrir modal de creación
const openCreateModal = () => {
  editingHerbario.value = null
  formData.value = {
    nombre: '',
    codigo_postal: '',
    direccion: ''
  }
  modalError.value = null
  showModal.value = true
}

// Editar herbario
const editHerbario = (herbario) => {
  editingHerbario.value = herbario
  formData.value = {
    nombre: herbario.nombre,
    codigo_postal: herbario.codigo_postal || '',
    direccion: herbario.direccion || ''
  }
  modalError.value = null
  showModal.value = true
}

// Guardar herbario
const saveHerbario = async () => {
  saving.value = true
  modalError.value = null
  
  try {
    if (editingHerbario.value) {
      await adminService.actualizarHerbario(editingHerbario.value.id, formData.value)
    } else {
      await adminService.crearHerbario(formData.value)
    }
    
    await loadHerbarios()
    closeModal()
  } catch (err) {
    console.error('Error guardando herbario:', err)
    modalError.value = err.response?.data?.error || 'Error al guardar el herbario'
  } finally {
    saving.value = false
  }
}

// Confirmar eliminación
const confirmDelete = (herbario) => {
  deletingHerbario.value = herbario
}

// Eliminar herbario
const deleteHerbario = async () => {
  deleting.value = true
  
  try {
    await adminService.eliminarHerbario(deletingHerbario.value.id)
    await loadHerbarios()
    cancelDelete()
  } catch (err) {
    console.error('Error eliminando herbario:', err)
    alert(err.response?.data?.error || 'Error al eliminar el herbario')
  } finally {
    deleting.value = false
  }
}

// Cerrar modales
const closeModal = () => {
  showModal.value = false
  editingHerbario.value = null
}

const cancelDelete = () => {
  deletingHerbario.value = null
}

onMounted(() => {
  loadHerbarios()
})
</script>

<style scoped>
.herbarios-manager {
  min-height: 100vh;
  background: var(--background-color);
}

.manager-content {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.manager-header {
  margin-bottom: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.manager-header h1 {
  color: var(--primary-green);
  font-size: 28px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Grid de Herbarios */
.herbarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.herbario-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-light);
  transition: transform 0.3s ease;
}

.herbario-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-medium);
}

.herbario-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 16px;
}

.herbario-header h3 {
  color: var(--primary-green);
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

.herbario-details {
  margin-bottom: 16px;
}

.detail-item {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.detail-item strong {
  color: var(--primary-green);
}

.herbario-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Mensajes */
.loading-message,
.empty-message {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-light);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-message h3 {
  color: var(--primary-green);
  margin-bottom: 8px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  color: var(--primary-green);
  font-size: 24px;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-light);
}

.modal-form {
  padding: 24px;
}

.modal-body {
  padding: 24px;
  text-align: center;
}

.warning-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.warning-text {
  color: #721c24;
  font-weight: 500;
  margin-top: 8px;
}

.modal-actions {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
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
</style>
