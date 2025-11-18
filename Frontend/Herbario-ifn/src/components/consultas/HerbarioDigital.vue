<template>
  <div>
    <!-- Header -->
    <div class="view-header">🌿 Herbario Digital - Tax-IFN</div>

    <div class="container">
      <!-- Filtros de búsqueda -->
      <div class="search-section">
        <h3>🔍 Explorar Colección</h3>
        <div class="search-filters">
          <div class="filter-group">
            <input 
              type="text" 
              v-model="searchFilters.text"
              placeholder="Buscar por nombre científico, familia, género..."
              class="search-input"
              @keyup.enter="performSearch"
            />
            <button class="btn btn-primary" @click="performSearch">Buscar</button>
          </div>
          
          <div class="filter-row">
            <select v-model="searchFilters.family" class="filter-select" @change="performSearch">
              <option value="">Todas las familias</option>
              <option v-for="familia in availableFamilies" :key="familia" :value="familia">
                {{ familia }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando especímenes...</p>
      </div>

      <!-- Galería de especímenes -->
      <div v-else class="specimens-gallery">
        <h3>🖼️ Galería de Especímenes ({{ totalSpecimens }} clasificados)</h3>
        
        <div v-if="displayedSpecimens.length === 0" class="empty-state">
          <p>No se encontraron especímenes con los filtros seleccionados</p>
        </div>
        
        <div v-else class="gallery-grid">
          <div 
            v-for="specimen in displayedSpecimens" 
            :key="specimen.id"
            class="specimen-card"
            @click="selectedSpecimen = specimen"
          >
            <div class="specimen-image">
              <ImageComponent
                :image-url="specimen.foto_url || null"
                :alt-text="`Espécimen ${specimen.nombre_cientifico || 'Sin identificar'}`"
                size="medium"
                shape="rectangle"
                :placeholder-icon="'🌿'"
                :placeholder-text="'Sin imagen del espécimen'"
                :badge="specimen.codigo"
                badge-type="primary"
                :show-overlay="true"
                :overlay-title="specimen.nombre_cientifico || 'Sin identificar'"
                :overlay-subtitle="specimen.familia || ''"
                :zoomable="true"
                @image-click="selectedSpecimen = specimen"
              />
            </div>
            <div class="specimen-info">
              <h4>{{ specimen.nombre_cientifico || 'Pendiente de identificación' }}</h4>
              <p v-if="specimen.familia" class="family">{{ specimen.familia }}</p>
              <p v-if="specimen.genero" class="genus">Género: {{ specimen.genero }}</p>
              <p class="location">📍 {{ specimen.ubicacion || 'Ubicación no especificada' }}</p>
              <p class="date">📅 {{ formatDate(specimen.fecha_coleccion) }}</p>
              <div class="status-badge" :class="specimen.estado_clasificacion">
                {{ getStatusText(specimen.estado_clasificacion) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Paginación -->
      <div v-if="totalPages > 1" class="pagination">
        <button 
          class="btn btn-secondary"
          :disabled="currentPage === 1"
          @click="changePage(currentPage - 1)"
        >
          Anterior
        </button>
        <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
        <button 
          class="btn btn-secondary"
          :disabled="currentPage === totalPages"
          @click="changePage(currentPage + 1)"
        >
          Siguiente
        </button>
      </div>

      <!-- Exploración por categorías -->
      <div v-if="availableFamilies.length > 0" class="category-exploration mt-40">
        <h3>🗂️ Explorar por Familias</h3>
        <div class="category-grid">
          <div 
            v-for="familia in topFamilies" 
            :key="familia.name"
            class="category-card" 
            @click="filterByFamily(familia.name)"
          >
            <div class="category-icon">🌿</div>
            <h4>{{ familia.name }}</h4>
            <p>{{ familia.count }} especímenes</p>
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

    <!-- Modal de detalle del espécimen -->
    <div v-if="selectedSpecimen" class="modal-overlay" @click="selectedSpecimen = null">
      <div class="modal large-modal" @click.stop>
        <h3>🔍 Detalle del Espécimen</h3>
        <div class="specimen-detail">
          <div class="detail-header">
            <h4>{{ selectedSpecimen.nombre_cientifico || 'Sin identificar' }}</h4>
            <div class="specimen-id-large">{{ selectedSpecimen.codigo }}</div>
          </div>
          
          <!-- Imagen grande -->
          <div v-if="selectedSpecimen.foto_url" class="detail-image" @click="imageModalUrl = selectedSpecimen.foto_url">
            <img :src="selectedSpecimen.foto_url" :alt="selectedSpecimen.nombre_cientifico" style="cursor: pointer;" />
            <div class="zoom-hint">🔍 Click para ampliar</div>
          </div>
          
          <div class="detail-grid">
            <div class="detail-section">
              <h5>Taxonomía</h5>
              <p><strong>Familia:</strong> {{ selectedSpecimen.familia || 'N/A' }}</p>
              <p><strong>Género:</strong> {{ selectedSpecimen.genero || 'N/A' }}</p>
              <p><strong>Especie:</strong> {{ selectedSpecimen.especie || 'N/A' }}</p>
            </div>
            
            <div class="detail-section">
              <h5>Colección</h5>
              <p><strong>Fecha:</strong> {{ formatDate(selectedSpecimen.fecha_coleccion) }}</p>
              <p><strong>Colector:</strong> {{ selectedSpecimen.colector || 'N/A' }}</p>
              <p><strong>Número:</strong> {{ selectedSpecimen.num_coleccion || 'N/A' }}</p>
            </div>
            
            <div class="detail-section">
              <h5>Localización</h5>
              <p><strong>Ubicación:</strong> {{ selectedSpecimen.ubicacion || 'N/A' }}</p>
              <p><strong>Conglomerado:</strong> {{ selectedSpecimen.conglomerado || 'N/A' }}</p>
            </div>
            
            <div class="detail-section">
              <h5>Estado</h5>
              <p><strong>Clasificación:</strong> 
                <span class="status-badge" :class="selectedSpecimen.estado_clasificacion">
                  {{ getStatusText(selectedSpecimen.estado_clasificacion) }}
                </span>
              </p>
              <p><strong>Estado reproductivo:</strong> {{ selectedSpecimen.estado_reproductivo || 'N/A' }}</p>
            </div>
          </div>
          
          <div v-if="selectedSpecimen.observaciones" class="detail-notes">
            <h5>Observaciones</h5>
            <p>{{ selectedSpecimen.observaciones }}</p>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="selectedSpecimen = null">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- Modal de imagen ampliada -->
    <div v-if="imageModalUrl" class="image-modal-overlay" @click="imageModalUrl = null">
      <div class="image-modal-content" @click.stop>
        <button class="image-modal-close" @click="imageModalUrl = null">✕</button>
        <img :src="imageModalUrl" alt="Imagen ampliada" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import ImageComponent from '../ImageComponent.vue'
import { createClient } from '@supabase/supabase-js'

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Eventos
const emit = defineEmits(['navigate'])

// Estado
const loading = ref(true)
const searchFilters = reactive({
  text: '',
  family: ''
})

const currentPage = ref(1)
const itemsPerPage = 12
const selectedSpecimen = ref(null)
const imageModalUrl = ref(null)

// Datos
const allSpecimens = ref([])
const filteredSpecimens = ref([])

// Computadas
const availableFamilies = computed(() => {
  const families = new Set()
  allSpecimens.value.forEach(s => {
    if (s.familia) families.add(s.familia)
  })
  return Array.from(families).sort()
})

const topFamilies = computed(() => {
  const familyCount = {}
  allSpecimens.value.forEach(s => {
    if (s.familia) {
      familyCount[s.familia] = (familyCount[s.familia] || 0) + 1
    }
  })
  
  return Object.entries(familyCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
})

const totalSpecimens = computed(() => allSpecimens.value.length)

const displayedSpecimens = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredSpecimens.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredSpecimens.value.length / itemsPerPage)
})

// Funciones
const loadSpecimens = async () => {
  try {
    loading.value = true
    console.log('Cargando especímenes clasificados...')
    
    // Obtener muestras completadas y firmadas
    const response = await fetch('http://localhost:3005/muestras/clasificadas')
    
    if (!response.ok) {
      throw new Error('Error al cargar especímenes')
    }
    
    const data = await response.json()
    console.log('Especímenes recibidos:', data.length)
    
    // Cargar URLs de fotos para cada muestra
    for (const muestra of data) {
      if (muestra.id_foto) {
        try {
          // Obtener info del archivo desde la tabla archivos
          const { data: archivo, error } = await supabase
            .from('archivos')
            .select('path')
            .eq('id', muestra.id_foto)
            .single()
          
          if (!error && archivo?.path) {
            const { data: urlData } = supabase.storage
              .from('archivos')
              .getPublicUrl(archivo.path)
            
            muestra.foto_url = urlData.publicUrl
          }
        } catch (error) {
          console.error(`Error cargando foto para muestra ${muestra.codigo}:`, error)
        }
      }
    }
    
    allSpecimens.value = data
    filteredSpecimens.value = data
    
  } catch (error) {
    console.error('Error cargando especímenes:', error)
    alert('Error al cargar la galería de especímenes. Verifica que el servicio de laboratorio esté activo.')
  } finally {
    loading.value = false
  }
}

const performSearch = () => {
  let filtered = allSpecimens.value
  
  // Filtrar por familia
  if (searchFilters.family) {
    filtered = filtered.filter(s => s.familia === searchFilters.family)
  }
  
  // Filtrar por texto
  if (searchFilters.text) {
    const searchText = searchFilters.text.toLowerCase()
    filtered = filtered.filter(s => 
      s.nombre_cientifico?.toLowerCase().includes(searchText) ||
      s.familia?.toLowerCase().includes(searchText) ||
      s.genero?.toLowerCase().includes(searchText) ||
      s.especie?.toLowerCase().includes(searchText)
    )
  }
  
  filteredSpecimens.value = filtered
  currentPage.value = 1
}

const filterByFamily = (family) => {
  searchFilters.family = family
  searchFilters.text = ''
  performSearch()
}

const changePage = (page) => {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getStatusText = (status) => {
  const statusMap = {
    completado: 'Clasificada',
    firmado: 'Firmada',
    clasificado: 'Clasificada',
    en_analisis: 'En Análisis',
    borrador: 'Borrador'
  }
  return statusMap[status] || status
}

// Lifecycle
onMounted(() => {
  loadSpecimens()
})
</script>

<style scoped>
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--primary-green);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-light);
  font-size: 1.1rem;
}

