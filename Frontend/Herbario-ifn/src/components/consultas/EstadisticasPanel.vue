<template>
  <div>
    <!-- Header -->
    <div class="view-header">📊 Panel de Estadísticas</div>

    <div class="container">
      <!-- Distribución por familias -->
      <div class="charts-section mt-40">
        <h3>🌿 Distribución Taxonómica por Ubicación</h3>
        
        <!-- Filtros de selección -->
        <div class="filters-container">
          <div class="filter-group">
            <label for="locationType">Tipo de Ubicación:</label>
            <select id="locationType" v-model="filters.locationType" class="form-select" @change="onLocationTypeChange">
              <option value="departamento">Departamento</option>
              <option value="region">Región</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="location">{{ filters.locationType === 'departamento' ? 'Departamento' : 'Región' }}:</label>
            <select id="location" v-model="filters.selectedLocation" class="form-select" @change="onLocationChange">
              <option value="">-- Seleccionar --</option>
              <option v-for="loc in availableLocations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="taxonLevel">Nivel Taxonómico:</label>
            <select id="taxonLevel" v-model="filters.taxonLevel" class="form-select" @change="onTaxonLevelChange">
              <option value="familia">Familia</option>
              <option value="genero">Género</option>
            </select>
          </div>
        </div>

        <!-- Mostrar resultados filtrados -->
        <div v-if="loading.taxon" class="loading-state">
          <p>⏳ Cargando datos taxonómicos...</p>
        </div>

        <div v-else-if="filters.selectedLocation" class="filtered-results">
          <h4>
            Top {{ filters.taxonLevel === 'familia' ? 'Familias' : 'Géneros' }} en 
            {{ filters.selectedLocation }}
          </h4>
          <div v-if="filteredTaxonData.length > 0" class="family-distribution">
            <div v-for="item in filteredTaxonData" :key="item.name" class="family-item">
              <span class="family-name">{{ item.name }}</span>
              <div class="family-bar">
                <div class="family-progress" :style="{ width: item.percentage + '%' }"></div>
              </div>
              <span class="family-count">{{ item.count }} especímenes</span>
              <span class="family-percentage">{{ item.percentage }}%</span>
            </div>
          </div>
          <div v-else class="empty-state">
            <p>No hay datos disponibles para esta ubicación</p>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>👆 Selecciona una ubicación para ver la distribución taxonómica</p>
        </div>
      </div>

      <!-- Proporción de Especies Amenazadas -->
      <div class="endangered-section mt-40">
        <h3>🚨 Distribución por Grado de Amenaza</h3>
        
        <div v-if="loading.general" class="loading-state">
          <p>⏳ Cargando datos...</p>
        </div>

        <div v-else-if="endangeredData.length > 0" class="endangered-card">
          <div class="endangered-chart">
            <div v-for="item in endangeredData" :key="item.categoria" class="threat-category">
              <div class="threat-header">
                <span class="threat-icon">{{ getThreatIcon(item.categoria) }}</span>
                <div class="threat-info">
                  <h4 class="threat-name">{{ item.categoria }}</h4>
                  <span class="threat-description">{{ getThreatDescription(item.categoria) }}</span>
                </div>
                <div class="threat-stats">
                  <span class="threat-count">{{ item.count }}</span>
                  <span class="threat-percentage">{{ item.porcentaje }}%</span>
                </div>
              </div>
              <div class="threat-bar">
                <div 
                  class="threat-fill" 
                  :class="getThreatClass(item.categoria)"
                  :style="{ width: item.porcentaje + '%' }"
                >
                  <span v-if="item.porcentaje > 15" class="threat-bar-label">{{ item.porcentaje }}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="endangered-footer">
            <p>
              <strong>Categorías UICN:</strong> CR (En Peligro Crítico), EN (En Peligro), 
              VU (Vulnerable), NT (Casi Amenazado), LC/NN (Preocupación Menor)
            </p>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>No hay datos de clasificación disponibles</p>
        </div>
      </div>

      <!-- Distribución geográfica -->
      <div class="geographic-section mt-40">
        <h3>🗺️ Distribución Geográfica por Departamento</h3>
        
        <div v-if="loading.general" class="loading-state">
          <p>⏳ Cargando datos geográficos...</p>
        </div>

        <div v-else-if="geographicData.length > 0" class="geographic-grid">
          <div v-for="department in geographicData" :key="department.name" class="geographic-item">
            <div class="department-info">
              <h4>{{ department.name }}</h4>
              <div class="department-stats">
                <span>{{ department.specimens }} especímenes</span>
                <span>{{ department.species }} especies</span>
                <span class="department-percentage">{{ department.percentage }}%</span>
              </div>
            </div>
            <div class="department-bar">
              <div class="department-progress" :style="{ width: department.percentage + '%' }"></div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>No hay datos geográficos disponibles</p>
        </div>
      </div>

      <!-- Distribución por región -->
      <div class="region-section mt-40">
        <h3>🌎 Distribución por Región</h3>
        <div class="region-grid">
          <div v-for="region in regionData" :key="region.name" class="region-card">
            <div class="region-header">
              <h4>{{ region.name }}</h4>
              <div class="region-badge">{{ region.departments }} dept.</div>
            </div>
            <div class="region-stats">
              <div class="stat-item">
                <span class="stat-label">Especímenes:</span>
                <span class="stat-value">{{ region.specimens }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Especies:</span>
                <span class="stat-value">{{ region.species }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Familias:</span>
                <span class="stat-value">{{ region.families }}</span>
              </div>
            </div>
            <div class="region-progress-bar">
              <div class="region-fill" :style="{ width: region.percentage + '%' }">
                <span class="region-percentage-label">{{ region.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Botón volver -->
      <div class="text-center mt-40">
        <button 
          class="btn btn-secondary"
          @click="$emit('navigate', 'MainPage')"
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import axios from 'axios'

// Eventos
const emit = defineEmits(['navigate'])

// URL del servicio de laboratorio
const LAB_SERVICE_URL = 'http://localhost:3005'

// Datos geográficos por departamento
const geographicData = reactive([
  { name: 'Cundinamarca', specimens: 0, species: 0, percentage: 0 },
  { name: 'Antioquia', specimens: 0, species: 0, percentage: 0 },
  { name: 'Valle del Cauca', specimens: 0, species: 0, percentage: 0 },
  { name: 'Boyacá', specimens: 0, species: 0, percentage: 0 },
  { name: 'Santander', specimens: 0, species: 0, percentage: 0 },
  { name: 'Otros', specimens: 0, species: 0, percentage: 0 }
])

// Datos por región
const regionData = reactive([
  { 
    name: 'Andina', 
    departments: 0, 
    specimens: 0, 
    species: 0, 
    families: 0, 
    percentage: 0
  },
  { 
    name: 'Caribe', 
    departments: 0, 
    specimens: 0, 
    species: 0, 
    families: 0, 
    percentage: 0
  },
  { 
    name: 'Pacífica', 
    departments: 0, 
    specimens: 0, 
    species: 0, 
    families: 0, 
    percentage: 0
  },
  { 
    name: 'Orinoquía', 
    departments: 0, 
    specimens: 0, 
    species: 0, 
    families: 0, 
    percentage: 0
  },
  { 
    name: 'Amazonía', 
    departments: 0, 
    specimens: 0, 
    species: 0, 
    families: 0, 
    percentage: 0
  }
])

// Datos de especies amenazadas
const endangeredData = reactive([])

// Filtros para distribución taxonómica
const filters = reactive({
  locationType: 'departamento',
  selectedLocation: '',
  taxonLevel: 'familia'
})

// Datos de ejemplo para familias/géneros (se reemplazarán con datos reales de la API)
const taxonDataByLocation = reactive({})

// Estado de carga
const loading = reactive({
  general: false,
  taxon: false
})

// Computed: Ubicaciones disponibles según tipo seleccionado
const availableLocations = computed(() => {
  if (filters.locationType === 'departamento') {
    return geographicData.map(d => d.name).filter(n => n !== 'Otros')
  } else {
    return regionData.map(r => r.name)
  }
})

// Computed: Datos filtrados de taxonomía
const filteredTaxonData = computed(() => {
  if (!filters.selectedLocation) return []
  
  const locationData = taxonDataByLocation[filters.selectedLocation]
  if (!locationData) return []
  
  return locationData[filters.taxonLevel] || []
})

// Handlers
const onLocationTypeChange = () => {
  filters.selectedLocation = ''
}

const onLocationChange = async () => {
  if (!filters.selectedLocation) return
  
  loading.taxon = true
  try {
    const response = await axios.get(`${LAB_SERVICE_URL}/estadisticas/taxonomia`, {
      params: {
        ubicacion: filters.selectedLocation,
        tipo: filters.locationType,
        nivel: filters.taxonLevel
      }
    })
    
    // Inicializar si no existe
    if (!taxonDataByLocation[filters.selectedLocation]) {
      taxonDataByLocation[filters.selectedLocation] = {
        familia: [],
        genero: []
      }
    }
    
    // Guardar datos
    taxonDataByLocation[filters.selectedLocation][filters.taxonLevel] = response.data
  } catch (error) {
    console.error('Error cargando datos taxonómicos:', error)
    alert('Error al cargar datos taxonómicos. Verifica que el servicio de laboratorio esté activo.')
  } finally {
    loading.taxon = false
  }
}

const onTaxonLevelChange = async () => {
  // Si ya hay ubicación seleccionada, recargar datos con nuevo nivel
  if (filters.selectedLocation) {
    await onLocationChange()
  }
}

// Funciones helper para categorías de amenaza
const getThreatIcon = (categoria) => {
  const icons = {
    'CR': '🔴', // Critically Endangered
    'EN': '🟠', // Endangered
    'VU': '🟡', // Vulnerable
    'NT': '🟢', // Near Threatened
    'LC': '✅', // Least Concern
    'NN': '✅', // Preocupación Menor
    'No Amenazado': '✅'
  }
  return icons[categoria] || '⚪'
}

const getThreatDescription = (categoria) => {
  const descriptions = {
    'CR': 'En Peligro Crítico',
    'EN': 'En Peligro',
    'VU': 'Vulnerable',
    'NT': 'Casi Amenazado',
    'LC': 'Preocupación Menor',
    'NN': 'Preocupación Menor',
    'No Amenazado': 'Sin categoría de amenaza'
  }
  return descriptions[categoria] || categoria
}

const getThreatClass = (categoria) => {
  const classes = {
    'CR': 'threat-critical',
    'EN': 'threat-endangered',
    'VU': 'threat-vulnerable',
    'NT': 'threat-near',
    'LC': 'threat-least',
    'NN': 'threat-least',
    'No Amenazado': 'threat-safe'
  }
  return classes[categoria] || 'threat-unknown'
}

// Cargar datos al montar el componente
onMounted(async () => {
  await loadStatistics()
})

const loadStatistics = async () => {
  loading.general = true
  try {
    const response = await axios.get(`${LAB_SERVICE_URL}/estadisticas`)
    
    const data = response.data
    
    // Actualizar datos de departamentos
    if (data.departamentos && data.departamentos.length > 0) {
      // Limpiar datos actuales
      geographicData.splice(0, geographicData.length)
      
      // Agregar departamentos del backend
      data.departamentos.forEach(dept => {
        geographicData.push({
          name: dept.name,
          specimens: dept.specimens,
          species: dept.species,
          percentage: dept.percentage
        })
      })
    }
    
    // Actualizar datos de regiones
    if (data.regiones && data.regiones.length > 0) {
      data.regiones.forEach((regionBackend, index) => {
        if (regionData[index]) {
          regionData[index].departments = regionBackend.departments
          regionData[index].specimens = regionBackend.specimens
          regionData[index].species = regionBackend.species
          regionData[index].families = regionBackend.families
          regionData[index].percentage = regionBackend.percentage
        }
      })
    }
    
    // Actualizar datos de especies amenazadas
    if (data.especies_amenazadas && Array.isArray(data.especies_amenazadas)) {
      endangeredData.splice(0, endangeredData.length, ...data.especies_amenazadas);
    }
    
    console.log('✅ Estadísticas cargadas:', {
      departamentos: geographicData.length,
      regiones: regionData.length,
      totalEspecimenes: data.total_especimenes,
      totalClasificaciones: data.total_clasificaciones,
      especiesAmenazadas: endangeredData
    })
  } catch (error) {
    console.error('Error cargando estadísticas:', error)
    alert('Error al cargar estadísticas. Verifica que el servicio de laboratorio esté activo en el puerto 3005.')
  } finally {
    loading.general = false
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.mt-40 {
  margin-top: 40px;
}

.charts-section {
  max-width: 1000px;
  margin: 40px auto;
  background-color: #fcfcfc;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--shadow-light);
}

.charts-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--primary-green);
}

/* Filters */
.filters-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  font-weight: 600;
  color: var(--primary-green);
  font-size: 0.9rem;
}

.form-select {
  padding: 10px 12px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: 'Montserrat', sans-serif;
  background-color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.form-select:hover {
  border-color: var(--primary-green);
}

.form-select:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-light);
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-top: 20px;
}

.empty-state p {
  font-size: 1.1rem;
  margin: 0;
}

/* Loading state */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--primary-green);
  background-color: #e8f5e9;
  border-radius: 8px;
  margin-top: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-state p {
  font-size: 1.1rem;
  margin: 0;
  font-weight: 600;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Filtered results */
.filtered-results {
  margin-top: 20px;
}

.filtered-results h4 {
  color: var(--primary-green);
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.family-distribution {
  margin-top: 20px;
}

.family-item {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding: 10px;
  background-color: white;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.family-item:hover {
  background-color: #f8f9fa;
  transform: translateX(5px);
}

.family-name {
  min-width: 120px;
  font-weight: 600;
  font-style: italic;
  color: var(--primary-green);
}

.family-bar {
  flex: 1;
  height: 24px;
  background-color: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
}

.family-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-green) 0%, var(--light-green) 100%);
  border-radius: 12px;
  transition: width 0.3s ease;
}

.family-count {
  min-width: 110px;
  font-size: 0.85rem;
  color: var(--text-light);
  text-align: right;
}

.family-percentage {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: var(--primary-green);
  font-size: 0.95rem;
}

.geographic-section {
  max-width: 900px;
  margin: 40px auto;
  padding: 30px;
  background-color: #fcfcfc;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-light);
}

.geographic-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--primary-green);
}

