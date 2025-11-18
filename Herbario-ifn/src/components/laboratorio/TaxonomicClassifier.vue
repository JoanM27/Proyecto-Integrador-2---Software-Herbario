<template>
  <div class="taxonomic-classifier">
    <div class="classifier-header">
      <h4>🔬 Clasificación Taxonómica</h4>
      <p>Selecciona la clasificación paso a paso</p>
    </div>

    <!-- Breadcrumb de navegación -->
    <div class="taxonomic-breadcrumb">
      <button 
        :class="['breadcrumb-item', { active: currentStep === 'familia' }]"
        @click="goToStep('familia')"
        :disabled="currentStep === 'familia'"
      >
        1. Familia
        <span v-if="selectedFamily" class="selected-value">{{ selectedFamily.nombre }}</span>
      </button>
      
      <span v-if="selectedFamily" class="breadcrumb-arrow">→</span>
      
      <button 
        v-if="selectedFamily"
        :class="['breadcrumb-item', { active: currentStep === 'genero' }]"
        @click="goToStep('genero')"
        :disabled="currentStep === 'genero'"
      >
        2. Género
        <span v-if="selectedGenus" class="selected-value">{{ selectedGenus.nombre }}</span>
      </button>
      
      <span v-if="selectedGenus" class="breadcrumb-arrow">→</span>
      
      <button 
        v-if="selectedGenus"
        :class="['breadcrumb-item', { active: currentStep === 'especie' }]"
        @click="goToStep('especie')"
        :disabled="currentStep === 'especie'"
      >
        3. Especie
        <span v-if="selectedSpecies" class="selected-value">{{ selectedSpecies.nombre }}</span>
      </button>
    </div>

    <!-- Contenido del paso actual -->
    <div class="classifier-content">
      <!-- PASO 1: Selección de Familia -->
      <div v-if="currentStep === 'familia'" class="step-content">
        <h5>Seleccionar Familia</h5>
        <div v-if="loadingFamilies" class="loading">
          <div class="spinner"></div>
          <p>Cargando familias...</p>
        </div>
        
        <div v-else class="selection-grid">
          <div class="search-box">
            <input 
              v-model="familySearch" 
              type="text" 
              placeholder="Buscar familia..."
              class="search-input"
            >
          </div>
          
          <div class="options-list">
            <button
              v-for="family in filteredFamilies"
              :key="family.id"
              :class="['option-item', { selected: selectedFamily?.id === family.id }]"
              @click="selectFamily(family)"
            >
              <div class="option-name">{{ family.nombre }}</div>
              <div class="option-count">{{ family.generos_count || 0 }} géneros</div>
            </button>
          </div>
        </div>
      </div>

      <!-- PASO 2: Selección de Género -->
      <div v-if="currentStep === 'genero'" class="step-content">
        <h5>Seleccionar Género de {{ selectedFamily?.nombre }}</h5>
        <div v-if="loadingGenera" class="loading">
          <div class="spinner"></div>
          <p>Cargando géneros...</p>
        </div>
        
        <div v-else class="selection-grid">
          <div class="search-box">
            <input 
              v-model="genusSearch" 
              type="text" 
              placeholder="Buscar género..."
              class="search-input"
            >
          </div>
          
          <div class="options-list">
            <button
              v-for="genus in filteredGenera"
              :key="genus.id"
              :class="['option-item', { selected: selectedGenus?.id === genus.id }]"
              @click="selectGenus(genus)"
            >
              <div class="option-name">{{ genus.nombre }}</div>
              <div class="option-count">{{ genus.especies_count || 0 }} especies</div>
            </button>
          </div>
        </div>
      </div>

      <!-- PASO 3: Selección de Especie -->
      <div v-if="currentStep === 'especie'" class="step-content">
        <h5>Seleccionar Especie de {{ selectedGenus?.nombre }}</h5>
        <div v-if="loadingSpecies" class="loading">
          <div class="spinner"></div>
          <p>Cargando especies...</p>
        </div>
        
        <div v-else class="selection-grid">
          <div class="search-box">
            <input 
              v-model="speciesSearch" 
              type="text" 
              placeholder="Buscar especie..."
              class="search-input"
            >
          </div>
          
          <div class="options-list">
            <button
              v-for="species in filteredSpecies"
              :key="species.id"
              :class="['option-item', { selected: selectedSpecies?.id === species.id }]"
              @click="selectSpecies(species)"
            >
              <div class="option-name">{{ species.nombre }}</div>
              <div class="option-subtitle">{{ species.nombre_comun || 'Sin nombre común' }}</div>
              <div v-if="species.tipo_amenaza" class="threat-badge">{{ species.tipo_amenaza }}</div>
            </button>
          </div>
        </div>
      </div>

      <!-- Resumen de selección -->
      <div v-if="selectedSpecies" class="selection-summary">
        <h5>✅ Clasificación Seleccionada</h5>
        <div class="summary-details">
          <div class="summary-item">
            <strong>Familia:</strong> {{ selectedFamily.nombre }}
          </div>
          <div class="summary-item">
            <strong>Género:</strong> {{ selectedGenus.nombre }}
          </div>
          <div class="summary-item">
            <strong>Especie:</strong> {{ selectedSpecies.nombre }}
          </div>
          <div v-if="selectedSpecies.nombre_comun" class="summary-item">
            <strong>Nombre común:</strong> {{ selectedSpecies.nombre_comun }}
          </div>
          <div v-if="selectedSpecies.tipo_amenaza" class="summary-item">
            <strong>Estado de amenaza:</strong> 
            <span :class="['threat-badge', selectedSpecies.tipo_amenaza.toLowerCase()]">
              {{ selectedSpecies.tipo_amenaza }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Botones de navegación -->
    <div class="classifier-actions">
      <button 
        v-if="canGoBack" 
        @click="goBack" 
        class="btn btn-secondary"
      >
        ← Atrás
      </button>
      
      <button 
        v-if="canContinue" 
        @click="continueNext" 
        class="btn btn-primary"
      >
        Continuar →
      </button>
      
      <button 
        v-if="selectedSpecies" 
        @click="confirmSelection" 
        class="btn btn-success"
      >
        ✅ Confirmar Clasificación
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  initialSpeciesId: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['species-selected', 'classification-changed'])

