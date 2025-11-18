<!--
  LABORATORIO DASHBOARD - DASHBOARD DE CLASIFICACIÓN TAXONÓMICA
  ============================================================

  Componente principal para la gestión de clasificaciones taxonómicas en el laboratorio IDEAM.
  Maneja el flujo completo de clasificación: pendiente → borrador → firmado → completado.

  FUNCIONALIDADES PRINCIPALES:
  - Visualización de colas de clasificación por estado
  - Clasificación manual de muestras con selector taxonómico
  - Gestión de fotos de especímenes
  - Firma digital con validación de contraseña
  - Actualización automática de estados de paquete
  - Interfaz responsive con agrupación por conglomerados

  FLUJO DE TRABAJO:
  1. PENDIENTE: Muestras recién recibidas esperando clasificación
  2. EN ANÁLISIS: Muestra seleccionada para clasificación inicial
  3. BORRADOR: Clasificación guardada parcialmente (editable)
  4. FIRMADO: Clasificación validada con contraseña del especialista
  5. COMPLETADO: Clasificación finalizada y cerrada

  SERVICIOS INTEGRADOS:
  - Gest_Herb_service (puerto 3002): Gestión de clasificaciones y paquetes
  - Auth_Service (puerto 3001): Validación de contraseñas
  - Supabase: Almacenamiento de archivos y base de datos

  COMPONENTES DEPENDIENTES:
  - TaxonomicSelector: Selector jerárquico de taxonomía
  - TaxonomicClassifier: Clasificador automático (no implementado)

  AUTOR: Proyecto Integrador 2 - Software Herbario
  FECHA: 2025-11-17
  VERSIÓN: 2.0.0