.geographic-grid {
  margin-top: 20px;
}

.geographic-item {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
  transition: all 0.3s ease;
}

.geographic-item:hover {
  box-shadow: var(--shadow-light);
  transform: translateX(5px);
}

.department-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.department-info h4 {
  margin: 0;
  color: var(--primary-green);
  font-size: 1.1rem;
}

.department-stats {
  display: flex;
  gap: 15px;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-light);
}

.department-percentage {
  font-weight: 700;
  color: var(--primary-green);
  font-size: 1rem;
}

.department-bar {
  height: 14px;
  background-color: #e9ecef;
  border-radius: 7px;
  overflow: hidden;
}

.department-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-green) 0%, var(--light-green) 100%);
  border-radius: 7px;
  transition: width 0.3s ease;
}

/* Region section */
.region-section {
  max-width: 1200px;
  margin: 40px auto;
  padding: 30px;
  background-color: #fcfcfc;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-light);
}

.region-section h3 {
  margin-top: 0;
  margin-bottom: 25px;
  color: var(--primary-green);
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.region-card {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  background-color: #fcfcfc;
  transition: all 0.3s ease;
}

.region-card:hover {
  box-shadow: var(--shadow-card);
  transform: translateY(-5px);
}

.region-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--primary-green);
}

.region-header h4 {
  margin: 0;
  color: var(--primary-green);
  font-size: 1.2rem;
}