// Estado reactivo
const currentStep = ref('familia')
const loadingFamilies = ref(false)
const loadingGenera = ref(false)
const loadingSpecies = ref(false)

// Datos
const families = ref([])
const genera = ref([])
const species = ref([])

// Selecciones actuales
const selectedFamily = ref(null)
const selectedGenus = ref(null)
const selectedSpecies = ref(null)

// Búsquedas
const familySearch = ref('')
const genusSearch = ref('')
const speciesSearch = ref('')

// Computed properties
const filteredFamilies = computed(() => {
  if (!familySearch.value) return families.value
  return families.value.filter(family => 
    family.nombre.toLowerCase().includes(familySearch.value.toLowerCase())
  )
})

const filteredGenera = computed(() => {
  if (!genusSearch.value) return genera.value
  return genera.value.filter(genus => 
    genus.nombre.toLowerCase().includes(genusSearch.value.toLowerCase())
  )
})

const filteredSpecies = computed(() => {
  if (!speciesSearch.value) return species.value
  return species.value.filter(sp => 
    sp.nombre.toLowerCase().includes(speciesSearch.value.toLowerCase()) ||
    (sp.nombre_comun && sp.nombre_comun.toLowerCase().includes(speciesSearch.value.toLowerCase()))
  )
})

const canGoBack = computed(() => {
  return currentStep.value !== 'familia'
})

const canContinue = computed(() => {
  return (currentStep.value === 'familia' && selectedFamily.value) ||
         (currentStep.value === 'genero' && selectedGenus.value)
})

// Métodos
const loadFamilies = async () => {
  loadingFamilies.value = true
  try {
    const response = await fetch('http://localhost:3002/api/taxonomia/familias')
    if (response.ok) {
      families.value = await response.json()
    } else {
      throw new Error('Error cargando familias')
    }
  } catch (error) {
    console.error('Error cargando familias:', error)
    // Datos simulados para desarrollo
    families.value = [
      { id: 1, nombre: 'Rosaceae', generos_count: 15 },
      { id: 2, nombre: 'Fabaceae', generos_count: 25 },
      { id: 3, nombre: 'Asteraceae', generos_count: 30 },
      { id: 4, nombre: 'Rubiaceae', generos_count: 20 }
    ]
  } finally {
    loadingFamilies.value = false
  }
}

const loadGenera = async (familyId) => {
  loadingGenera.value = true
  try {
    const response = await fetch(`http://localhost:3002/api/taxonomia/familias/${familyId}/generos`)
    if (response.ok) {
      genera.value = await response.json()
    } else {
      throw new Error('Error cargando géneros')
    }
  } catch (error) {
    console.error('Error cargando géneros:', error)
    // Datos simulados
    genera.value = [
      { id: 1, nombre: 'Rosa', especies_count: 8 },
      { id: 2, nombre: 'Prunus', especies_count: 12 },
      { id: 3, nombre: 'Fragaria', especies_count: 5 }
    ]
  } finally {
    loadingGenera.value = false
  }
}

const loadSpecies = async (genusId) => {
  loadingSpecies.value = true
  try {
    const response = await fetch(`http://localhost:3002/api/taxonomia/generos/${genusId}/especies`)
    if (response.ok) {
      species.value = await response.json()
    } else {
      throw new Error('Error cargando especies')
    }
  } catch (error) {
    console.error('Error cargando especies:', error)
    // Datos simulados
    species.value = [
      { id: 1, nombre: 'Rosa canina', nombre_comun: 'Rosa silvestre', tipo_amenaza: null },
      { id: 2, nombre: 'Rosa gallica', nombre_comun: 'Rosa francesa', tipo_amenaza: null },
      { id: 3, nombre: 'Rosa rubiginosa', nombre_comun: 'Rosa mosqueta', tipo_amenaza: 'VU' }
    ]
  } finally {
    loadingSpecies.value = false
  }
}

