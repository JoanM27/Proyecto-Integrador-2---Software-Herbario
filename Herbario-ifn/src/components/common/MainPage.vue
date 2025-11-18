<template>
  <div>
    <!-- Header principal -->
    <div class="view-header">Herbario Digital - Tax-IFN</div>
    
    <div class="container">
      <!-- Sección introductoria -->
      <section class="intro text-center mb-40">
        <img 
          src="/imagen representativa.jpg" 
          alt="Imagen Representativa IFN" 
          class="intro-image"
        >
      </section>

      <!-- Navegación de acceso rápido -->
      <nav class="main-navigation">
        <div class="nav-header">
          <img 
            src="/favicon.svg" 
            alt="Acceso rápido"
            class="nav-icon"
          >
          <h3>Puntos de Acceso Rápido</h3>
          <p>Navega fácilmente por los módulos principales</p>
        </div>
        
        <div class="nav-grid">
          <button 
            class="nav-card"
            @click="$emit('navigate', 'Estadisticas')"
          >
            <div class="card-icon">📊</div>
            <h4>Estadísticas</h4>
            <p>Panel de control y análisis</p>
          </button>
          
          <button 
            class="nav-card"
            @click="$emit('navigate', 'HerbarioDigital')"
          >
            <div class="card-icon">🌿</div>
            <h4>Herbario Virtual</h4>
            <p>Consulta de especímenes</p>
          </button>
          
          <button 
            class="nav-card primary"
            @click="$emit('navigate', 'Login')"
          >
            <div class="card-icon">🔑</div>
            <h4>Iniciar Sesión</h4>
            <p>Acceso al sistema de gestión</p>
          </button>
        </div>
      </nav>
    </div>
  </div>
</template>

<script setup>
// Eventos
defineEmits(['navigate'])
</script>

<style scoped>
.intro-image {
  width: 100%;
  max-width: 900px;
  height: 400px;
  object-fit: cover;
  object-position: center;
  border-radius: 12px;
  margin-top: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  filter: contrast(1.1) saturate(1.1) brightness(1.02);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.intro-image:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.main-navigation {
  max-width: 1200px;
  margin: 50px auto;
  padding: 40px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.nav-header {
  text-align: center;
  margin-bottom: 40px;
}

.nav-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.nav-header h3 {
  color: var(--primary-green);
  font-size: 28px;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.nav-header p {
  color: var(--text-light);
  font-size: 16px;
  margin: 0;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.nav-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.nav-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: var(--primary-green);
}

.nav-card.primary {
  background: linear-gradient(135deg, var(--primary-green) 0%, #1a5928 100%);
  border-color: var(--primary-green);
  color: white;
}

.nav-card.primary:hover {
  box-shadow: 0 8px 24px rgba(46, 125, 50, 0.3);
  transform: translateY(-4px) scale(1.02);
}

.card-icon {
  font-size: 48px;
  margin-bottom: 8px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.nav-card h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-card.primary h4 {
  color: white;
}

.nav-card p {
  margin: 0;
  font-size: 14px;
  color: var(--text-light);
  line-height: 1.4;
}

.nav-card.primary p {
  color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 768px) {
  .intro-image {
    max-width: 100%;
    height: 250px;
    border-radius: 8px;
  }
  
  .main-navigation {
    margin: 30px 16px;
    padding: 24px 16px;
  }
  
  .nav-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  
  .nav-card {
    padding: 24px 16px;
  }
  
  .card-icon {
    font-size: 40px;
  }
  
  .nav-header h3 {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .intro-image {
    height: 200px;
    margin-top: 15px;
  }
  
  .nav-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .nav-card {
    padding: 20px;
  }
}
</style>