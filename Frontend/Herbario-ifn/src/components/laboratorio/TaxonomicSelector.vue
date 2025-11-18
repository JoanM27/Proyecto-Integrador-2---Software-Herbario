<template>
  <div class="taxonomic-selector">
    <!-- Header compacto -->
    <div class="selector-header">
      <h4>🌿 Clasificación Taxonómica</h4>
      <div class="taxonomy-breadcrumb">
        <button 
          @click="resetToStep('familia')"
          :class="['breadcrumb-btn', { active: currentStep === 'familia', completed: selectedFamilia }]"
        >
          📚 Familia
        </button>
        <button 
          v-if="selectedFamilia"
          @click="resetToStep('genero')"
          :class="['breadcrumb-btn', { active: currentStep === 'genero', completed: selectedGenero }]"
        >
          🌱 Género
        </button>
        <button 
          v-if="selectedGenero"
          @click="resetToStep('especie')"
          :class="['breadcrumb-btn', { active: currentStep === 'especie', completed: selectedEspecie }]"
        >
          🌸 Especie
        </button>
      </div>
    </div>

    <!-- Layout con sidebar y contenido principal -->
    <div class="selector-layout">
      
      <!-- Sidebar con selección actual -->
      <div class="selector-sidebar">
        <div class="selection-summary">
          <div class="summary-item" :class="{ active: currentStep === 'familia' }">
            <div class="summary-label">Familia:</div>
            <div class="summary-value">{{ selectedFamilia?.nombre || 'No seleccionada' }}</div>
          </div>
          <div v-if="selectedFamilia" class="summary-item" :class="{ active: currentStep === 'genero' }">
            <div class="summary-label">Género:</div>
            <div class="summary-value">{{ selectedGenero?.nombre || 'No seleccionado' }}</div>
          </div>
          <div v-if="selectedGenero" class="summary-item" :class="{ active: currentStep === 'especie' }">
            <div class="summary-label">Especie:</div>
            <div class="summary-value">{{ selectedEspecie?.nombre || 'No seleccionada' }}</div>
          </div>
          <div v-if="selectedEspecie?.nombre_comun" class="summary-item">
            <div class="summary-label">Común:</div>
            <div class="summary-value">{{ selectedEspecie.nombre_comun }}</div>
          </div>
        </div>

        <!-- Resultado final -->
        <div v-if="isComplete" class="final-result">
          <div class="result-badge">✅ Completa</div>
          <div class="scientific-name">{{ selectedEspecie.nombre }}</div>
        </div>
      </div>

      <!-- Contenido principal -->
      <div class="selector-content">
        
        <!-- Paso 1: Familias -->
        <div v-if="currentStep === 'familia'" class="step-panel">
          <div class="panel-header">
            <h5>📚 Seleccionar Familia</h5>
            <input 
              v-model="familiaSearch" 
              type="text" 
              placeholder="Buscar familia..."
              class="search-input"
            >
          </div>
          <div class="options-compact-grid">
            <button 
              v-for="familia in filteredFamilias" 
              :key="familia.id"
              @click="selectFamilia(familia)"
              class="compact-option"
            >
              <span class="option-name">{{ familia.nombre }}</span>
              <span class="option-count">{{ familia.generos_count || 0 }}</span>
            </button>
          </div>
        </div>

        <!-- Paso 2: Géneros -->
        <div v-if="currentStep === 'genero'" class="step-panel">
          <div class="panel-header">
            <h5>🌱 Géneros de "{{ selectedFamilia?.nombre }}"</h5>
            <input 
              v-model="generoSearch" 
              type="text" 
              placeholder="Buscar género..."
              class="search-input"
            >
          </div>
          <div class="options-compact-grid">
            <button 
              v-for="genero in filteredGeneros" 
              :key="genero.id"
              @click="selectGenero(genero)"
              class="compact-option"
            >
              <span class="option-name">{{ genero.nombre }}</span>
              <span class="option-count">{{ genero.especies_count || 0 }}</span>
            </button>
          </div>
        </div>

        <!-- Paso 3: Especies -->
        <div v-if="currentStep === 'especie'" class="step-panel">
          <div class="panel-header">
            <div class="header-row">
              <h5>🌸 Especies de "{{ selectedGenero?.nombre }}"</h5>
              <button @click="mostrarModalNuevaEspecie = true" class="btn-nueva-especie" title="Agregar nueva especie">
                ➕ Nueva Especie
              </button>
            </div>
            <input 
              v-model="especieSearch" 
              type="text" 
              placeholder="Buscar especie..."
              class="search-input"
            >
          </div>
          <div class="options-compact-grid">
            <button 
              v-for="especie in filteredEspecies" 
              :key="especie.id"
              @click="selectEspecie(especie)"
              class="compact-option especie-option"
            >
              <div class="especie-info">
                <span class="option-name">{{ especie.nombre }}</span>
                <span v-if="especie.nombre_comun" class="common-name">{{ especie.nombre_comun }}</span>
                <span v-if="especie.tipo_amenaza" class="threat-badge">{{ especie.tipo_amenaza }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Estados de carga -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Cargando...</p>
        </div>

        <div v-if="error" class="error-state">
          <p>❌ {{ error }}</p>
          <button @click="retry" class="btn-retry">🔄 Reintentar</button>
        </div>
      </div>
    </div>

    <!-- Modal para agregar nueva especie -->
    <div v-if="mostrarModalNuevaEspecie" class="modal-overlay" @click.self="cerrarModalNuevaEspecie">
      <div class="modal-content modal-nueva-especie">
        <h3>➕ Agregar Nueva Especie</h3>
        <p class="modal-subtitle">
          Familia: <strong>{{ selectedFamilia?.nombre }}</strong> › 
          Género: <strong>{{ selectedGenero?.nombre }}</strong>
        </p>

        <div class="form-nueva-especie">
          <div class="form-group">
            <label>Nombre Científico (Especie) *</label>
            <input 
              v-model="nuevaEspecie.nombre" 
              type="text" 
              placeholder="ej: rubra"
              class="form-input"
              required
            >
          </div>

          <div class="form-group">
            <label>Nombre Común</label>
            <input 
              v-model="nuevaEspecie.nombre_comun" 
              type="text" 
              placeholder="ej: Rosa roja"
              class="form-input"
            >
          </div>

          <div class="form-group">
            <label>Tipo de Amenaza</label>
            <select v-model="nuevaEspecie.tipo_amenaza" class="form-select">
              <option value="">Sin categoría</option>
              <option value="CR">CR - En Peligro Crítico</option>
              <option value="EN">EN - En Peligro</option>
              <option value="VU">VU - Vulnerable</option>
              <option value="NN">NN - No Evaluada</option>
            </select>
            <small class="form-hint">Categorías según UICN (Unión Internacional para la Conservación de la Naturaleza)</small>
          </div>

          <div v-if="errorNuevaEspecie" class="error-message">
            ❌ {{ errorNuevaEspecie }}
          </div>

          <div class="modal-actions">
            <button @click="cerrarModalNuevaEspecie" class="btn btn-secondary">
              Cancelar
            </button>
            <button 
              @click="guardarNuevaEspecie" 
              class="btn btn-primary"
              :disabled="!nuevaEspecie.nombre || guardandoEspecie"
            >
              {{ guardandoEspecie ? '⏳ Guardando...' : '✅ Guardar Especie' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props y emits
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'selectionComplete'])

// Estados reactivos
const currentStep = ref('familia')
const loading = ref(false)
const error = ref('')

// Datos de taxonomía
const familias = ref([])
const generos = ref([])
const especies = ref([])

// Selecciones actuales
const selectedFamilia = ref(null)
const selectedGenero = ref(null)
const selectedEspecie = ref(null)

// Filtros de búsqueda
const familiaSearch = ref('')
const generoSearch = ref('')
const especieSearch = ref('')

// Modal nueva especie
const mostrarModalNuevaEspecie = ref(false)
const guardandoEspecie = ref(false)
const errorNuevaEspecie = ref('')
const nuevaEspecie = ref({
  nombre: '',
  nombre_comun: '',
  tipo_amenaza: ''
})

// Computed properties
const filteredFamilias = computed(() => {
  if (!familiaSearch.value) return familias.value
  return familias.value.filter(f => 
    f.nombre.toLowerCase().includes(familiaSearch.value.toLowerCase())
  )
})

const filteredGeneros = computed(() => {
  if (!generoSearch.value) return generos.value
  return generos.value.filter(g => 
    g.nombre.toLowerCase().includes(generoSearch.value.toLowerCase())
  )
})

const filteredEspecies = computed(() => {
  if (!especieSearch.value) return especies.value
  return especies.value.filter(e => 
    e.nombre.toLowerCase().includes(especieSearch.value.toLowerCase()) ||
    (e.nombre_comun && e.nombre_comun.toLowerCase().includes(especieSearch.value.toLowerCase()))
  )
})

const isComplete = computed(() => {
  return selectedFamilia.value && selectedGenero.value && selectedEspecie.value
})

// Métodos
const loadFamilias = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('http://localhost:3002/api/taxonomia/familias')
    if (response.ok) {
      familias.value = await response.json()
    } else {
      throw new Error('Error cargando familias')
    }
  } catch (err) {
    error.value = err.message
    // Datos simulados para desarrollo
    familias.value = [
      { id: 1, nombre: 'Rosaceae', generos_count: 15 },
      { id: 2, nombre: 'Asteraceae', generos_count: 32 },
      { id: 3, nombre: 'Fabaceae', generos_count: 28 }
    ]
  } finally {
    loading.value = false
  }
}