-->
<template>
  <div class="laboratorio-container">
    <!-- Header -->
    <div class="view-header">🔬 Laboratorio IDEAM - Clasificación Taxonómica</div>

    <div class="container">
      <!-- Información del usuario logueado -->
      <div class="user-info mb-20">
        <div class="card">
          <h3>👨‍🔬 Usuario: {{ props.currentUser.nombre }}</h3>
          <p><strong>Rol:</strong> {{ props.currentUser.rol }}</p>
          <p><strong>Área:</strong> Clasificación Taxonómica</p>
        </div>
      </div>

      <!-- Tabs de navegación -->
      <div class="tabs">
        <button 
          @click="activeTab = 'cola'" 
          :class="['tab-btn', { active: activeTab === 'cola' }]"
        >
          <span class="tab-icon">📋</span> Cola de Clasificación
          <span v-if="pendingClassifications > 0" class="tab-badge">{{ pendingClassifications }}</span>
        </button>
        <button 
          @click="activeTab = 'clasificar'" 
          :class="['tab-btn', { active: activeTab === 'clasificar' }]"
        >
          <span class="tab-icon">🔬</span> Clasificar Muestra
        </button>
      </div>

      <!-- Contenido de pestañas -->
      <div class="tab-content">
        
        <!-- PESTAÑA: COLA DE CLASIFICACIÓN -->
        <div v-if="activeTab === 'cola'" class="cola-tab">
          <div class="cola-header">
            <h3>📋 Cola de Clasificación</h3>
          </div>

          <!-- Sub-tabs para filtrar por estado -->
          <div class="sub-tabs">
            <button 
              @click="estadoFiltro = 'pendiente'" 
              :class="['sub-tab-btn', { active: estadoFiltro === 'pendiente' }]"
            >
              ⏳ Pendientes ({{ muestrasPorEstado.pendiente.length }})
            </button>
            <button 
              @click="estadoFiltro = 'borrador'" 
              :class="['sub-tab-btn', { active: estadoFiltro === 'borrador' }]"
            >
              📝 Borradores ({{ muestrasPorEstado.borrador.length }})
            </button>
            <button 
              @click="estadoFiltro = 'completado'" 
              :class="['sub-tab-btn', { active: estadoFiltro === 'completado' }]"
            >
              ✅ Clasificadas ({{ muestrasPorEstado.completado.length }})
            </button>
          </div>

          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando muestras...</p>
          </div>

          <div v-else-if="muestrasFiltradas.length === 0" class="empty-state">
            <div style="font-size: 64px; margin-bottom: 20px;">
              {{ estadoFiltro === 'pendiente' ? '✅' : estadoFiltro === 'borrador' ? '📝' : '🎉' }}
            </div>
            <h3>{{ mensajeVacio }}</h3>
            <p>{{ descripcionVacia }}</p>
          </div>

          <div v-else class="samples-accordion">
            <div 
              v-for="(grupo, conglomerado) in muestrasAgrupadasPorConglomerado" 
              :key="conglomerado"
              class="conglomerado-group"
            >
              <div 
                class="conglomerado-header"
                @click="toggleConglomerado(conglomerado)"
                :class="{ 'expanded': conglomeradosExpandidos[conglomerado] }"
              >
                <div class="conglomerado-info">
                  <span class="chevron">{{ conglomeradosExpandidos[conglomerado] ? '▼' : '▶' }}</span>
                  <span class="conglomerado-name">{{ conglomerado || 'Sin conglomerado' }}</span>
                  <span class="muestra-count">{{ grupo.length }} muestra{{ grupo.length !== 1 ? 's' : '' }}</span>
                </div>
              </div>
              
              <div v-show="conglomeradosExpandidos[conglomerado]" class="samples-grid">
                <div 
                  v-for="muestra in grupo" 
                  :key="muestra.id"
                  class="sample-card"
                  :class="{ 'readonly': estadoFiltro === 'completado' }"
                  @click="seleccionarMuestraSegunEstado(muestra)"
                >
                  <div class="sample-header">
                    <span class="sample-code">
                      {{ (muestra.nombre_conglomerado && muestra.nombre_conglomerado.includes('-') && muestra.num_individuo)
                         ? `${muestra.nombre_conglomerado.split('-')[0].trim()}-I${muestra.num_individuo}` 
                         : (muestra.num_coleccion || muestra.codigo || `Muestra #${muestra.id}`) 
                      }}
                    </span>
                    <span :class="['estado-badge', estadoFiltro]">
                      {{ estadoTexto[estadoFiltro] || estadoFiltro }}
                    </span>
                  </div>
              
                  <!-- Miniatura de la foto si existe -->
                  <div v-if="muestra.foto_url" class="sample-thumbnail" @click.stop="abrirImagenCompleta(muestra.foto_url)">
                    <img :src="muestra.foto_url" :alt="'Foto de ' + (muestra.n_individuo_id || muestra.num_coleccion || muestra.codigo)" />
                    <div class="thumbnail-overlay">
                      <span>🔍 Ver imagen</span>
                    </div>
                  </div>
              
                  <div class="sample-info">
                    <p v-if="muestra.num_individuo"><strong>IFN Individuo:</strong> {{ muestra.num_individuo }}</p>
                    <p v-if="muestra.num_coleccion"><strong>Código Colector:</strong> {{ muestra.num_coleccion }}</p>
                    <p><strong>Paquete:</strong> {{ muestra.paquete_numero }}</p>
                    <p><strong>Colector:</strong> {{ muestra.colector }}</p>
                    <p><strong>Recibida:</strong> {{ formatDate(muestra.fecha_recepcion) }}</p>
                    <p v-if="muestra.nombre_conglomerado && !muestra.nombre_conglomerado.startsWith('Sin')"><strong>Conglomerado:</strong> {{ muestra.nombre_conglomerado }}</p>
                    <p v-if="muestra.especie_nombre && estadoFiltro !== 'pendiente'">
                      <strong>Especie:</strong> {{ muestra.especie_nombre }}
                    </p>
                    <p v-if="muestra.familia && muestra.familia !== '--' && estadoFiltro !== 'pendiente'">
                      <strong>Familia:</strong> {{ muestra.familia }}
                    </p>
                    <p v-if="muestra.genero && muestra.genero !== '--' && estadoFiltro !== 'pendiente'">
                      <strong>Género:</strong> {{ muestra.genero }}
                    </p>
                  </div>
              
                  <div class="sample-actions">
                    <button 
                      v-if="estadoFiltro === 'pendiente'" 
                      @click.stop="iniciarClasificacion(muestra)" 
                      class="btn btn-primary btn-sm"
                    >
                      🔬 Clasificar
                    </button>
                    <button 
                      v-if="estadoFiltro === 'borrador'" 
                      @click.stop="editarBorrador(muestra)" 
                      class="btn btn-warning btn-sm"
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      v-if="estadoFiltro === 'completado'" 
                      @click.stop="verClasificacionCompleta(muestra)" 
                      class="btn btn-secondary btn-sm"
                    >
                      👁️ Ver Detalles
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PESTAÑA: CLASIFICAR MUESTRA -->
        <div v-if="activeTab === 'clasificar'" class="clasificar-tab">
          <div v-if="!muestraSeleccionada" class="empty-state">
            <div style="font-size: 64px; margin-bottom: 20px;">🔬</div>
            <h3>Selecciona una Muestra para Clasificar</h3>
            <p>Ve a la pestaña "Cola de Clasificación" y selecciona una muestra para comenzar el proceso de clasificación taxonómica.</p>
            <button @click="activeTab = 'cola'" class="btn btn-primary">
              📋 Ver Cola de Clasificación
            </button>
          </div>

          <div v-else class="clasificacion-container">
            <div class="muestra-info-header">
              <div class="muestra-details">
                <h3>🔬 Clasificando: {{ muestraSeleccionada.codigo }}</h3>
                <div class="muestra-meta">
                  <span><strong>Colector:</strong> {{ muestraSeleccionada.colector }}</span>
                  <span><strong>Paquete:</strong> {{ muestraSeleccionada.paquete_numero }}</span>
                  <span><strong>Recibida:</strong> {{ formatDate(muestraSeleccionada.fecha_recepcion) }}</span>
                </div>
              </div>
              <div class="classification-methods">
                <button 
                  @click="metodClasificacion = 'manual'" 
                  :class="['method-btn', { active: metodClasificacion === 'manual' }]"
                >
                  🔍 Clasificación Manual
                </button>
              </div>
            </div>

            <!-- Clasificación Manual -->
            <div v-if="metodClasificacion === 'manual'" class="classification-manual">
              <div class="classification-form">
                <h4>📝 Clasificación Taxonómica Manual</h4>
                
                <div class="taxonomy-section">
                  <!-- Selector taxonómico compacto -->
                  <TaxonomicSelector 
                    v-model="taxonomicSelection"
                    @selectionComplete="onTaxonomySelected"
                  />
                </div>

                <!-- Campos adicionales de clasificación -->
                <div class="classification-fields">
                  <!-- Estado se controla automáticamente: pendiente -> en_analisis -> borrador -> firmado -> completado -->
                  
                  <div class="form-group">
                    <label>Estado Reproductivo *</label>
                    <select v-model="clasificacionForm.estado_reproductivo" required>
                      <option value="">Seleccionar estado reproductivo...</option>
                      <option value="Vegetativo">Vegetativo</option>
                      <option value="Floración">Floración</option>
                      <option value="Fructificación">Fructificación</option>
                      <option value="Floración y fructificación simultánea">Floración y fructificación simultánea</option>
                      <option value="Estéril">Estéril</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Foto del Espécimen</label>
                    <input 
                      type="file"
                      accept="image/*"
                      @change="handleFotoUpload"
                      class="file-input"
                    >
                    <small>Formatos: JPG, PNG, WEBP</small>
                    
                    <!-- Previsualizador de foto -->
                    <div v-if="fotoPreview" class="foto-preview">
                      <img :src="fotoPreview" alt="Vista previa" />
                      <button 
                        type="button" 
                        @click="eliminarFotoPreview" 
                        class="btn-remove-foto"
                        title="Eliminar foto"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Indicador de estado actual -->
                <div class="estado-actual">
                  <span class="estado-label">Estado actual:</span>
                  <span :class="['estado-badge', estadoActual]">
                    {{ estadoTexto[estadoActual] || 'En Análisis' }}
                  </span>
                </div>

                <div class="form-actions">
                  <button 
                    type="button" 
                    @click="guardarBorrador" 
                    class="btn btn-warning"
                    :disabled="!muestraSeleccionada || estadoActual === 'firmado'"
                  >
                    💾 Guardar Borrador
                  </button>
                  <button 
                    type="button" 
                    @click="mostrarModalFirma" 
                    class="btn btn-primary"
                    :disabled="!muestraSeleccionada || estadoActual !== 'borrador'"
                  >
                    ✍️ Firmar Clasificación
                  </button>
                  <button 
                    type="button" 
                    @click="cerrarClasificacion" 
                    class="btn btn-success"
                    :disabled="estadoActual !== 'firmado'"
                  >
                    ✅ Completar y Cerrar
                  </button>
                  <button 
                    type="button" 
                    @click="cancelarClasificacion" 
                    class="btn btn-secondary"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Visualización Completa -->
    <div v-if="mostrarModalVisualizacion" class="modal-overlay" @click.self="cerrarModalVisualizacion">
      <div class="modal-content modal-visualization">
        <h3>🔬 Clasificación Completa</h3>
        
        <div class="visualization-content">
          <div class="visualization-section">
            <h4>Información de la Muestra</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Código:</span>
                <span class="info-value">{{ muestraVisualizacion?.codigo }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Conglomerado:</span>
                <span class="info-value">{{ muestraVisualizacion?.nombre_conglomerado }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Fecha Clasificación:</span>
                <span class="info-value">{{ formatDate(muestraVisualizacion?.fecha_clasificacion) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Estado:</span>
                <span class="info-value badge" :class="'badge-' + muestraVisualizacion?.estado">
                  {{ muestraVisualizacion?.estado }}
                </span>
              </div>
            </div>
          </div>

          <div class="visualization-section">
            <h4>Taxonomía</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Familia:</span>
                <span class="info-value">{{ muestraVisualizacion?.familia || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Género:</span>
                <span class="info-value">{{ muestraVisualizacion?.genero || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Especie:</span>
                <span class="info-value">{{ muestraVisualizacion?.especie_nombre || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Estado Reproductivo:</span>
                <span class="info-value">{{ muestraVisualizacion?.estado_reproductivo || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <div v-if="fotoVisualizacion" class="visualization-section">
            <h4>Fotografía</h4>
            <div class="visualization-photo">
              <img :src="fotoVisualizacion" alt="Foto de muestra" />
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="cerrarModalVisualizacion" class="btn btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Firma -->
    <div v-if="mostrarModalPassword" class="modal-overlay" @click.self="cerrarModalFirma">
      <div class="modal-content">
        <h3>✍️ Firmar Clasificación</h3>
        <p>Ingrese su contraseña para confirmar la clasificación:</p>
        <div class="form-group">
          <label>Contraseña</label>
          <input 
            type="password" 
            v-model="passwordFirma" 
            @keyup.enter="firmarClasificacion"
            placeholder="Ingrese su contraseña"
            class="input-password"
          >
        </div>
        <div class="modal-actions">
          <button @click="firmarClasificacion" class="btn btn-primary">
            ✅ Confirmar Firma
          </button>
          <button @click="cerrarModalFirma" class="btn btn-secondary">
            ❌ Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Imagen Completa -->
    <div v-if="mostrarImagenCompleta" class="modal-overlay" @click="cerrarImagenCompleta">
      <div class="modal-imagen-completa" @click.stop>
        <button @click="cerrarImagenCompleta" class="btn-cerrar-imagen">
          ✕
        </button>
        <img :src="imagenCompletaUrl" alt="Imagen completa" class="imagen-completa" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import TaxonomicSelector from './TaxonomicSelector.vue'
import TaxonomicClassifier from './TaxonomicClassifier.vue'
import { supabase } from '../supabase.js'

// Props del componente
const props = defineProps({
  currentUser: {
    type: Object,
    required: true
  }
})

// Navegación por pestañas
const activeTab = ref('cola')

// Estados de carga
const loading = ref(false)

// Modal de visualización
const mostrarModalVisualizacion = ref(false)
const muestraVisualizacion = ref(null)
const fotoVisualizacion = ref(null)

// Modal de imagen completa
const mostrarImagenCompleta = ref(false)
const imagenCompletaUrl = ref(null)

// Datos para la cola de clasificación
const muestrasPendientes = ref([])
const muestrasBorrador = ref([])
const muestrasCompletadas = ref([])
const pendingClassifications = ref(0)

// Filtro de estado en cola de clasificación
const estadoFiltro = ref('pendiente')

// Control de expansión de conglomerados
const conglomeradosExpandidos = ref({})

// Computed para agrupar muestras por estado
const muestrasPorEstado = computed(() => ({
  pendiente: muestrasPendientes.value,
  borrador: muestrasBorrador.value,
  completado: muestrasCompletadas.value
}))

// Computed para filtrar muestras según el estado seleccionado
const muestrasFiltradas = computed(() => {
  return muestrasPorEstado.value[estadoFiltro.value] || []
})

// Computed para agrupar muestras por conglomerado
const muestrasAgrupadasPorConglomerado = computed(() => {
  const muestras = muestrasFiltradas.value
  const grupos = {}
  
  muestras.forEach(muestra => {
    // Obtener el nombre del conglomerado o usar 'Sin conglomerado'
    let nombreConglomerado = muestra.nombre_conglomerado || muestra.conglomerado || 'Sin conglomerado'
    
    // Limpiar el nombre si es necesario
    if (nombreConglomerado.startsWith('Sin')) {
      nombreConglomerado = 'Sin conglomerado'
    }
    
    if (!grupos[nombreConglomerado]) {
      grupos[nombreConglomerado] = []
    }
    
    grupos[nombreConglomerado].push(muestra)
  })
  
  return grupos
})

// Computed para mensajes de estado vacío
const mensajeVacio = computed(() => {
  switch(estadoFiltro.value) {
    case 'pendiente': return '¡No hay muestras pendientes!'
    case 'borrador': return 'No hay borradores guardados'
    case 'completado': return 'No hay clasificaciones completadas'
    default: return 'No hay muestras'
  }
})

const descripcionVacia = computed(() => {
  switch(estadoFiltro.value) {
    case 'pendiente': return 'Todas las muestras han sido procesadas.'
    case 'borrador': return 'No hay clasificaciones guardadas como borrador.'
    case 'completado': return 'Aún no se han completado clasificaciones.'
    default: return ''
  }
})

// Muestra seleccionada para clasificar
const muestraSeleccionada = ref(null)
const metodClasificacion = ref('manual')

// Formulario de clasificación
const clasificacionForm = reactive({
  id_especie: '',
  estado_reproductivo: '',
  id_foto: null
})

// Preview de foto
const fotoPreview = ref(null)
const fotoFile = ref(null) // Archivo de foto pendiente de subir

// Control de estados automático
const estadoActual = ref('en_analisis') // pendiente -> en_analisis -> borrador -> firmado -> completado
const estadoTexto = {
  'pendiente': 'Pendiente',
  'en_analisis': 'En Análisis',
  'borrador': 'Borrador',
  'firmado': 'Firmado',
  'completado': 'Completado'
}

// Modal de firma
const mostrarModalPassword = ref(false)
const passwordFirma = ref('')
const idClasificacionActual = ref(null)

// Selector taxonómico
const taxonomicSelection = ref({})
const selectedTaxonomy = ref({
  familia: null,
  genero: null,
  especie: null
})

const filtroFecha = ref('')

// Computed
const isValidClassification = computed(() => {
  return clasificacionForm.id_especie || clasificacionForm.estado
})

// Métodos
const toggleConglomerado = (conglomerado) => {
  conglomeradosExpandidos.value[conglomerado] = !conglomeradosExpandidos.value[conglomerado]
}

const loadInitialData = async () => {
  try {
    await Promise.all([
      loadPendingSamples(),
      loadBorradores(),
      loadCompletadas()
    ])
  } catch (error) {
    console.error('Error cargando datos iniciales:', error)
  }
}

const loadPendingSamples = async () => {
  loading.value = true
  try {
    console.log('Cargando muestras pendientes...')
    const response = await fetch('http://localhost:3002/muestras/pendientes')
    
    if (response.ok) {
      const data = await response.json()
      console.log('Datos recibidos:', data)
      
      // Mapear datos del Gest_Herb_service (schema v3.0: sin evento_coleccion)
      if (data && data.length > 0) {
        muestrasPendientes.value = data.map(muestra => ({
          id: muestra.id,
          n_individuo_id: muestra.n_individuo_id || null,
          num_coleccion: muestra.num_coleccion,
          num_individuo: muestra.num_individuo,
          codigo: muestra.num_coleccion,
          paquete_numero: muestra.paquete.num_paquete,
          colector: muestra.colector,
          fecha_recepcion: muestra.paquete.fecha_recibido_herbario || '--',
          conglomerado: muestra.paquete.conglomerado 
            ? `${muestra.paquete.conglomerado.codigo} - ${muestra.paquete.conglomerado.municipio?.nombre || 'N/A'}, ${muestra.paquete.conglomerado.municipio?.departamento?.nombre || 'N/A'}`
            : 'Sin conglomerado',
          estado: 'pendiente'
        }))
      } else {
        muestrasPendientes.value = []
      }
      
      console.log('Muestras pendientes mapeadas:', muestrasPendientes.value)
      pendingClassifications.value = muestrasPendientes.value.length
      
    } else {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
  } catch (error) {
    console.error('Error cargando muestras pendientes:', error)
    muestrasPendientes.value = []
    pendingClassifications.value = 0
  } finally {
    loading.value = false
  }
}

const loadBorradores = async () => {
  try {
    console.log('Cargando borradores...')
    const response = await fetch('http://localhost:3002/muestras/estado/borrador')
    
    if (response.ok) {
      const data = await response.json()
      
      // Cargar URLs de fotos para cada muestra
      for (const muestra of data) {
        if (muestra.id_clasificacion) {
          try {
            const clasificacionResponse = await fetch(`http://localhost:3002/clasificaciones/${muestra.id_clasificacion}`)
            if (clasificacionResponse.ok) {
              const clasificacionData = await clasificacionResponse.json()
              
              if (clasificacionData.archivos?.path) {
                const { data: urlData } = supabase.storage
                  .from('archivos')
                  .getPublicUrl(clasificacionData.archivos.path)
                muestra.foto_url = urlData.publicUrl
              }
            }
          } catch (error) {
            console.error(`Error cargando foto para muestra ${muestra.codigo}:`, error)
          }
        }
      }
      
      muestrasBorrador.value = data
      console.log('Borradores cargados:', muestrasBorrador.value.length)
    } else {
      muestrasBorrador.value = []
    }
  } catch (error) {
    console.error('Error cargando borradores:', error)
    muestrasBorrador.value = []
  }
}

const loadCompletadas = async () => {
  try {
    console.log('Cargando clasificadas...')
    const response = await fetch('http://localhost:3002/muestras/estado/completado')
    
    if (response.ok) {
      const data = await response.json()
      console.log('Muestras completadas recibidas:', data.length)
      
      // Cargar URLs de fotos para cada muestra
      for (const muestra of data) {
        if (muestra.id_clasificacion) {
          try {
            const clasificacionResponse = await fetch(`http://localhost:3002/clasificaciones/${muestra.id_clasificacion}`)
            if (clasificacionResponse.ok) {
              const clasificacionData = await clasificacionResponse.json()
              console.log(`Clasificación ${muestra.id_clasificacion}:`, clasificacionData)
              
              // Si la clasificación tiene una foto asociada, obtener su URL
              if (clasificacionData.id_foto) {
                try {
                  const archivoResponse = await fetch(`http://localhost:3002/archivos/${clasificacionData.id_foto}`)
                  if (archivoResponse.ok) {
                    const archivoData = await archivoResponse.json()
                    console.log(`Archivo ${clasificacionData.id_foto}:`, archivoData)
                    
                    if (archivoData.path) {
                      const { data: urlData } = supabase.storage
                        .from('archivos')
                        .getPublicUrl(archivoData.path)
                      muestra.foto_url = urlData.publicUrl
                      console.log(`Foto URL para muestra ${muestra.codigo}:`, muestra.foto_url)
                    }
                  }
                } catch (error) {
                  console.error(`Error obteniendo archivo para muestra ${muestra.codigo}:`, error)
                }
              } else {
                console.log(`Clasificación ${muestra.id_clasificacion} sin id_foto`)
              }
            }
          } catch (error) {
            console.error(`Error cargando foto para muestra ${muestra.codigo}:`, error)
          }
        } else {
          console.log(`Muestra ${muestra.codigo} sin id_clasificacion`)
        }
      }
      
      muestrasCompletadas.value = data
      console.log('Completadas cargadas:', muestrasCompletadas.value.length)
    } else {
      muestrasCompletadas.value = []
    }
  } catch (error) {
    console.error('Error cargando completadas:', error)
    muestrasCompletadas.value = []
  }
}

const seleccionarMuestraSegunEstado = (muestra) => {
  if (muestra.estado === 'pendiente') {
    iniciarClasificacion(muestra)
  } else if (muestra.estado === 'borrador') {
    editarBorrador(muestra)
  } else if (muestra.estado === 'completado') {
    verClasificacionCompleta(muestra)
  }
}

const editarBorrador = async (muestra) => {
  try {
    console.log('Editando borrador:', muestra)
    
    // Obtener datos completos de la clasificación desde el backend
    const response = await fetch(`http://localhost:3002/clasificaciones/${muestra.id_clasificacion}`)
    if (!response.ok) {
      throw new Error('No se pudo cargar la clasificación')
    }
    
    const clasificacion = await response.json()
    console.log('Clasificación cargada:', clasificacion)
    
    // Pre-cargar datos de la clasificación existente
    muestraSeleccionada.value = muestra
    idClasificacionActual.value = muestra.id_clasificacion
    estadoActual.value = 'borrador'
    
    // Llenar formulario con datos existentes
    clasificacionForm.id_especie = clasificacion.id_especie || null
    clasificacionForm.estado_reproductivo = clasificacion.estado_reproductivo || ''
    clasificacionForm.id_foto = clasificacion.id_foto || null
    
    // Cargar preview de foto si existe
    if (clasificacion.id_foto) {
      const archivoResponse = await fetch(`http://localhost:3002/archivos/${clasificacion.id_foto}`)
      if (archivoResponse.ok) {
        const archivoData = await archivoResponse.json()
        // Obtener URL pública de la foto
        const { data: urlData } = supabase.storage
          .from('archivos')
          .getPublicUrl(archivoData.path)
        fotoPreview.value = urlData.publicUrl
        console.log('Foto cargada:', fotoPreview.value)
      }
    } else {
      fotoPreview.value = null
    }
    
    // Pre-cargar selección taxonómica si existe
    if (clasificacion.id_especie) {
      // Obtener datos completos de la especie para pre-cargar el selector
      const especieResponse = await fetch(`http://localhost:3002/especies/${clasificacion.id_especie}`)
      if (especieResponse.ok) {
        const especieData = await especieResponse.json()
        console.log('Datos de especie:', especieData)
        
        // Pre-cargar en el componente TaxonomicSelector usando v-model
        taxonomicSelection.value = {
          familia: especieData.genero?.familia || null,
          genero: especieData.genero || null,
          especie: especieData || null
        }
        
        console.log('Taxonomía pre-cargada:', taxonomicSelection.value)
      }
    } else {
      // Si no hay especie, resetear la selección
      taxonomicSelection.value = {}
    }
    
    // Cambiar a tab de clasificar para editar
    activeTab.value = 'clasificar'
    
  } catch (error) {
    console.error('Error editando borrador:', error)
    alert('Error al cargar datos del borrador: ' + error.message)
  }
}

const verClasificacionCompleta = async (muestra) => {
  console.log('Ver clasificación completa:', muestra)
  
  try {
    muestraVisualizacion.value = muestra
    fotoVisualizacion.value = null
    
    // Si tiene foto, cargarla
    // Primero verificar si tiene id_clasificacion para obtener la foto correcta
    if (muestra.id_clasificacion) {
      console.log('Cargando clasificación ID:', muestra.id_clasificacion)
      const clasificacionResponse = await fetch(`http://localhost:3002/clasificaciones/${muestra.id_clasificacion}`)
      
      if (clasificacionResponse.ok) {
        const clasificacionData = await clasificacionResponse.json()
        console.log('Datos de clasificación:', clasificacionData)
        
        if (clasificacionData.archivos?.path) {
          console.log('Ruta de archivo:', clasificacionData.archivos.path)
          const { data: urlData } = supabase.storage
            .from('archivos')
            .getPublicUrl(clasificacionData.archivos.path)
          fotoVisualizacion.value = urlData.publicUrl
          console.log('URL de foto generada:', fotoVisualizacion.value)
        } else {
          console.log('No se encontró archivos.path en clasificación')
        }
      } else {
        console.error('Error al cargar clasificación:', clasificacionResponse.status)
      }
    } else if (muestra.foto?.path) {
      // Fallback si la foto viene en la estructura de muestra
      console.log('Usando foto de muestra:', muestra.foto.path)
      const { data: urlData } = supabase.storage
        .from('archivos')
        .getPublicUrl(muestra.foto.path)
      fotoVisualizacion.value = urlData.publicUrl
      console.log('URL de foto generada (fallback):', fotoVisualizacion.value)
    } else {
      console.log('No se encontró id_clasificacion ni foto en muestra')
    }
    
    mostrarModalVisualizacion.value = true
  } catch (error) {
    console.error('Error cargando visualización:', error)
    alert('Error al cargar los detalles: ' + error.message)
  }
}

const cerrarModalVisualizacion = () => {
  mostrarModalVisualizacion.value = false
  muestraVisualizacion.value = null
  fotoVisualizacion.value = null
}

// Funciones para modal de imagen completa
const abrirImagenCompleta = (url) => {
  imagenCompletaUrl.value = url
  mostrarImagenCompleta.value = true
}

const cerrarImagenCompleta = () => {
  mostrarImagenCompleta.value = false
  imagenCompletaUrl.value = null
}

const seleccionarMuestra = (muestra) => {
  muestraSeleccionada.value = muestra
  activeTab.value = 'clasificar'
  resetClasificacionForm()
}

const iniciarClasificacion = async (muestra) => {
  seleccionarMuestra(muestra)
  
  // Buscar si la muestra ya tiene una clasificación existente
  try {
    const response = await fetch(`http://localhost:3005/clasificaciones/muestra/${muestra.id}`)
    if (response.ok) {
      const clasificacion = await response.json()
      if (clasificacion && clasificacion.id) {
        console.log('📋 Clasificación existente encontrada:', clasificacion.id)
        idClasificacionActual.value = clasificacion.id
        estadoActual.value = clasificacion.estado
        
        // Cargar datos de la clasificación existente
        if (clasificacion.id_especie) {
          clasificacionForm.id_especie = clasificacion.id_especie
        }
        if (clasificacion.estado_reproductivo) {
          clasificacionForm.estado_reproductivo = clasificacion.estado_reproductivo
        }
        if (clasificacion.id_foto) {
          clasificacionForm.id_foto = clasificacion.id_foto
          // Cargar preview de la foto si existe
          // TODO: Obtener URL de la foto desde Supabase
        }
        
        return // No actualizar estado si ya existe clasificación
      }
    }
  } catch (error) {
    console.log('No se encontró clasificación existente, creando nueva')
  }
  
  // Si no existe clasificación, crear una nueva en estado "en_analisis"
  estadoActual.value = 'en_analisis'
  await actualizarEstadoMuestra(muestra.id, 'en_analisis')
}

const verDetalles = (muestra) => {
  alert(`Detalles de la muestra ${muestra.codigo}\n\nEsta funcionalidad se implementará próximamente.`)
}

const resetClasificacionForm = () => {
  Object.assign(clasificacionForm, {
    id_especie: '',
    estado_reproductivo: '',
    id_foto: null
  })
  
  estadoActual.value = 'en_analisis'
  idClasificacionActual.value = null
  passwordFirma.value = ''
  fotoPreview.value = null
  fotoFile.value = null // Limpiar archivo pendiente
  
  // Reset taxonomic selection
  taxonomicSelection.value = {}
  selectedTaxonomy.value = {
    familia: null,
    genero: null,
    especie: null
  }
}

const onTaxonomySelected = (selection) => {
  selectedTaxonomy.value = {
    familia: selection.familia,
    genero: selection.genero,
    especie: selection.especie
  }
  
  if (selection.especie) {
    clasificacionForm.id_especie = selection.especie.id
  }
}



const handleFotoUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Por favor seleccione un archivo de imagen válido')
    return
  }

  console.log('📸 Foto seleccionada (se subirá al guardar borrador):', file.name)
  
  try {
    // Guardar archivo para subirlo después
    fotoFile.value = file
    
    // Crear preview local usando FileReader
    const reader = new FileReader()
    reader.onload = (e) => {
      fotoPreview.value = e.target.result
      console.log('✅ Vista previa de foto cargada')
    }
    reader.readAsDataURL(file)

  } catch (error) {
    console.error('Error cargando preview de foto:', error)
    alert('❌ Error procesando la foto: ' + error.message)
    fotoPreview.value = null
    fotoFile.value = null
  }
}

const eliminarFotoPreview = () => {
  fotoPreview.value = null
  fotoFile.value = null
  clasificacionForm.id_foto = null
  // Limpiar el input file
  const fileInput = document.querySelector('.file-input')
  if (fileInput) fileInput.value = ''
}

const onSpeciesSelected = (taxonomy) => {
  selectedTaxonomy.value = taxonomy
  clasificacionForm.id_especie = taxonomy.species.id
}

const onClassificationChanged = (taxonomy) => {
  selectedTaxonomy.value = taxonomy
  if (taxonomy.species) {
    clasificacionForm.id_especie = taxonomy.species.id
  } else {
    clasificacionForm.id_especie = ''
  }
}

// Función auxiliar para actualizar estado de muestra
const actualizarEstadoMuestra = async (idMuestra, nuevoEstado) => {
  try {
    const response = await fetch(`http://localhost:3002/clasificaciones/${idMuestra}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    })
    if (!response.ok) throw new Error('Error actualizando estado')
    return await response.json()
  } catch (error) {
    console.error('Error actualizando estado:', error)
  }
}

const guardarBorrador = async () => {
  console.log('Guardando borrador...')
  
  if (!muestraSeleccionada.value || !muestraSeleccionada.value.id) {
    alert('Error: No hay muestra seleccionada')
    return
  }
  
  try {
    // Si hay una foto pendiente, subirla primero
    if (fotoFile.value && !clasificacionForm.id_foto) {
      console.log('📸 Subiendo foto al servidor...')
      
      const file = fotoFile.value
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name.replace(/\s/g, '_')}`
      const filePath = `muestras/${fileName}`

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error subiendo foto:', uploadError)
        alert('❌ Error subiendo la foto: ' + uploadError.message)
        return
      }

      console.log('Foto subida exitosamente:', uploadData)

      // Obtener URL pública de la foto
      const { data: urlData } = supabase.storage
        .from('archivos')
        .getPublicUrl(filePath)

      // Actualizar preview con URL pública
      fotoPreview.value = urlData.publicUrl

      // Crear registro en la tabla archivos
      const { data: archivoData, error: archivoError } = await supabase
        .from('archivos')
        .insert({
          bucket_id: 'archivos',
          path: filePath,
          name: fileName,
          mime: file.type,
          size: file.size,
          user_id: props.currentUser.id
        })
        .select('id')
        .single()

      if (archivoError) {
        console.error('Error registrando archivo en BD:', archivoError)
        alert('❌ Error registrando la foto en la base de datos: ' + archivoError.message)
        return
      }

      // Guardar el ID del archivo en el formulario
      clasificacionForm.id_foto = archivoData.id
      console.log('✅ Foto subida y registrada con ID:', archivoData.id)
      
      // Limpiar el archivo pendiente ya que ya se subió
      fotoFile.value = null
    }
    
    const clasificacionData = {
      id_muestra: muestraSeleccionada.value.id,
      id_especie: clasificacionForm.id_especie || null,
      estado: 'borrador',
      estado_reproductivo: clasificacionForm.estado_reproductivo || null,
      id_foto: clasificacionForm.id_foto || null,
      id_determinador: props.currentUser.id // ID del usuario actual
    }
    
    console.log('💾 Guardando clasificación como borrador...')
    
    const method = idClasificacionActual.value ? 'PUT' : 'POST'
    const url = idClasificacionActual.value 
      ? `http://localhost:3002/clasificaciones/${idClasificacionActual.value}`
      : 'http://localhost:3002/clasificaciones'
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clasificacionData)
    })
    
    if (response.ok) {
      const result = await response.json()
      idClasificacionActual.value = result.id || idClasificacionActual.value
      estadoActual.value = 'borrador'
      
      // Recargar colas para reflejar cambios
      await loadPendingSamples()
      await loadBorradores()
      
      const mensaje = fotoFile.value ? '✅ Borrador guardado exitosamente con foto' : '✅ Borrador guardado exitosamente'
      alert(mensaje)
    } else {
      const errorData = await response.text()
      alert(`Error: ${errorData}`)
    }
  } catch (error) {
    console.error('Error guardando borrador:', error)
    alert(`Error: ${error.message}`)
  }
}

const mostrarModalFirma = () => {
  console.log('🔐 Abriendo modal de firma')
  console.log('Estado actual:', estadoActual.value)
  console.log('Muestra seleccionada:', muestraSeleccionada.value?.id)
  
  if (estadoActual.value !== 'borrador') {
    console.warn('❌ No se puede firmar - estado no es borrador')
    alert('Debe guardar un borrador primero')
    return
  }
  
  console.log('✅ Abriendo modal de firma...')
  mostrarModalPassword.value = true
}

const cerrarModalFirma = () => {
  mostrarModalPassword.value = false
  passwordFirma.value = ''
}

/**
 * FIRMAR CLASIFICACIÓN - VALIDACIÓN Y FIRMA DIGITAL
 * =================================================
 *
 * Función principal para firmar clasificaciones taxonómicas.
 * Requiere validación de contraseña del especialista antes de cambiar estado.
 *
 * FLUJO DE FIRMA:
 * 1. Validar que la clasificación esté en estado 'borrador'
 * 2. Solicitar contraseña al usuario especialista
 * 3. Validar contraseña contra Auth Service (puerto 3001)
 * 4. Cambiar estado de clasificación a 'firmado' via Gest_Herb_service (puerto 3002)
 * 5. Actualizar estado del paquete automáticamente en background
 * 6. Recargar datos del frontend para reflejar cambios
 *
 * @param {Object} props.currentUser - Usuario actual del especialista
 * @param {string} props.currentUser.email - Email para validación de contraseña
 * @param {number} muestraSeleccionada.value.id - ID de la muestra a firmar
 * @param {string} passwordFirma.value - Contraseña ingresada por el usuario
 * @returns {void} - Actualiza estado y muestra alertas de éxito/error
 *
 * ENDPOINTS UTILIZADOS:
 * - POST /validate-password (Auth Service - puerto 3001)
 * - PUT /clasificaciones/{id}/estado (Gest_Herb_service - puerto 3002)
 *
 * ESTADOS INVOLUCRADOS:
 * - borrador → firmado (con validación de contraseña)
 */
const firmarClasificacion = async () => {
  console.log('════════════════════════════════════════')
  console.log('🔐 INICIANDO FIRMA DE CLASIFICACIÓN')
  console.log('════════════════════════════════════════')

  if (!passwordFirma.value) {
    console.warn('❌ Campo de contraseña vacío')
    alert('Debe ingresar su contraseña')
    return
  }

  console.log('✅ Contraseña ingresada:', '**' + passwordFirma.value.slice(-3))
  console.log('📧 Email del usuario:', props.currentUser?.email)
  console.log('📋 Muestra actual:', muestraSeleccionada.value?.id)

  try {
    console.log('\n🔐 PASO 1: Validando contraseña con Auth Service...')
    console.log('URL: http://localhost:3001/validate-password')
    console.log('Payload:', { email: props.currentUser.email, password: '***' })

    // Validar contraseña con el servicio de autenticación
    const authResponse = await fetch('http://localhost:3001/validate-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: props.currentUser.email,
        password: passwordFirma.value
      })
    })

    console.log('✅ RESPUESTA 1: Status =', authResponse.status)

    if (!authResponse.ok) {
      const authError = await authResponse.json()
      console.error('❌ ERROR DE AUTENTICACIÓN:', authError)
      alert('❌ Contraseña incorrecta. Por favor intenta de nuevo.')
      return
    }

    const authData = await authResponse.json()
    console.log('✅ Contraseña validada correctamente:', authData)

    console.log('\n✍️ PASO 2: Firmando clasificación en el servidor...')

    // Actualizar estado a firmado usando el ID de la muestra
    if (!muestraSeleccionada.value || !muestraSeleccionada.value.id) {
      console.error('❌ ERROR: muestraSeleccionada no tiene ID')
      alert('❌ Error: No se encontró la muestra seleccionada')
      return
    }

    const muestraId = muestraSeleccionada.value.id
    console.log('📋 ID de muestra:', muestraId)
    console.log('URL: http://localhost:3002/clasificaciones/' + muestraId + '/estado')

    const response = await fetch(`http://localhost:3002/clasificaciones/${muestraId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'firmado' })
    })

    console.log('✅ RESPUESTA 2: Status =', response.status)

    if (response.ok) {
      const result = await response.json()
      console.log('✅ CLASIFICACIÓN FIRMADA:', result)
      console.log('🎉 FIRMA EXITOSA')
      console.log('════════════════════════════════════════\n')

      estadoActual.value = 'firmado'
      cerrarModalFirma()

      // Recargar borradores para reflejar cambios
      console.log('Recargando datos...')
      await loadBorradores()

      alert('✅ Clasificación firmada exitosamente')
    } else {
      const errorData = await response.json()
      console.error('❌ ERROR DEL SERVIDOR:', errorData)
      console.error('════════════════════════════════════════\n')
      alert(`❌ Error firmando clasificación: ${errorData.error || 'Error desconocido'}`)
    }
  } catch (error) {
    console.error('❌ EXCEPCIÓN:', error)
    console.error('Stack:', error.stack)
    console.error('════════════════════════════════════════\n')
    alert(`❌ Error: ${error.message}`)
  }
}

/**
 * COMPLETAR Y CERRAR CLASIFICACIÓN - CIERRE FINAL DEL PROCESO
 * ===========================================================
 *
 * Función para completar y cerrar clasificaciones firmadas.
 * Cambia el estado final a 'completado' y actualiza automáticamente el estado del paquete.
 *
 * FLUJO DE CIERRE:
 * 1. Validar que la clasificación esté en estado 'firmado'
 * 2. Cambiar estado a 'completado' via Gest_Herb_service
 * 3. Actualizar estado del paquete automáticamente en background
 * 4. Recargar todas las colas de datos para reflejar cambios
 * 5. Limpiar formulario y regresar a vista de cola
 *
 * @param {number} muestraSeleccionada.value.id - ID de la muestra a completar
 * @returns {void} - Actualiza estado, recarga datos y muestra alertas
 *
 * ENDPOINTS UTILIZADOS:
 * - PUT /clasificaciones/{id}/estado (Gest_Herb_service - puerto 3002)
 *
 * ESTADOS INVOLUCRADOS:
 * - firmado → completado (cierre final sin validación adicional)
 *
 * EFECTOS SECUNDARIOS:
 * - Actualización automática del estado del paquete
 * - Recarga completa de todas las colas de datos
 * - Limpieza del formulario de clasificación
 * - Cambio automático a pestaña de cola
 */
const cerrarClasificacion = async () => {
  if (estadoActual.value !== 'firmado') {
    alert('Debe firmar la clasificación primero')
    return
  }

  try {
    console.log('✅ Cerrando clasificación de muestra:', muestraSeleccionada.value?.id)

    // Actualizar estado a completado usando el ID de la muestra
    if (muestraSeleccionada.value && muestraSeleccionada.value.id) {
      const response = await fetch(`http://localhost:3002/clasificaciones/${muestraSeleccionada.value.id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'completado' })
      })

      console.log('✅ Respuesta de completar:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Clasificación completada:', result)

        // Recargar todas las colas para reflejar cambios
        await loadPendingSamples()
        await loadBorradores()
        await loadCompletadas()

        muestraSeleccionada.value = null
        resetClasificacionForm()
        activeTab.value = 'cola'

        alert('✅ Clasificación completada exitosamente')
      } else {
        const errorData = await response.json()
        console.error('❌ Error del servidor:', errorData)
        alert(`❌ Error completando clasificación: ${errorData.error || 'Error desconocido'}`)
      }
    } else {
      console.error('❌ No hay muestra seleccionada')
      alert('❌ Error: No se encontró la muestra seleccionada')
    }
  } catch (error) {
    console.error('❌ Error en cerrarClasificacion:', error)
    console.error('Stack:', error.stack)
    alert(`❌ Error: ${error.message}`)
  }
}

const cancelarClasificacion = () => {
  muestraSeleccionada.value = null
  resetClasificacionForm()
  activeTab.value = 'cola'
}

const formatDate = (dateString) => {
  if (!dateString || dateString === '--' || dateString === 'N/A') return 'Sin fecha'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle - ejecutar al montar el componente
onMounted(() => {
  loadInitialData()
})
</script>

<style scoped>
.laboratorio-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 0;
}

.view-header {
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.user-info .card {
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
}

/* Tabs navigation */
.tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  padding: 5px;
  backdrop-filter: blur(10px);
}

.tab-btn {
  background: transparent;
  border: none;
  padding: 15px 25px;
  border-radius: 45px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.9);
  color: #2c3e50;
  font-weight: 600;
}

