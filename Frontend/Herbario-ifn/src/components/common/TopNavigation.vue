<template>
  <nav class="top-nav">
    <!-- Logo y nombre -->
    <div class="logo">
      <img :src="logoIcon" alt="Logo Herbario Digital Tax-IFN">
      <span>Herbario Digital - Tax-IFN</span>
    </div>
    
    <!-- Menú de navegación -->
    <div class="menu">
      <ul>
        <li>
          <a href="#" @click.prevent="$emit('navigate', 'MainPage')">
            Inicio
          </a>
        </li>
        <li>
          <a href="#" @click.prevent="$emit('navigate', 'HerbarioDigital')">
            Explorar
          </a>
        </li>
        <li>
          <a href="#" @click.prevent="$emit('navigate', 'Estadisticas')">
            Estadísticas
          </a>
        </li>
      </ul>
    </div>
    
    <!-- Acciones de usuario -->
    <div class="user-actions">
      <template v-if="isLoggedIn">
        <div class="user-info">
          <span class="user-name">{{ userData.nombre }}</span>
          <span v-if="userData.herbario" class="user-herbario">{{ userData.herbario }}</span>
        </div>
        <button @click="$emit('logout')">
          Cerrar Sesión
        </button>
      </template>
      <template v-else>
        <button @click="$emit('navigate', 'Login')">
          Acceder
        </button>
      </template>
    </div>
  </nav>
</template>

<script setup>
// Props
defineProps({
  userData: {
    type: Object,
    required: true
  },
  isLoggedIn: {
    type: Boolean,
    required: true
  }
})

// Eventos
defineEmits(['navigate', 'logout'])

// Logo SVG en base64 (icono de hoja con elementos taxonómicos)
const logoIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMmU3ZDMyO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzRjYWY1MDtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48Zz48cGF0aCBkPSJNMjU2IDUwQzMwMCA4MCAzNTAgMTQwIDM4MCAyMDBDNDAwIDI2MCA0MDAgMzIwIDM4MCAzODBDMzUwIDQ0MCAzMDAgNTAwIDI1NiA1MDBDMjEyIDUwMCAxNjIgNDQwIDEzMiAzODBDMTEyIDMyMCAxMTIgMjYwIDEzMiAyMDBDMTYyIDE0MCAyMTIgODAgMjU2IDUwWiIgZmlsbD0idXJsKCNncmFkKSIvPjxwYXRoIGQ9Ik0yNTYgMTAwQzI4NSAxMjAgMzEwIDE1MCAzMjUgMTgwQzM0MCAyMTAgMzQwIDI0MCAzMjUgMjcwQzMxMCAzMDAgMjg1IDMzMCAyNTYgMzUwQzIyNyAzMzAgMjAyIDMwMCAxODcgMjcwQzE3MiAyNDAgMTcyIDIxMCAxODcgMTgwQzIwMiAxNTAgMjI3IDEyMCAyNTYgMTAwWiIgZmlsbD0iIzFlNTkyMiIvPjx0ZXh0IHg9IjI1NiIgeT0iNDUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMWU1OTIyIiBmb250LWZhbWlseT0ic2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZvbnQtd2VpZ2h0PSJib2xkIj5UQVg8L3RleHQ+PC9nPjwvc3ZnPg=='
</script>

<style scoped>
.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 16px;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.user-herbario {
  font-size: 12px;
  color: var(--text-light);
  font-style: italic;
  margin-top: 2px;
}
</style>