.search-section {
  max-width: 800px;
  margin: 0 auto 40px auto;
}

.search-filters {
  margin-top: 20px;
}

.filter-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
}

.filter-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-select {
  flex: 1;
  min-width: 200px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
}

.collection-stats {
  max-width: 800px;
  margin: 0 auto 40px auto;
  display: none; /* Ocultar estadísticas de colección */
}

.genus {
  font-size: 0.9rem;
  color: var(--text-light);
  margin: 3px 0;
}

.detail-image {
  width: 100%;
  max-height: 400px;
  margin: 20px 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f0f0f0;
}

.detail-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.2s;
}

.detail-image:hover img {
  transform: scale(1.02);
}

.zoom-hint {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.detail-image:hover .zoom-hint {
  opacity: 1;
}

/* Modal de imagen ampliada */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: zoom-out;
}

.image-modal-content {
  position: relative;
  max-width: 95vw;
  max-height: 95vh;
  cursor: default;
}

.image-modal-content img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  border-radius: 8px;
}

.image-modal-close {
  position: absolute;
  top: -40px;
  right: 0;
  background-color: rgba(255, 255, 255, 0.9);
  border: none;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  color: #333;
}

.image-modal-close:hover {
  background-color: white;
  transform: scale(1.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-green);
  margin-bottom: 5px;
}

