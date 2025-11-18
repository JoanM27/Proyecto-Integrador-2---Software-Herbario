<template>
  <aside class="side-menu" :class="{ 'menu-collapsed': !isOpen }">
    <!-- Toggle button -->
    <button class="menu-toggle" @click="toggleMenu" :title="isOpen ? 'Cerrar menú' : 'Abrir menú'">
      <span v-if="isOpen">◀</span>
      <span v-else>▶</span>
    </button>

    <div class="menu-content" v-show="isOpen">
      <!-- Logo/Header -->
      <div class="menu-header">
        <img src="/favicon.svg" alt="Herbario" class="menu-logo">
        <h3>Navegación</h3>
      </div>

      <!-- Navigation Links -->
      <nav class="menu-nav">
        <div class="nav-section">
          <h4>Principal</h4>
          <button 
            @click="navigate('MainPage')" 
            class="menu-item"
            :class="{ active: currentView === 'MainPage' }"
          >
            <span class="icon">🏠</span>
            <span>Página Principal</span>
          </button>
        </div>

        <div class="nav-section">
          <h4>Servicios</h4>
          <button 
            @click="navigate('Estadisticas')" 
            class="menu-item"
            :class="{ active: currentView === 'Estadisticas' }"
          >
            <span class="icon">📊</span>
            <span>Estadísticas</span>
          </button>
          
          <button 
            @click="navigate('HerbarioDigital')" 
            class="menu-item"
            :class="{ active: currentView === 'HerbarioDigital' }"
          >
            <span class="icon">🌿</span>
            <span>Herbario Virtual</span>
          </button>
          
          <button 
            @click="navigate('Login')" 
            class="menu-item"
            :class="{ active: currentView === 'Login' }"
          >
            <span class="icon">🔑</span>
            <span>Iniciar Sesión</span>
          </button>
        </div>

        <div class="nav-section">
          <h4>Navegación</h4>
          <button 
            @click="goBack" 
            class="menu-item"
          >
            <span class="icon">←</span>
            <span>Volver Atrás</span>
          </button>
        </div>
      </nav>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  currentView: {
    type: String,
    default: 'MainPage'
  }
})

const emit = defineEmits(['navigate', 'goBack', 'menuToggle'])

const isOpen = ref(true) // Abierto por defecto en desktop

const toggleMenu = () => {
  isOpen.value = !isOpen.value
  emit('menuToggle', isOpen.value)
}

const navigate = (view) => {
  emit('navigate', view)
}

const goBack = () => {
  emit('goBack')
}
</script>

<style scoped>
.side-menu {
  position: fixed;
  left: 0;
  top: 60px; /* Below top navigation */
  height: calc(100vh - 60px);
  width: 250px;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 900;
  transition: width 0.3s ease;
  overflow: hidden;
}

.side-menu.menu-collapsed {
  width: 50px;
}

.menu-toggle {
  position: absolute;
  top: 10px;
  right: 8px;
  width: 32px;
  height: 32px;
  background: var(--primary-green);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;
}

.menu-toggle:hover {
  background: #1a5928;
  transform: scale(1.1);
}

.menu-collapsed .menu-toggle {
  right: 9px;
}

.menu-content {
  padding: 50px 0 20px;
  height: 100%;
  overflow-y: auto;
}

.menu-header {
  text-align: center;
  padding: 0 20px 20px;
  border-bottom: 2px solid var(--primary-green-light);
  margin-bottom: 20px;
}

.menu-logo {
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.menu-header h3 {
  color: var(--primary-green);
  font-size: 18px;
  margin: 0;
  font-weight: 600;
}

.menu-nav {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.nav-section {
  padding: 0 12px;
}

.nav-section h4 {
  color: var(--text-light);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 8px;
  font-weight: 600;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.menu-item:hover {
  background: var(--primary-green-light);
  color: var(--primary-green);
  transform: translateX(4px);
}

.menu-item.active {
  background: var(--primary-green);
  color: white;
}

.menu-item .icon {
  font-size: 18px;
  min-width: 24px;
  text-align: center;
}

/* Mobile styles */
@media (max-width: 768px) {
  .side-menu {
    width: 250px;
    transform: translateX(-100%);
  }

  .side-menu.menu-collapsed {
    width: 250px;
  }

  .menu-toggle {
    right: -40px;
    border-radius: 0 8px 8px 0;
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .side-menu:not(.menu-collapsed) {
    transform: translateX(0);
  }
}

/* Scrollbar styles */
.menu-content::-webkit-scrollbar {
  width: 6px;
}

.menu-content::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.menu-content::-webkit-scrollbar-thumb {
  background: var(--primary-green);
  border-radius: 3px;
}

.menu-content::-webkit-scrollbar-thumb:hover {
  background: #1a5928;
}
</style>
