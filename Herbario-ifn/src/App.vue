<script setup>
import { ref, computed, onMounted } from 'vue'
import { authService } from './services/api.js'
// Componentes comunes
import TopNavigation from './components/common/TopNavigation.vue'
import MainPage from './components/common/MainPage.vue'
import AppFooter from './components/common/AppFooter.vue'
import SideMenu from './components/common/SideMenu.vue'
// Componentes de autenticación
import LoginPage from './components/auth/LoginPage.vue'
// Componentes de recepción
import RecepcionDashboard from './components/recepcion/RecepcionDashboard.vue'
// Componentes de laboratorio
import LaboratorioDashboard from './components/laboratorio/LaboratorioDashboard.vue'
// Componentes de consultas
import HerbarioDigital from './components/consultas/HerbarioDigital.vue'
import EstadisticasPanel from './components/consultas/EstadisticasPanel.vue'
// Componentes de administración
import AdminDashboard from './components/admin/AdminDashboard.vue'
import AdminHerbarios from './components/admin/AdminHerbarios.vue'
import AdminUsuarios from './components/admin/AdminUsuarios.vue'
import AdminRegiones from './components/admin/AdminRegiones.vue'
import AdminDepartamentos from './components/admin/AdminDepartamentos.vue'
import AdminMunicipios from './components/admin/AdminMunicipios.vue'
// Demo (mantener en raíz)
import ImageDemo from './components/ImageDemo.vue'

// Estado global de la aplicación
const currentView = ref('MainPage')
const navigationHistory = ref(['MainPage'])
const isMenuOpen = ref(true)
const userData = ref({
  nombre: 'Invitado',
  rol: null,
  email: null,
  herbario: null
})

// Verificar si hay sesión activa al cargar la app
onMounted(() => {
  const savedUser = authService.getUser()
  if (savedUser && authService.isAuthenticated()) {
    userData.value = savedUser
    // Redirigir según el rol
    redirectByRole(savedUser.rol)
  }
})

// Función para navegar entre vistas
const navigateTo = (view, data = null) => {
  console.log(`[FRONTEND] Navegando a: ${view}`)
  
  // Agregar a historial si es una vista nueva
  if (currentView.value !== view) {
    navigationHistory.value.push(view)
  }
  
  currentView.value = view
  if (data) {
    // Manejar datos adicionales si es necesario
  }
}

// Función para volver atrás en el historial
const goBack = () => {
  if (navigationHistory.value.length > 1) {
    navigationHistory.value.pop() // Remover vista actual
    const previousView = navigationHistory.value[navigationHistory.value.length - 1]
    currentView.value = previousView
    console.log(`[FRONTEND] Volviendo a: ${previousView}`)
  } else {
    // Si no hay historial, ir a MainPage
    navigateTo('MainPage')
  }
}

// Función para manejar el toggle del menú lateral
const handleMenuToggle = (isOpen) => {
  isMenuOpen.value = isOpen
}

// Función para redirigir según el rol del usuario
const redirectByRole = (rol) => {
  console.log(`[FRONTEND] Redirigiendo según rol: ${rol}`)
  
  if (!rol) {
    console.warn('[FRONTEND] Rol no definido, redirigiendo a MainPage')
    navigateTo('MainPage')
    return
  }

  const roleLowerCase = rol.toLowerCase().trim()
  
  // Roles exactos de la base de datos
  if (roleLowerCase === 'recepcionista') {
    navigateTo('RecepcionDashboard')
  } else if (roleLowerCase === 'laboratorista') {
    navigateTo('LaboratorioDashboard')
  } else if (roleLowerCase === 'admin' || roleLowerCase === 'super_admin') {
    navigateTo('AdminDashboard')
  } else if (roleLowerCase === 'consulta') {
    // Usuario de solo consulta va a herbario digital
    navigateTo('HerbarioDigital')
  } else {
    // Rol desconocido, ir a página principal
    console.warn(`[FRONTEND] Rol desconocido: ${rol}`)
    navigateTo('MainPage')
  }
}

// Función para manejar login exitoso
const handleLoginSuccess = (user) => {
  console.log('[FRONTEND] Login exitoso:', user)
  
  userData.value = {
    nombre: user.nombre || user.email,
    rol: user.rol,
    email: user.email,
    herbario: user.herbario || 'IDEAM',
    id: user.id
  }
  
  // Redirigir según el rol
  redirectByRole(user.rol)
}