const selectFamily = (family) => {
  selectedFamily.value = family
  selectedGenus.value = null
  selectedSpecies.value = null
  emit('classification-changed', { family, genus: null, species: null })
}

const selectGenus = (genus) => {
  selectedGenus.value = genus
  selectedSpecies.value = null
  emit('classification-changed', { 
    family: selectedFamily.value, 
    genus, 
    species: null 
  })
}

const selectSpecies = (speciesItem) => {
  selectedSpecies.value = speciesItem
  emit('classification-changed', { 
    family: selectedFamily.value, 
    genus: selectedGenus.value, 
    species: speciesItem 
  })
}

const goToStep = (step) => {
  currentStep.value = step
  if (step === 'genero' && selectedFamily.value && genera.value.length === 0) {
    loadGenera(selectedFamily.value.id)
  } else if (step === 'especie' && selectedGenus.value && species.value.length === 0) {
    loadSpecies(selectedGenus.value.id)
  }
}

const goBack = () => {
  if (currentStep.value === 'especie') {
    currentStep.value = 'genero'
    selectedSpecies.value = null
  } else if (currentStep.value === 'genero') {
    currentStep.value = 'familia'
    selectedGenus.value = null
    selectedSpecies.value = null
    genera.value = []
    species.value = []
  }
  emit('classification-changed', { 
    family: selectedFamily.value, 
    genus: selectedGenus.value, 
    species: selectedSpecies.value 
  })
}

const continueNext = () => {
  if (currentStep.value === 'familia' && selectedFamily.value) {
    currentStep.value = 'genero'
    loadGenera(selectedFamily.value.id)
  } else if (currentStep.value === 'genero' && selectedGenus.value) {
    currentStep.value = 'especie'
    loadSpecies(selectedGenus.value.id)
  }
}

const confirmSelection = () => {
  if (selectedSpecies.value) {
    emit('species-selected', {
      family: selectedFamily.value,
      genus: selectedGenus.value,
      species: selectedSpecies.value
    })
  }
}

// Watchers
watch(() => props.initialSpeciesId, async (newId) => {
  if (newId) {
    // TODO: Cargar la clasificación completa basada en el ID de especie
    // y navegar automáticamente a la selección
  }
})

// Inicialización
loadFamilies()
</script>

<style scoped>
.taxonomic-classifier {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.classifier-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.classifier-header h4 {
  color: #2c3e50;
  margin-bottom: 5px;
  font-size: 1.3rem;
}

.classifier-header p {
  color: #666;
  font-size: 0.9rem;
}

/* Breadcrumb */
.taxonomic-breadcrumb {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 25px;
  flex-wrap: wrap;
  gap: 10px;
}

.breadcrumb-item {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
}

.breadcrumb-item:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #adb5bd;
}

.breadcrumb-item.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.breadcrumb-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selected-value {
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 3px;
  color: #28a745;
}

.breadcrumb-item.active .selected-value {
  color: #b8daff;
}

.breadcrumb-arrow {
  font-size: 1.2rem;
  color: #6c757d;
  font-weight: bold;
}

/* Contenido */
.classifier-content {
  min-height: 300px;
  margin-bottom: 20px;
}

.step-content h5 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.1rem;
}

.search-box {
  margin-bottom: 15px;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.9rem;
}

.search-input:focus {
  border-color: #007bff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.options-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.option-item {
  text-align: left;
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.option-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
}

.option-item.selected {
  border-color: #28a745;
  background: #f8fff9;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.15);
}

.option-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 3px;
}

.option-count, .option-subtitle {
  font-size: 0.8rem;
  color: #6c757d;
}

.threat-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 5px;
}

.threat-badge.cr {
  background: #dc3545;
  color: white;
}

.threat-badge.en {
  background: #fd7e14;
  color: white;
}

.threat-badge.vu {
  background: #ffc107;
  color: #212529;
}

/* Resumen */
.selection-summary {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.selection-summary h5 {
  color: #28a745;
  margin-bottom: 15px;
}

.summary-details {
  display: grid;
  gap: 8px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.summary-item strong {
  min-width: 100px;
  color: #2c3e50;
}

/* Acciones */
.classifier-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
}

/* Loading */
.loading {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Botones */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

/* Responsive */
@media (max-width: 768px) {
  .taxonomic-breadcrumb {
    flex-direction: column;
  }
  
  .breadcrumb-arrow {
    transform: rotate(90deg);
  }
  
  .options-list {
    grid-template-columns: 1fr;
  }
  
  .classifier-actions {
    flex-direction: column;
  }
}
</style>