.tab-badge {
  background-color: #e74c3c;
  color: white;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 5px;
}

/* Tab Content */
.tab-content {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 15px;
  padding: 30px;
  min-height: 500px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Cola tab styles */
.cola-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.sub-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 5px;
}

.sub-tab-btn {
  padding: 10px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  font-size: 0.95rem;
}

.sub-tab-btn:hover {
  color: #2c3e50;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 5px 5px 0 0;
}

.sub-tab-btn.active {
  color: #2c3e50;
  font-weight: 600;
  border-bottom-color: #3498db;
}

.cola-filters {
  display: flex;
  gap: 10px;
}

.cola-filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
}

/* Accordion de conglomerados */
.samples-accordion {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.conglomerado-group {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  transition: all 0.3s ease;
}

.conglomerado-group:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.conglomerado-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 15px 20px;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease;
}

.conglomerado-header:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6a3f8f 100%);
}

.conglomerado-header.expanded {
  background: linear-gradient(135deg, #4c51bf 0%, #553c9a 100%);
}

.conglomerado-info {
  display: flex;
  align-items: center;
  gap: 15px;
  color: white;
  font-weight: 500;
}

.chevron {
  font-size: 14px;
  transition: transform 0.3s ease;
  min-width: 20px;
}

.conglomerado-name {
  flex: 1;
  font-size: 1.05rem;
  font-weight: 600;
}

.muestra-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
}