const loadGeneros = async (familiaId) => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`http://localhost:3002/api/taxonomia/familias/${familiaId}/generos`)
    if (response.ok) {
      generos.value = await response.json()
    } else {
      throw new Error('Error cargando géneros')
    }
  } catch (err) {
    error.value = err.message
    // Datos simulados
    generos.value = [
      { id: 1, nombre: 'Rosa', especies_count: 8 },
      { id: 2, nombre: 'Prunus', especies_count: 12 }
    ]
  } finally {
    loading.value = false
  }
}

const loadEspecies = async (generoId) => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`http://localhost:3002/api/taxonomia/generos/${generoId}/especies`)
    if (response.ok) {
      especies.value = await response.json()
    } else {
      throw new Error('Error cargando especies')
    }
  } catch (err) {
    error.value = err.message
    // Datos simulados
    especies.value = [
      { id: 1, nombre: 'Rosa canina', nombre_comun: 'Escaramujo' },
      { id: 2, nombre: 'Rosa gallica', nombre_comun: 'Rosa francesa' }
    ]
  } finally {
    loading.value = false
  }
}

const selectFamilia = async (familia) => {
  selectedFamilia.value = familia
  selectedGenero.value = null
  selectedEspecie.value = null
  familiaSearch.value = ''
  currentStep.value = 'genero'
  
  await loadGeneros(familia.id)
  emitUpdate()
}

