<template>
  <div>
    <!-- Header -->
    <div class="view-header">Acceso de Usuarios - Sistema Herbario Digital</div>

    <div class="container">
      <h2 class="text-center">Iniciar Sesión</h2>
      
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="email">Correo Electrónico</label>
          <input 
            id="email"
            type="email" 
            v-model="formData.email"
            class="form-control"
            placeholder="usuario@ejemplo.com" 
            required 
            :disabled="isLoading"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Contraseña</label>
          <input 
            id="password"
            type="password" 
            v-model="formData.password"
            class="form-control"
            placeholder="Ingrese su contraseña" 
            required 
            :disabled="isLoading"
          />
        </div>
        
        <!-- Mensaje de error si existe -->
        <div v-if="errorMessage" class="error-message">
          ⚠️ {{ errorMessage }}
        </div>
        
        <!-- Mensaje de éxito si existe -->
        <div v-if="successMessage" class="success-message">
          ✓ {{ successMessage }}
        </div>
        
        <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading">
          <span v-if="isLoading">Iniciando sesión...</span>
          <span v-else>Iniciar Sesión</span>
        </button>
      </form>

      <!-- Información adicional -->
      <div class="info-section">
        <div class="info-card">
          <h3>👥 Usuarios de prueba</h3>
          <div class="user-credentials">
            <div class="credential-item">
              <span class="role-badge recepcionista">Recepcionista</span>
              <div class="credential-details">
                <code>maria.rodriguez@ifn.gov.co</code>
                <code>password123</code>
              </div>
            </div>
            
            <div class="credential-item">
              <span class="role-badge laboratorista">Laboratorista</span>
              <div class="credential-details">
                <code>carlos.vargas@ifn.gov.co</code>
                <code>password123</code>
              </div>
            </div>
            
            <div class="credential-item">
              <span class="role-badge admin">Administrador</span>
              <div class="credential-details">
                <code>admin@ifn.gov.co</code>
                <code>admin123</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Información del sistema -->
      <div class="info-section">
        <div class="info-card">
          <h3>🔐 Sistema de Autenticación</h3>
          <p class="card-description">El sistema utiliza autenticación JWT con roles diferenciados:</p>
          <div class="roles-list">
            <div class="role-item">
              <span class="role-badge recepcionista">Recepcionista</span>
              <span class="role-description">Registro de paquetes y muestras</span>
            </div>
            <div class="role-item">
              <span class="role-badge laboratorista">Laboratorista</span>
              <span class="role-description">Clasificación taxonómica</span>
            </div>
            <div class="role-item">
              <span class="role-badge admin">Administrador</span>
              <span class="role-description">Gestión completa del sistema</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { authService } from '../../services/api.js'

// Eventos
const emit = defineEmits(['loginSuccess', 'navigate'])

// Estado del formulario
const formData = reactive({
  email: '',
  password: ''
})

const isLoading = ref(false)
const errorMessage = ref(null)
const successMessage = ref(null)

// Función para manejar el envío del formulario
const handleSubmit = async () => {
  errorMessage.value = null
  successMessage.value = null
  isLoading.value = true

  try {
    // Llamar al servicio de autenticación
    const response = await authService.login(formData.email, formData.password)
    
    // Guardar datos de autenticación
    authService.saveAuthData(response.access_token, response.user)
    
    successMessage.value = `Bienvenido, ${response.user.nombre || response.user.email}!`
    
    // Esperar un momento antes de redirigir
    setTimeout(() => {
      emit('loginSuccess', response.user)
    }, 500)
    
  } catch (error) {
    console.error('Error en login:', error)
    
    if (error.response) {
      // Error del servidor
      errorMessage.value = error.response.data.error || 'Credenciales inválidas'
    } else if (error.request) {
      // No hubo respuesta del servidor
      errorMessage.value = 'No se pudo conectar con el servidor. Verifique que los servicios estén ejecutándose.'
    } else {
      // Error en la configuración
      errorMessage.value = 'Error al procesar la solicitud'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 30px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
  box-shadow: var(--shadow-light);
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  border-left: 4px solid #c33;
}

.success-message {
  background-color: #efe;
  color: #3c3;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  border-left: 4px solid #3c3;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-section {
  max-width: 700px;
  margin: 30px auto;
}

.info-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.info-card h3 {
  color: var(--primary-green);
  font-size: 18px;
  margin: 0 0 16px 0;
  font-weight: 600;
}

.card-description {
  color: var(--text-light);
  margin: 0 0 20px 0;
  font-size: 14px;
}

/* Estilos para credenciales de usuarios */
.user-credentials {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.credential-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.credential-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.credential-details code {
  background: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #374151;
  border: 1px solid #e5e7eb;
  font-family: 'Courier New', monospace;
}

/* Estilos para roles */
.roles-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.role-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  min-width: 130px;
  text-align: center;
}

.role-badge.recepcionista {
  background: #dbeafe;
  color: #1e40af;
}

.role-badge.laboratorista {
  background: #fef3c7;
  color: #92400e;
}

.role-badge.admin {
  background: #f3e8ff;
  color: #6b21a8;
}

.role-description {
  color: var(--text-light);
  font-size: 14px;
  flex: 1;
}

@media (max-width: 768px) {
  .login-form {
    margin: 0 20px;
    padding: 20px;
  }
  
  .info-section {
    margin: 20px 16px;
  }
  
  .info-card {
    padding: 20px;
  }
  
  .credential-item,
  .role-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .role-badge {
    min-width: auto;
  }
  
  .credential-details code {
    font-size: 12px;
    word-break: break-all;
  }
}
</style>