.region-badge {
  background-color: var(--primary-green);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.region-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.stat-label {
  color: var(--text-light);
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 700;
  color: var(--primary-green);
  font-size: 1.1rem;
}

.region-progress-bar {
  height: 28px;
  background-color: #e9ecef;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
}

.region-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-green) 0%, var(--light-green) 100%);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  transition: width 0.5s ease;
}

.region-percentage-label {
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.text-center {
  text-align: center;
  margin-top: 40px;
  padding: 20px 0;
}

.btn {
  padding: 12px 30px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  font-family: 'Montserrat', sans-serif;
}

.btn-secondary {
  background-color: var(--primary-green);
  color: white;
}

.btn-secondary:hover {
  background-color: #2e7d32;
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

/* Especies Amenazadas Section */
.endangered-section {
  margin: 40px auto;
  max-width: 1200px;
}

.endangered-section h3 {
  color: var(--primary-green);
  font-size: 1.5rem;
  margin-bottom: 20px;
  font-weight: 700;
  text-align: center;
}

.endangered-card {
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.1);
  border: 2px solid #ffcdd2;
}

.endangered-chart {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.threat-category {
  background: white;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.threat-category:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.threat-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 15px;
  align-items: center;
  margin-bottom: 10px;
}

.threat-icon {
  font-size: 2rem;
  line-height: 1;
}

.threat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.threat-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #333;
}

.threat-description {
  font-size: 0.85rem;
  color: #666;
}

.threat-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.threat-count {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
}

.threat-percentage {
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
}

.threat-bar {
  height: 32px;
  background-color: #f0f0f0;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}

.threat-fill {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  transition: width 0.8s ease;
  position: relative;
}

.threat-bar-label {
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* Colores por categoría de amenaza */
.threat-critical {
  background: linear-gradient(90deg, #c62828 0%, #d32f2f 100%);
}

.threat-endangered {
  background: linear-gradient(90deg, #ef6c00 0%, #f57c00 100%);
}

.threat-vulnerable {
  background: linear-gradient(90deg, #f9a825 0%, #fbc02d 100%);
}

.threat-near {
  background: linear-gradient(90deg, #7cb342 0%, #8bc34a 100%);
}

.threat-least, .threat-safe {
  background: linear-gradient(90deg, #388e3c 0%, #43a047 100%);
}

.threat-deficient {
  background: linear-gradient(90deg, #757575 0%, #9e9e9e 100%);
}

.threat-unknown {
  background: linear-gradient(90deg, #546e7a 0%, #607d8b 100%);
}

.endangered-footer {
  background-color: rgba(255, 152, 0, 0.05);
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
  margin-top: 20px;
}

.endangered-footer p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
  line-height: 1.5;
}

.endangered-footer strong {
  color: #f57c00;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }

  .charts-section,
  .geographic-section,
  .region-section {
    padding: 20px;
    margin: 20px auto;
  }

  .department-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .department-stats {
    gap: 10px;
    flex-wrap: wrap;
  }

  .family-name {
    min-width: 100px;
    font-size: 0.9rem;
  }

  .family-item {
    flex-wrap: wrap;
    gap: 10px;
  }

  .family-count {
    min-width: auto;
  }

  .region-grid {
    grid-template-columns: 1fr;
  }

  .filters-container {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .threat-header {
    grid-template-columns: auto 1fr;
    gap: 10px;
  }

  .threat-stats {
    grid-column: 2;
    align-items: flex-start;
    margin-top: 5px;
  }

  .threat-icon {
    font-size: 1.5rem;
  }

  .threat-name {
    font-size: 1rem;
  }
}
</style>