const selectGenero = async (genero) => {
  selectedGenero.value = genero
  selectedEspecie.value = null
  generoSearch.value = ''
  currentStep.value = 'especie'
  
  await loadEspecies(genero.id)
  emitUpdate()
}

const selectEspecie = (especie) => {
  selectedEspecie.value = especie
  especieSearch.value = ''
  emitUpdate()
  
  // Emitir evento de completado
  emit('selectionComplete', {
    familia: selectedFamilia.value,
    genero: selectedGenero.value,
    especie: selectedEspecie.value
  })
}

const resetToStep = (step) => {
  currentStep.value = step
  
  if (step === 'familia') {
    selectedFamilia.value = null
    selectedGenero.value = null
    selectedEspecie.value = null
    generos.value = []
    especies.value = []
  } else if (step === 'genero') {
    selectedGenero.value = null
    selectedEspecie.value = null
    especies.value = []
  } else if (step === 'especie') {
    selectedEspecie.value = null
  }
  
  emitUpdate()
}

const emitUpdate = () => {
  emit('update:modelValue', {
    familia: selectedFamilia.value,
    genero: selectedGenero.value,
    especie: selectedEspecie.value,
    isComplete: isComplete.value
  })
}

const retry = () => {
  if (currentStep.value === 'familia') {
    loadFamilias()
  } else if (currentStep.value === 'genero' && selectedFamilia.value) {
    loadGeneros(selectedFamilia.value.id)
  } else if (currentStep.value === 'especie' && selectedGenero.value) {
    loadEspecies(selectedGenero.value.id)
  }
}

const cerrarModalNuevaEspecie = () => {
  mostrarModalNuevaEspecie.value = false
  errorNuevaEspecie.value = ''
  nuevaEspecie.value = {
    nombre: '',
    nombre_comun: '',
    tipo_amenaza: ''
  }
}

const guardarNuevaEspecie = async () => {
  if (!nuevaEspecie.value.nombre.trim()) {
    errorNuevaEspecie.value = 'El nombre científico es obligatorio'
    return
  }

  if (!selectedGenero.value) {
    errorNuevaEspecie.value = 'Debe seleccionar un género primero'
    return
  }

  guardandoEspecie.value = true
  errorNuevaEspecie.value = ''

  try {
    // Crear nueva especie con endpoint del backend
    const response = await fetch('http://localhost:3002/api/taxonomia/especies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nombre: nuevaEspecie.value.nombre.trim(),
        nombre_comun: nuevaEspecie.value.nombre_comun.trim() || null,
        tipo_amenaza: nuevaEspecie.value.tipo_amenaza || null,
        id_genero: selectedGenero.value.id
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Error al crear la especie')
    }

    const especieCreada = await response.json()
    
    // Recargar especies del género actual
    await loadEspecies(selectedGenero.value.id)
    
    // Seleccionar automáticamente la especie recién creada
    const especieNueva = especies.value.find(e => e.id === especieCreada.id)
    if (especieNueva) {
      selectEspecie(especieNueva)
    }
    
    // Cerrar modal
    cerrarModalNuevaEspecie()
    
    alert('✅ Especie creada exitosamente')
  } catch (err) {
    console.error('Error guardando especie:', err)
    errorNuevaEspecie.value = err.message || 'Error al guardar la especie'
  } finally {
    guardandoEspecie.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadFamilias()
})