.samples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
  background: #f8f9fa;
}

.conglomerado-group .samples-grid {
  background: #fafbfc;
}

.sample-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.sample-card:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.sample-card.readonly {
  opacity: 0.85;
  cursor: default;
  border-color: #28a745;
  background: #f8fff9;
}

.sample-card.readonly:hover {
  transform: none;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
}

.sample-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.sample-thumbnail {
  width: 100%;
  height: 180px;
  margin: 15px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.sample-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  color: white;
  font-weight: 600;
  font-size: 1rem;
}

.sample-thumbnail:hover .thumbnail-overlay {
  opacity: 1;
}

.sample-card:hover .sample-thumbnail img {
  transform: scale(1.05);
}

.sample-code {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.estado-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.estado-badge.pendiente {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
}

.estado-badge.borrador {
  background: #cfe2ff;
  color: #084298;
  border: 1px solid #0d6efd;
}

.estado-badge.completado {
  background: #d1e7dd;
  color: #0f5132;
  border: 1px solid #28a745;
}

.priority-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.priority-badge.alta {
  background-color: #ffebee;
  color: #c62828;
}

.priority-badge.normal {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.priority-badge.baja {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.sample-info p {
  margin: 5px 0;
  font-size: 0.9rem;
}

.sample-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

/* Classification tab styles */
.clasificacion-container {
  max-width: 1200px;
  margin: 0 auto;
}

.muestra-info-header {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.muestra-meta {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  font-size: 0.9rem;
  color: #666;
}

.classification-methods {
  display: flex;
  gap: 10px;
}

.method-btn {
  padding: 10px 20px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.method-btn.active {
  border-color: #2c3e50;
  background-color: #2c3e50;
  color: white;
}

.classification-form {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 30px;
}

/* Taxonomy section */
.taxonomy-section {
  margin: 20px 0;
}

/* Classification fields */
.classification-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.file-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.foto-preview {
  position: relative;
  margin-top: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  max-width: 400px;
}

.foto-preview img {
  width: 100%;
  height: auto;
  display: block;
}

.btn-remove-foto {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.btn-remove-foto:hover {
  background: rgba(220, 53, 69, 1);
  transform: scale(1.1);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 0.9rem;
}

/* Estado actual indicator */
.estado-actual {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.estado-label {
  font-weight: 600;
  color: #2c3e50;
}

.estado-badge {
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.estado-badge.pendiente {
  background: #ffc107;
  color: #000;
}

.estado-badge.en_analisis {
  background: #17a2b8;
  color: white;
}

.estado-badge.borrador {
  background: #6c757d;
  color: white;
}

.estado-badge.firmado {
  background: #28a745;
  color: white;
}

.estado-badge.completado {
  background: #007bff;
  color: white;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  flex-wrap: wrap;
}

/* Modal de firma */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  text-align: center;
}

.modal-content p {
  margin-bottom: 20px;
  color: #666;
  text-align: center;
}

.input-password {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 20px;
}

.input-password:focus {
  outline: none;
  border-color: #007bff;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

/* Modal de visualización */
.modal-visualization {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.visualization-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 20px 0;
}

.visualization-section h4 {
  color: #2c3e50;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e9ecef;
  font-size: 1.1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-label {
  font-weight: 600;
  color: #6c757d;
  font-size: 0.85rem;
  text-transform: uppercase;
}

.info-value {
  color: #2c3e50;
  font-size: 1rem;
}

.visualization-photo {
  display: flex;
  justify-content: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.visualization-photo img {
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.classification-history {
  margin-top: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.reference-tools {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}

/* Taxonomic classifier styles */
.selected-taxonomy-info {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-top: 20px;
}

.selected-taxonomy-info h5 {
  color: #28a745;
  margin-bottom: 10px;
  font-size: 1rem;
}

.taxonomy-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.taxonomy-info p {
  margin: 0;
  font-size: 0.9rem;
}

.taxonomy-info strong {
  color: #2c3e50;
}



/* Historial tab styles removed */

/* Estadísticas tab styles removed */



/* Loading and empty states */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2c3e50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state h3 {
  color: #2c3e50;
  margin-bottom: 10px;
}



/* Buttons */
.btn {
  padding: 12px 24px;
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

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 12px;
}

.btn-outline {
  border: 1px solid #ddd;
  background: white;
  color: #2c3e50;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .tabs {
    flex-direction: column;
    border-radius: 15px;
  }
  
  .tab-btn {
    border-radius: 10px;
    justify-content: center;
  }
  
  .samples-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .charts-section {
    grid-template-columns: 1fr;
  }
  
  .muestra-info-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .taxonomy-fields {
    grid-template-columns: 1fr;
  }
}

/* Modal de Imagen Completa */
.modal-imagen-completa {
  position: relative;
  max-width: 95vw;
  max-height: 95vh;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.imagen-completa {
  display: block;
  max-width: 95vw;
  max-height: 95vh;
  width: auto;
  height: auto;
  object-fit: contain;
}

.btn-cerrar-imagen {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;
}

.btn-cerrar-imagen:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}
</style>