.stat-label {
  color: var(--text-light);
  font-size: 0.9rem;
}

.specimens-gallery {
  max-width: 1200px;
  margin: 0 auto 40px auto;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.specimen-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: #fcfcfc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.specimen-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-strong);
}

.specimen-image {
  position: relative;
  height: 250px;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.specimen-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  max-height: 250px;
}

.specimen-image :deep(.image-component) {
  width: 100%;
  height: 100%;
}

.specimen-image :deep(.image-wrapper) {
  width: 100%;
  height: 100%;
  max-height: 250px;
}

.image-placeholder {
  font-size: 3rem;
  color: #ccc;
}

.specimen-id {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: var(--primary-green);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
}

.specimen-info {
  padding: 15px;
}

.specimen-info h4 {
  margin: 0 0 10px 0;
  color: var(--primary-green);
  font-style: italic;
}

.family {
  font-weight: 600;
  margin: 5px 0;
}

.location, .date {
  font-size: 0.9rem;
  color: var(--text-light);
  margin: 3px 0;
}

.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 10px;
  display: inline-block;
}

.status-badge.clasificada {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.revision {
  background-color: #fff3cd;
  color: #856404;
}

.status-badge.pendiente {
  background-color: #f8d7da;
  color: #721c24;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 40px 0;
}

.page-info {
  font-weight: 600;
}

.category-exploration {
  max-width: 800px;
  margin: 0 auto;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.category-card {
  text-align: center;
  padding: 25px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-light);
}

.category-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.category-card h4 {
  margin: 10px 0 5px 0;
  color: var(--primary-green);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  max-height: 80vh;
  overflow-y: auto;
}

.large-modal {
  max-width: 800px;
}

.specimen-detail {
  text-align: left;
  margin: 20px 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.specimen-id-large {
  background-color: var(--primary-green);
  color: white;
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.detail-section {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
}

.detail-section h5 {
  margin: 0 0 10px 0;
  color: var(--primary-green);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 5px;
}

.detail-notes {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
}

.detail-notes h5 {
  margin: 0 0 10px 0;
  color: var(--primary-green);
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .filter-select {
    min-width: auto;
  }
  
  .gallery-grid {
    grid-template-columns: 1fr;
  }
  
  .category-grid, .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>