// Watch para cambios externos (reseteo o pre-carga)
watch(() => props.modelValue, async (newValue) => {
  if (newValue && Object.keys(newValue).length === 0) {
    // Resetear cuando recibe objeto vacío
    resetToStep('familia')
  } else if (newValue && newValue.familia && newValue.genero && newValue.especie) {
    // Pre-cargar cuando recibe datos completos
    console.log('Pre-cargando taxonomía:', newValue)
    
    // Cargar familias primero
    await loadFamilias()
    
    // Seleccionar familia
    selectedFamilia.value = newValue.familia
    
    // Cargar géneros de esa familia
    await loadGeneros(newValue.familia.id)
    
    // Seleccionar género
    selectedGenero.value = newValue.genero
    
    // Cargar especies de ese género
    await loadEspecies(newValue.genero.id)
    
    // Seleccionar especie
    selectedEspecie.value = newValue.especie
    
    // Ir al paso de especie para mostrar la selección completa
    currentStep.value = 'especie'
    
    console.log('Taxonomía pre-cargada exitosamente')
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.taxonomic-selector {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Header compacto */
.selector-header {
  background: #f8f9fa;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.selector-header h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
}

.taxonomy-breadcrumb {
  display: flex;
  gap: 8px;
}

.breadcrumb-btn {
  background: #e9ecef;
  border: 1px solid #ced4da;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.breadcrumb-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.breadcrumb-btn.completed {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

/* Layout principal */
.selector-layout {
  display: flex;
  min-height: 300px;
  max-height: 400px;
}

/* Sidebar */
.selector-sidebar {
  width: 200px;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selection-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-item {
  padding: 8px;
  border-radius: 4px;
  background: white;
  border: 1px solid #e0e0e0;
  font-size: 12px;
}

.summary-item.active {
  border-color: #007bff;
  background: #e3f2fd;
}

.summary-label {
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 2px;
}

.summary-value {
  color: #2c3e50;
  word-wrap: break-word;
}

.final-result {
  margin-top: auto;
  padding: 12px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  text-align: center;
}

.result-badge {
  font-size: 12px;
  font-weight: 600;
  color: #155724;
  margin-bottom: 4px;
}

.scientific-name {
  font-style: italic;
  font-size: 11px;
  color: #155724;
  word-wrap: break-word;
}

/* Contenido principal */
.selector-content {
  flex: 1;
  overflow-y: auto;
}

.step-panel {
  padding: 16px;
  height: 100%;
}

.panel-header {
  margin-bottom: 16px;
}

.panel-header h5 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 14px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-row h5 {
  margin: 0;
}

.btn-nueva-especie {
  background: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.btn-nueva-especie:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

/* Grid compacto de opciones */
.options-compact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.compact-option {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.compact-option:hover {
  border-color: #007bff;
  background: #f8f9ff;
  transform: translateY(-1px);
}

.option-name {
  font-weight: 500;
  font-size: 13px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.option-count {
  font-size: 11px;
  color: #6c757d;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
}

/* Opciones de especie */
.especie-option {
  min-height: 60px;
}

.especie-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.common-name {
  font-size: 11px;
  color: #6c757d;
  font-style: italic;
}

.threat-badge {
  font-size: 10px;
  background: #ffeaa7;
  color: #d63031;
  padding: 2px 6px;
  border-radius: 3px;
  align-self: flex-start;
}

/* Estados de carga y error */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6c757d;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-retry {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 8px;
}

/* Modal para nueva especie */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-nueva-especie h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 20px;
}

.modal-subtitle {
  margin: 0 0 20px 0;
  color: #6c757d;
  font-size: 13px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.modal-subtitle strong {
  color: #007bff;
  font-weight: 600;
}

.form-nueva-especie {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #495057;
}

.form-hint {
  font-size: 11px;
  color: #6c757d;
  font-style: italic;
  margin-top: 4px;
}

.form-input, .form-select {
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-select {
  background: white;
  cursor: pointer;
}

.error-message {
  padding: 10px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Responsive */
@media (max-width: 768px) {
  .selector-layout {
    flex-direction: column;
    max-height: none;
  }
  
  .selector-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .options-compact-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .taxonomy-breadcrumb {
    flex-wrap: wrap;
  }
}
</style>