// Función para manejar logout
const handleLogout = () => {
  console.log('[FRONTEND] Cerrando sesión')
  authService.logout()
  userData.value = { nombre: 'Invitado', rol: null, email: null, herbario: null }
  navigateTo('MainPage')
}

// Computadas para facilitar el uso en componentes
const isLoggedIn = computed(() => userData.value.rol !== null)
const isRecepcionista = computed(() => (userData.value.rol || '').toLowerCase() === 'recepcionista')
const isLaboratorista = computed(() => (userData.value.rol || '').toLowerCase() === 'laboratorista')
const isAdmin = computed(() => {
  const rol = (userData.value.rol || '').toLowerCase()
  return rol === 'admin' || rol === 'super_admin'
})
const isConsulta = computed(() => (userData.value.rol || '').toLowerCase() === 'consulta')
</script>

<template>
  <div class="app-container">
    <!-- Navegación superior siempre presente -->
    <TopNavigation 
      :userData="userData"
      :isLoggedIn="isLoggedIn"
      @navigate="navigateTo"
      @logout="handleLogout"
    />

    <!-- Menú lateral izquierdo -->
    <SideMenu 
      :currentView="currentView"
      @navigate="navigateTo"
      @goBack="goBack"
      @menuToggle="handleMenuToggle"
    />

    <!-- Contenido principal con transiciones suaves -->
    <div class="content-area" :class="{ 'menu-collapsed': !isMenuOpen }">
      <Transition name="fade" mode="out-in">
        <!-- Página principal -->
        <MainPage 
          v-if="currentView === 'MainPage'"
          @navigate="navigateTo"
        />
        
        <!-- Login -->
        <LoginPage 
          v-else-if="currentView === 'Login'"
          @loginSuccess="handleLoginSuccess"
          @navigate="navigateTo"
        />
        
        <!-- Dashboard de Recepción -->
        <RecepcionDashboard 
          v-else-if="currentView === 'RecepcionDashboard'"
          :currentUser="userData"
          @logout="handleLogout"
        />
        
        <!-- Dashboard de Laboratorio -->
        <LaboratorioDashboard 
          v-else-if="currentView === 'LaboratorioDashboard'"
          :currentUser="userData"
          @logout="handleLogout"
        />
        
        <!-- Dashboard de Brigada -->
        <!-- <BrigadaDashboard 
          v-else-if="currentView === 'BrigadaDashboard'"
          :currentUser="userData"
          @logout="handleLogout"
        /> -->
        
        <!-- Herbario Digital -->
        <HerbarioDigital 
          v-else-if="currentView === 'HerbarioDigital'"
          @navigate="navigateTo"
        />
        
        <!-- Panel de Estadísticas -->
        <EstadisticasPanel 
          v-else-if="currentView === 'Estadisticas'"
          @navigate="navigateTo"
        />
        
        <!-- Demo de Imágenes -->
        <ImageDemo 
          v-else-if="currentView === 'ImageDemo'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Dashboard -->
        <AdminDashboard 
          v-else-if="currentView === 'AdminDashboard'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Herbarios -->
        <AdminHerbarios 
          v-else-if="currentView === 'AdminHerbarios'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Usuarios -->
        <AdminUsuarios 
          v-else-if="currentView === 'AdminUsuarios'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Regiones -->
        <AdminRegiones 
          v-else-if="currentView === 'AdminRegiones'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Departamentos -->
        <AdminDepartamentos 
          v-else-if="currentView === 'AdminDepartamentos'"
          @navigate="navigateTo"
        />
        
        <!-- Admin Municipios -->
        <AdminMunicipios 
          v-else-if="currentView === 'AdminMunicipios'"
          @navigate="navigateTo"
        />
        
        <!-- Página 404 -->
        <div v-else class="container text-center">
          <h2>Error 404</h2>
          <p>Página no encontrada.</p>
          <button class="btn btn-primary" @click="navigateTo('MainPage')">
            Volver al Inicio
          </button>
        </div>
      </Transition>
    </div>
    
    <!-- Footer siempre presente -->
    <AppFooter :class="{ 'menu-collapsed': !isMenuOpen }" />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-light);
}

.content-area {
  flex: 1;
  margin-left: 250px; /* Space for side menu */
  margin-top: 60px; /* Space for top navigation */
  padding: 20px;
  transition: margin-left 0.3s ease;
  min-height: calc(100vh - 60px);
}

.content-area.menu-collapsed {
  margin-left: 50px;
}

@media (max-width: 768px) {
  .content-area {
    margin-left: 0 !important; /* No margin on mobile, menu slides in */
  }
}

/* Transiciones para cambio de vistas */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
