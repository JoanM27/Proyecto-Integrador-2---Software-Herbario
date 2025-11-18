<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="footer-section">
        <h3>Proyecto Integrador II</h3>
        <p class="footer-subtitle">Herbario Digital</p>
      </div>
      
      <div class="footer-section">
        <h4>Desarrollado por:</h4>
        <ul class="developers-list">
          <li>Joan Sebastian Mejia Moreno</li>
          <li>Karol Daniela Rueda Hernández</li>
          <li>Andrés Camilo Cobos Sandoval</li>
        </ul>
      </div>
    </div>
    
    <div class="footer-bottom">
      <p>&copy; {{ currentYear }} - Universidad de Investigación y Desarrollo UDI</p>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>

<style scoped>
.app-footer {
  background: linear-gradient(135deg, var(--primary-green) 0%, #1a5928 100%);
  color: white;
  padding: 20px 20px 12px;
  margin-top: auto;
  margin-left: 250px; /* Space for side menu */
  transition: margin-left 0.3s ease;
}

.app-footer.menu-collapsed {
  margin-left: 50px;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.footer-section h3 {
  color: white;
  font-size: 18px;
  margin: 0 0 4px 0;
  font-weight: 600;
}

.footer-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin: 0;
  font-style: italic;
}

.footer-section h4 {
  color: white;
  font-size: 14px;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.developers-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.developers-list li {
  color: rgba(255, 255, 255, 0.9);
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.4;
}

.developers-list li:before {
  content: "👤 ";
  margin-right: 8px;
}

.footer-bottom {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 12px;
  text-align: center;
}

.footer-bottom p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  margin: 0;
}

@media (max-width: 768px) {
  .app-footer {
    padding: 16px 16px 10px;
    margin-left: 0 !important; /* No margin on mobile */
  }
  
  .footer-content {
    gap: 20px;
    padding-bottom: 12px;
  }
  
  .footer-section h3 {
    font-size: 16px;
  }
  
  .developers-list li {
    font-size: 12px;
  }
}
</style>
