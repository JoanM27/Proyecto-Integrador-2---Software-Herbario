<template>
  <div class="admin-municipios">
    <div class="view-header">Gestión de Municipios</div>
    
    <div class="manager-content">
      <div class="manager-header">
        <h1>Municipios de Colombia</h1>
        <div class="header-actions">
          <button @click="$emit('navigate', 'AdminDashboard')" class="btn btn-secondary">
            ← Volver
          </button>
          <select v-model="selectedDepartamento" @change="loadMunicipios" class="form-select">
            <option value="">Todos los departamentos</option>
            <option v-for="d in departamentos" :key="d.id" :value="d.id">
              {{ d.nombre }}
            </option>
          </select>
          <button @click="openCreateModal" class="btn btn-primary">
            ➕ Nuevo Municipio
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando municipios...</p>
      </div>

      <div v-else-if="municipios.length === 0" class="empty-message">
        <div class="empty-icon">🏘️</div>
        <h3>No hay municipios</h3>
        <button @click="openCreateModal" class="btn btn-primary">Crear Municipio</button>
      </div>

      <div v-else class="municipios-list">
        <!-- Agrupar por departamento -->
        <div v-for="(munisPorDepto, deptoNombre) in municipiosAgrupados" :key="deptoNombre" class="departamento-group">
          <h2 class="departamento-title">{{ deptoNombre }}</h2>
          <div class="municipios-grid">
            <div v-for="m in munisPorDepto" :key="m.id" class="municipio-card">
          <div class="municipio-header">
            <div class="municipio-icon">🏘️</div>
            <div class="municipio-info">
              <h3>{{ m.nombre }}</h3>
              <p class="municipio-depto">{{ m.departamento?.nombre || 'Sin departamento' }}</p>
            </div>
          </div>

          <div class="municipio-actions">
            <button @click="editMunicipio(m)" class="btn btn-outline">✏️ Editar</button>
            <button @click="confirmDelete(m)" class="btn btn-danger">🗑️ Eliminar</button>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingMunicipio ? 'Editar Municipio' : 'Nuevo Municipio' }}</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="saveMunicipio" class="modal-form">
          <div class="form-group">
            <label>Nombre *</label>
            <input 
              v-model="formData.nombre" 
              type="text" 
              class="form-control" 
              placeholder="Ej: Bogotá, Medellín..."
              required 
            />
          </div>

          <div class="form-group">
            <label>Departamento *</label>
            <select v-model="formData.id_departamento" class="form-control" required>
              <option value="">Seleccionar departamento</option>
              <option v-for="d in departamentos" :key="d.id" :value="d.id">
                {{ d.nombre }}
              </option>
            </select>
          </div>

          <div v-if="modalError" class="error-message">{{ modalError }}</div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : (editingMunicipio ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Confirmar -->
    <div v-if="deletingMunicipio" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content confirm-modal" @click.stop>
        <div class="modal-header">
          <h2>Confirmar Eliminación</h2>
          <button @click="cancelDelete" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>¿Eliminar municipio <strong>{{ deletingMunicipio.nombre }}</strong>?</p>
          <p class="warning-text">Esta acción no se puede deshacer.</p>
        </div>

        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">Cancelar</button>
          <button @click="deleteMunicipio" class="btn btn-danger" :disabled="deleting">
            {{ deleting ? 'Eliminando...' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminService } from '../../services/api.js'

defineEmits(['navigate'])

const municipios = ref([])
const departamentos = ref([])
const selectedDepartamento = ref('')
const loading = ref(false)
const showModal = ref(false)
const editingMunicipio = ref(null)
const deletingMunicipio = ref(null)
const saving = ref(false)
const deleting = ref(false)
const modalError = ref(null)

const formData = ref({ nombre: '', id_departamento: '' })

// Agrupar municipios por departamento
const municipiosAgrupados = computed(() => {
  const grupos = {}
  municipios.value.forEach(m => {
    const deptoNombre = m.departamento?.nombre || 'Sin departamento'
    if (!grupos[deptoNombre]) {
      grupos[deptoNombre] = []
    }
    grupos[deptoNombre].push(m)
  })
  return grupos
})

const loadMunicipios = async () => {
  loading.value = true
  try {
    const filtros = selectedDepartamento.value ? { id_departamento: selectedDepartamento.value } : {}
    const data = await adminService.obtenerMunicipios(filtros)
    // Ordenar por departamento (llave foránea) y luego por nombre
    municipios.value = data.sort((a, b) => {
      const deptoA = a.departamento?.nombre || ''
      const deptoB = b.departamento?.nombre || ''
      if (deptoA !== deptoB) {
        return deptoA.localeCompare(deptoB)
      }
      return a.nombre.localeCompare(b.nombre)
    })
  } catch (err) {
    console.error('Error cargando municipios:', err)
  } finally {
    loading.value = false
  }
}

const loadDepartamentos = async () => {
  try {
    departamentos.value = await adminService.obtenerDepartamentos()
  } catch (err) {
    console.error('Error cargando departamentos:', err)
  }
}

const openCreateModal = () => {
  editingMunicipio.value = null
  formData.value = { nombre: '', id_departamento: selectedDepartamento.value || '' }
  modalError.value = null
  showModal.value = true
}

const editMunicipio = (municipio) => {
  editingMunicipio.value = municipio
  formData.value = { 
    nombre: municipio.nombre,
    id_departamento: municipio.id_departamento
  }
  modalError.value = null
  showModal.value = true
}

const saveMunicipio = async () => {
  saving.value = true
  modalError.value = null
  
  try {
    if (editingMunicipio.value) {
      await adminService.actualizarMunicipio(editingMunicipio.value.id, formData.value)
    } else {
      await adminService.crearMunicipio(formData.value)
    }
    
    await loadMunicipios()
    closeModal()
  } catch (err) {
    console.error('Error guardando municipio:', err)
    modalError.value = err.response?.data?.error || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

const confirmDelete = (municipio) => {
  deletingMunicipio.value = municipio
}

const deleteMunicipio = async () => {
  deleting.value = true
  
  try {
    await adminService.eliminarMunicipio(deletingMunicipio.value.id)
    await loadMunicipios()
    cancelDelete()
  } catch (err) {
    console.error('Error eliminando municipio:', err)
    alert(err.response?.data?.error || 'Error al eliminar')
  } finally {
    deleting.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  editingMunicipio.value = null
}

const cancelDelete = () => {
  deletingMunicipio.value = null
}

onMounted(() => {
  loadDepartamentos()
  loadMunicipios()
})
</script>

<style scoped>
.admin-municipios {
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
  align-items: center;
}

.municipios-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.departamento-group {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-light);
}

.departamento-title {
  color: var(--primary-green);
  font-size: 20px;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-green-light);
}

.municipios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.municipio-card {
  background: var(--background-color);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.municipio-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.municipio-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.municipio-icon {
  font-size: 32px;
}

.municipio-info h3 {
  margin: 0 0 4px 0;
  color: var(--primary-green);
  font-size: 18px;
}

.municipio-depto {
  margin: 0;
  color: var(--text-light);
  font-size: 14px;
}

.municipio-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
