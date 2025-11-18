<template>
  <div class="admin-departamentos">
    <div class="view-header">Gestión de Departamentos</div>
    
    <div class="manager-content">
      <div class="manager-header">
        <h1>Departamentos de Colombia</h1>
        <div class="header-actions">
          <button @click="$emit('navigate', 'AdminDashboard')" class="btn btn-secondary">
            ← Volver
          </button>
          <select v-model="selectedRegion" @change="loadDepartamentos" class="form-select">
            <option value="">Todas las regiones</option>
            <option v-for="r in regiones" :key="r.id" :value="r.id">
              {{ r.nombre }}
            </option>
          </select>
          <button @click="openCreateModal" class="btn btn-primary">
            ➕ Nuevo Departamento
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando departamentos...</p>
      </div>

      <div v-else-if="departamentos.length === 0" class="empty-message">
        <div class="empty-icon">📍</div>
        <h3>No hay departamentos</h3>
        <button @click="openCreateModal" class="btn btn-primary">Crear Departamento</button>
      </div>

      <div v-else class="departamentos-list">
        <!-- Agrupar por región -->
        <div v-for="(deptosPorRegion, regionNombre) in departamentosAgrupados" :key="regionNombre" class="region-group">
          <h2 class="region-title">{{ regionNombre }}</h2>
          <div class="departamentos-grid">
            <div v-for="d in deptosPorRegion" :key="d.id" class="depto-card">
          <div class="depto-header">
            <div class="depto-icon">📍</div>
            <div class="depto-info">
              <h3>{{ d.nombre }}</h3>
              <p class="depto-region">{{ d.region?.nombre || 'Sin región' }}</p>
            </div>
          </div>

          <div class="depto-actions">
            <button @click="editDepartamento(d)" class="btn btn-outline">✏️ Editar</button>
            <button @click="confirmDelete(d)" class="btn btn-danger">🗑️ Eliminar</button>
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
          <h2>{{ editingDepartamento ? 'Editar Departamento' : 'Nuevo Departamento' }}</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="saveDepartamento" class="modal-form">
          <div class="form-group">
            <label>Nombre *</label>
            <input 
              v-model="formData.nombre" 
              type="text" 
              class="form-control" 
              placeholder="Ej: Cundinamarca, Antioquia..."
              required 
            />
          </div>

          <div class="form-group">
            <label>Región *</label>
            <select v-model="formData.id_region" class="form-control" required>
              <option value="">Seleccionar región</option>
              <option v-for="r in regiones" :key="r.id" :value="r.id">
                {{ r.nombre }}
              </option>
            </select>
          </div>

          <div v-if="modalError" class="error-message">{{ modalError }}</div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : (editingDepartamento ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Confirmar -->
    <div v-if="deletingDepartamento" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content confirm-modal" @click.stop>
        <div class="modal-header">
          <h2>Confirmar Eliminación</h2>
          <button @click="cancelDelete" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>¿Eliminar departamento <strong>{{ deletingDepartamento.nombre }}</strong>?</p>
          <p class="warning-text">Esto eliminará municipios asociados.</p>
        </div>

        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">Cancelar</button>
          <button @click="deleteDepartamento" class="btn btn-danger" :disabled="deleting">
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

const departamentos = ref([])
const regiones = ref([])
const selectedRegion = ref('')
const loading = ref(false)
const showModal = ref(false)
const editingDepartamento = ref(null)
const deletingDepartamento = ref(null)
const saving = ref(false)
const deleting = ref(false)
const modalError = ref(null)

const formData = ref({ nombre: '', id_region: '' })

// Agrupar departamentos por región
const departamentosAgrupados = computed(() => {
  const grupos = {}
  departamentos.value.forEach(d => {
    const regionNombre = d.region?.nombre || 'Sin región'
    if (!grupos[regionNombre]) {
      grupos[regionNombre] = []
    }
    grupos[regionNombre].push(d)
  })
  return grupos
})

const loadDepartamentos = async () => {
  loading.value = true
  try {
    const filtros = selectedRegion.value ? { id_region: selectedRegion.value } : {}
    const data = await adminService.obtenerDepartamentos(filtros)
    // Ordenar por región (llave foránea) y luego por nombre
    departamentos.value = data.sort((a, b) => {
      const regionA = a.region?.nombre || ''
      const regionB = b.region?.nombre || ''
      if (regionA !== regionB) {
        return regionA.localeCompare(regionB)
      }
      return a.nombre.localeCompare(b.nombre)
    })
  } catch (err) {
    console.error('Error cargando departamentos:', err)
  } finally {
    loading.value = false
  }
}

const loadRegiones = async () => {
  try {
    regiones.value = await adminService.obtenerRegiones()
  } catch (err) {
    console.error('Error cargando regiones:', err)
  }
}

const openCreateModal = () => {
  editingDepartamento.value = null
  formData.value = { nombre: '', id_region: selectedRegion.value || '' }
  modalError.value = null
  showModal.value = true
}

const editDepartamento = (depto) => {
  editingDepartamento.value = depto
  formData.value = { 
    nombre: depto.nombre,
    id_region: depto.id_region
  }
  modalError.value = null
  showModal.value = true
}

const saveDepartamento = async () => {
  saving.value = true
  modalError.value = null
  
  try {
    if (editingDepartamento.value) {
      await adminService.actualizarDepartamento(editingDepartamento.value.id, formData.value)
    } else {
      await adminService.crearDepartamento(formData.value)
    }
    
    await loadDepartamentos()
    closeModal()
  } catch (err) {
    console.error('Error guardando departamento:', err)
    modalError.value = err.response?.data?.error || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

const confirmDelete = (depto) => {
  deletingDepartamento.value = depto
}

const deleteDepartamento = async () => {
  deleting.value = true
  
  try {
    await adminService.eliminarDepartamento(deletingDepartamento.value.id)
    await loadDepartamentos()
    cancelDelete()
  } catch (err) {
    console.error('Error eliminando departamento:', err)
    alert(err.response?.data?.error || 'Error al eliminar')
  } finally {
    deleting.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  editingDepartamento.value = null
}

const cancelDelete = () => {
  deletingDepartamento.value = null
}

onMounted(() => {
  loadRegiones()
  loadDepartamentos()
})
</script>

<style scoped>
.admin-departamentos {
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

.departamentos-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.region-group {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-light);
}

.region-title {
  color: var(--primary-green);
  font-size: 20px;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-green-light);
}

.departamentos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.depto-card {
  background: var(--background-color);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.depto-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.depto-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.depto-icon {
  font-size: 32px;
}

.depto-info h3 {
  margin: 0 0 4px 0;
  color: var(--primary-green);
  font-size: 18px;
}

.depto-region {
  margin: 0;
  color: var(--text-light);
  font-size: 14px;
}

.depto-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
