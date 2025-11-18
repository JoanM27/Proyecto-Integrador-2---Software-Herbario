<template>
  <div class="admin-usuarios">
    <div class="view-header">Gestión de Usuarios</div>
    
    <div class="manager-content">
      <div class="manager-header">
        <h1>Usuarios del Sistema</h1>
        <div class="header-actions">
          <button @click="$emit('navigate', 'AdminDashboard')" class="btn btn-secondary">
            ← Volver
          </button>
          <select v-model="selectedHerbario" @change="loadUsuarios" class="form-select">
            <option value="">Todos los herbarios</option>
            <option v-for="h in herbarios" :key="h.id" :value="h.id">
              {{ h.nombre }}
            </option>
          </select>
          <button @click="openCreateModal" class="btn btn-primary">
            ➕ Nuevo Usuario
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-message">
        <div class="spinner"></div>
        <p>Cargando usuarios...</p>
      </div>

      <div v-else-if="usuarios.length === 0" class="empty-message">
        <div class="empty-icon">👥</div>
        <h3>No hay usuarios</h3>
        <button @click="openCreateModal" class="btn btn-primary">Crear Usuario</button>
      </div>

      <div v-else class="usuarios-grid">
        <div v-for="u in usuarios" :key="u.id_user" class="usuario-card">
          <div class="usuario-header">
            <div :class="['usuario-avatar', `avatar-${u.rol}`]">
              {{ getInitials(u.nombre_completo) }}
            </div>
            <div class="usuario-info">
              <h3>{{ u.nombre_completo }}</h3>
              <p class="usuario-email">{{ u.correo_electronico }}</p>
            </div>
          </div>
          
          <div class="usuario-details">
            <div class="detail-item">
              <strong>Rol:</strong>
              <span :class="['role-badge', `role-${u.rol}`]">
                {{ formatRole(u.rol) }}
              </span>
            </div>
            <div v-if="u.cedula" class="detail-item">
              <strong>Cédula:</strong> {{ u.cedula }}
            </div>
            <div v-if="u.telefono" class="detail-item">
              <strong>Teléfono:</strong> {{ u.telefono }}
            </div>
            <div class="detail-item">
              <strong>Herbario:</strong> {{ u.herbario?.nombre || 'N/A' }}
            </div>
          </div>

          <div class="usuario-actions">
            <button @click="editUsuario(u)" class="btn btn-outline">✏️ Editar</button>
            <button @click="confirmDelete(u)" class="btn btn-danger">🗑️ Eliminar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>

        <form @submit.prevent="saveUsuario" class="modal-form">
          <div class="form-group">
            <label>Nombre Completo *</label>
            <input v-model="formData.nombre" type="text" class="form-control" required />
          </div>

          <div class="form-group">
            <label>Email *</label>
            <input v-model="formData.email" type="email" class="form-control" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Cédula</label>
              <input v-model="formData.cedula" type="text" class="form-control" />
            </div>

            <div class="form-group">
              <label>Teléfono</label>
              <input v-model="formData.telefono" type="text" class="form-control" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Herbario *</label>
              <select v-model="formData.id_herbario" class="form-control" required>
                <option value="">Seleccionar</option>
                <option v-for="h in herbarios" :key="h.id" :value="h.id">
                  {{ h.nombre }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Rol *</label>
              <select v-model="formData.rol" class="form-control" required>
                <option value="">Seleccionar</option>
                <option value="recepcionista">Recepcionista</option>
                <option value="laboratorista">Laboratorista</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Contraseña {{ editingUsuario ? '(dejar en blanco para mantener actual)' : '*' }}</label>
            <input v-model="formData.password" type="password" class="form-control" :required="!editingUsuario" :placeholder="editingUsuario ? 'Nueva contraseña (opcional)' : 'Contraseña'" />
          </div>

          <div v-if="modalError" class="error-message">{{ modalError }}</div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : (editingUsuario ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Confirmar Eliminación -->
    <div v-if="deletingUsuario" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content confirm-modal" @click.stop>
        <div class="modal-header">
          <h2>Confirmar Eliminación</h2>
          <button @click="cancelDelete" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="warning-icon">⚠️</div>
          <p>¿Eliminar usuario <strong>{{ deletingUsuario.nombre }}</strong>?</p>
          <p class="warning-text">Esta acción no se puede deshacer.</p>
        </div>

        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">Cancelar</button>
          <button @click="deleteUsuario" class="btn btn-danger" :disabled="deleting">
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

const usuarios = ref([])
const herbarios = ref([])
const selectedHerbario = ref('')
const loading = ref(false)
const showModal = ref(false)
const editingUsuario = ref(null)
const deletingUsuario = ref(null)
const saving = ref(false)
const deleting = ref(false)
const modalError = ref(null)

const formData = ref({
  nombre: '',
  email: '',
  cedula: '',
  telefono: '',
  id_herbario: '',
  rol: '',
  password: ''
})

const loadUsuarios = async () => {
  loading.value = true
  try {
    const filtros = selectedHerbario.value ? { id_herbario: selectedHerbario.value } : {}
    usuarios.value = await adminService.obtenerUsuarios(filtros)
  } catch (err) {
    console.error('Error cargando usuarios:', err)
  } finally {
    loading.value = false
  }
}

const loadHerbarios = async () => {
  try {
    herbarios.value = await adminService.obtenerHerbarios()
  } catch (err) {
    console.error('Error cargando herbarios:', err)
  }
}

const openCreateModal = () => {
  editingUsuario.value = null
  formData.value = { nombre: '', email: '', cedula: '', telefono: '', id_herbario: '', rol: '', password: '' }
  modalError.value = null
  showModal.value = true
}

const editUsuario = (usuario) => {
  editingUsuario.value = usuario
  formData.value = {
    nombre: usuario.nombre_completo,
    email: usuario.correo_electronico,
    cedula: usuario.cedula || '',
    telefono: usuario.telefono || '',
    id_herbario: usuario.id_herbario,
    rol: usuario.rol,
    password: ''
  }
  modalError.value = null
  showModal.value = true
}

const saveUsuario = async () => {
  saving.value = true
  modalError.value = null
  
  try {
    if (editingUsuario.value) {
      await adminService.actualizarUsuario(editingUsuario.value.id_user, formData.value)
    } else {
      await adminService.crearUsuario(formData.value)
    }
    
    await loadUsuarios()
    closeModal()
  } catch (err) {
    console.error('Error guardando usuario:', err)
    modalError.value = err.response?.data?.error || 'Error al guardar el usuario'
  } finally {
    saving.value = false
  }
}

const confirmDelete = (usuario) => {
  deletingUsuario.value = usuario
}

const deleteUsuario = async () => {
  deleting.value = true
  
  try {
    await adminService.eliminarUsuario(deletingUsuario.value.id_user)
    await loadUsuarios()
    cancelDelete()
  } catch (err) {
    console.error('Error eliminando usuario:', err)
    alert(err.response?.data?.error || 'Error al eliminar el usuario')
  } finally {
    deleting.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  editingUsuario.value = null
}

const cancelDelete = () => {
  deletingUsuario.value = null
}

const getInitials = (nombre) => {
  if (!nombre) return '?'
  const parts = nombre.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return nombre.substring(0, 2).toUpperCase()
}

const formatRole = (rol) => {
  const roles = {
    'recepcionista': 'Recepcionista',
    'laboratorista': 'Laboratorista',
    'admin': 'Administrador'
  }
  return roles[rol] || rol
}

onMounted(() => {
  loadHerbarios()
  loadUsuarios()
})
</script>

<style scoped>
.admin-usuarios {
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

.usuarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.usuario-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-light);
}

.usuario-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  align-items: center;
}

.usuario-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary-green);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar-consulta {
  background: #6c757d;
}

.avatar-recepcionista {
  background: #0d6efd;
}

.avatar-laboratorista {
  background: #dc3545;
}

.avatar-admin {
  background: #ffc107;
  color: #000;
}

.avatar-super_admin {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.usuario-info h3 {
  margin: 0 0 4px 0;
  color: var(--primary-green);
  font-size: 18px;
}

.usuario-email {
  color: var(--text-light);
  font-size: 14px;
  margin: 0;
}

.usuario-details {
  margin-bottom: 16px;
}

.detail-item {
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-item strong {
  color: var(--primary-green);
}

.role-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
}

.role-consulta {
  background: #e2e3e5;
  color: #383d41;
}

.role-recepcionista {
  background: #cfe2ff;
  color: #084298;
}

.role-laboratorista {
  background: #f8d7da;
  color: #721c24;
}

.role-admin {
  background: #fff3cd;
  color: #856404;
}

.role-super_admin {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.usuario-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
</style>
