<template>
  <div class="admin-regiones">
    <div class="view-header">Gestión de Regiones</div>
    
    <div class="manager-content">
      <div class="manager-header">
        <h1>Regiones de Colombia</h1>
        <div class="header-actions">
          <button @click="$emit('navigate', 'AdminDashboard')" class="btn btn-secondary">
            ← Volver
          </button>
          <button @click="openCreateModal" class="btn btn-primary">
            ➕ Nueva Región
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando regiones...</p>
      </div>

      <div v-else-if="regiones.length === 0" class="empty-message">
        <div class="empty-icon">🌍</div>
        <h3>No hay regiones</h3>
        <button @click="openCreateModal" class="btn btn-primary">Crear Región</button>
      </div>

      <div v-else class="regiones-grid">
        <div v-for="r in regiones" :key="r.id" class="region-card">
          <div class="region-header">
            <div class="region-icon">🌍</div>
            <h3>{{ r.nombre }}</h3>
          </div>
          
          <div class="region-stats">
            <span>ID: {{ r.id }}</span>
          </div>

          <div class="region-actions">
            <button @click="editRegion(r)" class="btn btn-outline">✏️ Editar</button>
            <button @click="confirmDelete(r)" class="btn btn-danger">🗑️ Eliminar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingRegion ? 'Editar Región' : 'Nueva Región' }}</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="saveRegion" class="modal-form">
          <div class="form-group">
            <label>Nombre *</label>
            <input 
              v-model="formData.nombre" 
              type="text" 
              class="form-control" 
              placeholder="Ej: Región Andina, Región Caribe..."
              required 
            />
          </div>

          <div v-if="modalError" class="error-message">{{ modalError }}</div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : (editingRegion ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Confirmar -->
    <div v-if="deletingRegion" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content confirm-modal" @click.stop>
        <div class="modal-header">
          <h2>Confirmar Eliminación</h2>
          <button @click="cancelDelete" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>¿Eliminar región <strong>{{ deletingRegion.nombre }}</strong>?</p>
          <p class="warning-text">Esto eliminará departamentos y municipios asociados.</p>
        </div>

        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">Cancelar</button>
          <button @click="deleteRegion" class="btn btn-danger" :disabled="deleting">
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

defineEmits(['navigate'])

const regiones = ref([])
const loading = ref(false)
const showModal = ref(false)
const editingRegion = ref(null)
const deletingRegion = ref(null)
const saving = ref(false)
const deleting = ref(false)
const modalError = ref(null)

const formData = ref({ nombre: '' })

const loadRegiones = async () => {
  loading.value = true
  try {
    regiones.value = await adminService.obtenerRegiones()
  } catch (err) {
    console.error('Error cargando regiones:', err)
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  editingRegion.value = null
  formData.value = { nombre: '' }
  modalError.value = null
  showModal.value = true
}

const editRegion = (region) => {
  editingRegion.value = region
  formData.value = { nombre: region.nombre }
  modalError.value = null
  showModal.value = true
}

const saveRegion = async () => {
  saving.value = true
  modalError.value = null
  
  try {
    if (editingRegion.value) {
      await adminService.actualizarRegion(editingRegion.value.id, formData.value)
    } else {
      await adminService.crearRegion(formData.value)
    }
    
    await loadRegiones()
    closeModal()
  } catch (err) {
    console.error('Error guardando región:', err)
    modalError.value = err.response?.data?.error || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

const confirmDelete = (region) => {
  deletingRegion.value = region
}

const deleteRegion = async () => {
  deleting.value = true
  
  try {
    await adminService.eliminarRegion(deletingRegion.value.id)
    await loadRegiones()
    cancelDelete()
  } catch (err) {
    console.error('Error eliminando región:', err)
    alert(err.response?.data?.error || 'Error al eliminar')
  } finally {
    deleting.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  editingRegion.value = null
}

const cancelDelete = () => {
  deletingRegion.value = null
}

onMounted(() => {
  loadRegiones()
})
</script>

<style scoped>
.admin-regiones {
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
}

.header-actions {
  display: flex;
  gap: 12px;
}

.regiones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.region-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-light);
}

.region-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.region-icon {
  font-size: 32px;
}

.region-header h3 {
  color: var(--primary-green);
  margin: 0;
  font-size: 18px;
}

.region-stats {
  color: var(--text-light);
  font-size: 14px;
  margin-bottom: 16px;
}

.region-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
