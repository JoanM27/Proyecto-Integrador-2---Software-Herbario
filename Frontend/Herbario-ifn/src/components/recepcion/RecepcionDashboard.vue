<template>
  <div class="recepcion-container">
    <!-- Header -->
    <div class="view-header">📦 Sistema de Recepción de Paquetes - IDEAM</div>

    <div class="container">
      <!-- Alertas -->
      <div v-if="alert.show" :class="['alert', alert.type]">
        {{ alert.message }}
      </div>

      <!-- SECCIÓN 1: Búsqueda de Paquete -->
      <div v-if="currentSection === 'busqueda'" class="section-card active">
        <h2>1. Buscar Paquete en Servicio Externo</h2>
        <div class="info-box">
          <p><strong>Instrucciones:</strong> Ingrese el número de paquete para buscar sus datos en el sistema externo de campo.</p>
        </div>
        
        <div class="form-group">
          <label for="num_paquete_buscar">Número de Paquete:</label>
          <input 
            type="number" 
            id="num_paquete_buscar" 
            v-model="busqueda.numeroPaquete"
            placeholder="Ej: 1006, 1007, 1008..."
            @keyup.enter="buscarPaquete"
          >
        </div>
        
        <div class="button-group">
          <button @click="buscarPaquete" :disabled="!busqueda.numeroPaquete || buscando" class="btn btn-primary">
            {{ buscando ? 'Buscando...' : 'Buscar Paquete' }}
          </button>
          <button @click="mostrarEntradaManual" class="btn btn-secondary">
            Entrada Manual (Sin Datos Externos)
          </button>
        </div>
      </div>

      <!-- SECCIÓN 2: Entrada Manual -->
      <div v-if="currentSection === 'manual'" class="section-card active">
        <h2>2. Registro Manual de Paquete</h2>
        <div class="alert alert-warning">
          <strong>Nota:</strong> Use esta opción solo cuando no se encuentren los datos en el servicio externo.
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Número de Paquete: *</label>
            <input type="number" v-model="manualForm.num_paquete" required>
          </div>

          <div class="form-group">
            <label>Conglomerado: *</label>
            <select v-model="manualForm.id_conglomerado" required>
              <option value="">Seleccione un conglomerado</option>
              <option v-for="cong in conglomerados" :key="cong.id" :value="cong.id">
                {{ cong.codigo }} - {{ cong.municipio?.nombre || 'Sin municipio' }}, {{ cong.municipio?.departamento?.nombre || 'Sin departamento' }}
              </option>
            </select>
            <small>Si el conglomerado no existe, debe ser creado primero por el administrador</small>
          </div>

          <div class="form-group">
            <label>Cantidad de Ejemplares: *</label>
            <input type="number" v-model="manualForm.cantidad_ejemplares" min="1" required>
          </div>

          <div class="form-group">
            <label>Fecha de Envío:</label>
            <input type="date" v-model="manualForm.fecha_envio">
          </div>

          <div class="form-group full-width">
            <label>Observaciones Generales:</label>
            <textarea v-model="manualForm.observaciones" rows="3" placeholder="Observaciones sobre el paquete..."></textarea>
          </div>
        </div>

        <div class="muestras-manual-section">
          <h3>Muestras del Paquete</h3>
          <button @click="agregarMuestraManual" class="btn btn-success btn-sm" type="button">+ Agregar Muestra</button>
          
          <div v-for="(muestra, index) in manualForm.muestras" :key="index" class="muestra-item">
            <div class="muestra-header">
              <h4>Muestra {{ index + 1 }}</h4>
              <button @click="eliminarMuestraManual(index)" class="btn btn-danger btn-sm" type="button">Eliminar</button>
            </div>
            
            <div class="muestra-form-grid">
              <div class="form-group">
                <label>Número de Individuo: *</label>
                <input type="text" v-model="muestra.num_individuo" required>
              </div>
              <div class="form-group">
                <label>Colector: *</label>
                <input type="text" v-model="muestra.colector" required>
              </div>
              <div class="form-group">
                <label>Número de Colección:</label>
                <input type="text" v-model="muestra.num_coleccion">
              </div>
              <div class="form-group">
                <label>Fecha de Colección:</label>
                <input type="date" v-model="muestra.fecha_coleccion">
              </div>
              <div class="form-group full-width">
                <label>Observaciones:</label>
                <textarea v-model="muestra.observaciones" rows="2"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="button-group">
          <button @click="guardarManual" class="btn btn-success" :disabled="!validarManual()">Guardar Paquete</button>
          <button @click="volverBusqueda" class="btn btn-secondary">Volver a Búsqueda</button>
        </div>
      </div>

      <!-- SECCIÓN 3: Confirmar Recepción (Datos del Servicio Externo) -->
      <div v-if="currentSection === 'confirmar'" class="section-card active">
        <h2>3. Confirmar Recepción de Paquete</h2>
        
        <div class="alert alert-success">
          <strong>✓ Paquete encontrado:</strong> Los datos han sido cargados desde el servicio externo.
        </div>

        <!-- Información del Paquete -->
        <div class="info-panel">
          <h3>📦 Información del Paquete</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Número de Paquete:</span>
              <span class="value">{{ paqueteEncontrado.envio.no_paquete_envio }}</span>
            </div>
            <div class="info-item">
              <span class="label">Cantidad de Ejemplares:</span>
              <span class="value">{{ paqueteEncontrado.envio.cantidad_ejemplares }}</span>
            </div>
            <div class="info-item">
              <span class="label">Fecha de Envío:</span>
              <span class="value">{{ formatDate(paqueteEncontrado.envio.fecha_envio) }}</span>
            </div>
            <div class="info-item">
              <span class="label">Diligenciado Por:</span>
              <span class="value">{{ paqueteEncontrado.envio.diligenciado_por }}</span>
            </div>
            <div class="info-item full-width">
              <span class="label">Rango de Colección:</span>
              <span class="value">
                {{ formatDate(paqueteEncontrado.envio.fecha_inicio_coleccion) }} - 
                {{ formatDate(paqueteEncontrado.envio.fecha_fin_coleccion) }}
              </span>
            </div>
            <div class="info-item full-width">
              <span class="label">Observaciones del Envío:</span>
              <span class="value">{{ paqueteEncontrado.envio.observaciones || 'Sin observaciones' }}</span>
            </div>
          </div>
        </div>

        <!-- Información del Conglomerado -->
        <div class="info-panel">
          <h3>📍 Información del Conglomerado</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Código:</span>
              <span class="value">{{ paqueteEncontrado.conglomerado.codigo }}</span>
            </div>
            <div class="info-item">
              <span class="label">ID:</span>
              <span class="value">{{ paqueteEncontrado.conglomerado.id }}</span>
            </div>
            <div class="info-item" v-if="paqueteEncontrado.conglomerado.latitud_dec">
              <span class="label">Latitud:</span>
              <span class="value">{{ paqueteEncontrado.conglomerado.latitud_dec }}</span>
            </div>
            <div class="info-item" v-if="paqueteEncontrado.conglomerado.longitud_dec">
              <span class="label">Longitud:</span>
              <span class="value">{{ paqueteEncontrado.conglomerado.longitud_dec }}</span>
            </div>
          </div>
        </div>

        <!-- Colecciones (Muestras) -->
        <div class="info-panel">
          <h3>🌿 Muestras Botánicas ({{ paqueteEncontrado.colecciones.length }})</h3>
          <div class="muestras-tabla">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Individuo</th>
                  <th>Nombre Común</th>
                  <th>Colector</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(col, index) in paqueteEncontrado.colecciones" :key="col.id">
                  <td>{{ index + 1 }}</td>
                  <td>{{ col.n_individuo_id }}</td>
                  <td>{{ col.nombre_comun }}</td>
                  <td>{{ col.diligenciado_por }}</td>
                  <td>{{ formatDate(col.fecha) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Formulario de Confirmación -->
        <div class="confirmacion-form">
          <h3>✅ Confirmar Recepción</h3>
          <div class="form-group">
            <label>Observaciones de Recepción:</label>
            <textarea 
              v-model="confirmacion.observaciones"
              rows="4"
              placeholder="Ingrese observaciones sobre el estado del paquete al momento de la recepción..."
            ></textarea>
            <small>Por ejemplo: estado de conservación, daños, discrepancias, etc.</small>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" v-model="confirmacion.confirmado">
              Confirmo que he verificado el contenido del paquete y los datos son correctos
            </label>
          </div>
        </div>

        <div class="button-group">
          <button 
            @click="confirmarRecepcion" 
            :disabled="!confirmacion.confirmado || confirmando"
            class="btn btn-success btn-large"
          >
            {{ confirmando ? 'Confirmando...' : 'Confirmar Recepción y Guardar' }}
          </button>
          <button @click="volverBusqueda" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// Estado de secciones
const currentSection = ref('busqueda') // 'busqueda', 'manual', 'confirmar'

// Lista de conglomerados disponibles
const conglomerados = ref([])

// Estado de alertas
const alert = reactive({
  show: false,
  type: 'info', // 'success', 'error', 'warning', 'info'
  message: ''
})

// Búsqueda
const busqueda = reactive({
  numeroPaquete: ''
})
const buscando = ref(false)
const paqueteEncontrado = ref(null)

// Formulario manual
const manualForm = reactive({
  num_paquete: '',
  id_conglomerado: '',
  cantidad_ejemplares: 1,
  fecha_envio: '',
  observaciones: '',
  muestras: []
})

// Confirmación
const confirmacion = reactive({
  observaciones: '',
  confirmado: false
})
const confirmando = ref(false)

// ==================== MÉTODOS ====================

// Cargar conglomerados al montar el componente
async function cargarConglomerados() {
  try {
    const response = await fetch('http://localhost:3002/ubicaciones/conglomerados')
    if (response.ok) {
      conglomerados.value = await response.json()
      console.log('Conglomerados cargados:', conglomerados.value.length)
    }
  } catch (error) {
    console.error('Error cargando conglomerados:', error)
    mostrarAlerta('No se pudieron cargar los conglomerados', 'warning')
  }
}

function mostrarAlerta(mensaje, tipo = 'info', duracion = 5000) {
  alert.show = true
  alert.type = tipo
  alert.message = mensaje
  
  setTimeout(() => {
    alert.show = false
  }, duracion)
}

function cambiarSeccion(seccion) {
  currentSection.value = seccion
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Buscar paquete en servicio externo
async function buscarPaquete() {
  if (!busqueda.numeroPaquete) {
    mostrarAlerta('Por favor ingrese un número de paquete', 'error')
    return
  }

  buscando.value = true
  
  try {
    const response = await fetch(`http://localhost:3004/paquetes/buscar/${busqueda.numeroPaquete}`)
    const data = await response.json()

    if (response.status === 404 || !data.encontrado) {
      mostrarAlerta(
        'Paquete no encontrado en el servicio externo. Puede registrarlo manualmente.', 
        'warning',
        7000
      )
      // Después de 2 segundos, ofrecer entrada manual
      setTimeout(() => {
        if (confirm('¿Desea registrar los datos manualmente?')) {
          manualForm.num_paquete = busqueda.numeroPaquete
          mostrarEntradaManual()
        }
      }, 2000)
      return
    }

    // Verificar si el paquete ya fue recibido
    if (data.yaRecibido) {
      mostrarAlerta(
        `⚠️ Este paquete ya fue recibido el ${formatDate(data.paquete.fecha_recibido_herbario)}. No se puede procesar nuevamente.`,
        'warning',
        10000
      )
      return
    }

    if (response.status === 503) {
      mostrarAlerta('El servicio externo no está disponible. Intente más tarde o use entrada manual.', 'error')
      return
    }

    if (!response.ok) {
      throw new Error(data.error || 'Error al buscar paquete')
    }

    // Paquete encontrado
    paqueteEncontrado.value = data.datos
    mostrarAlerta('¡Paquete encontrado exitosamente!', 'success')
    
    // Ir a sección de confirmación
    setTimeout(() => {
      cambiarSeccion('confirmar')
    }, 1500)

  } catch (error) {
    console.error('Error buscando paquete:', error)
    mostrarAlerta('Error al buscar paquete: ' + error.message, 'error')
  } finally {
    buscando.value = false
  }
}

// Confirmar recepción con datos del servicio externo
async function confirmarRecepcion() {
  if (!confirmacion.confirmado) {
    mostrarAlerta('Debe confirmar que ha verificado el contenido del paquete', 'warning')
    return
  }

  confirmando.value = true

  try {
    // Preparar datos para envío
    const payload = {
      num_paquete: paqueteEncontrado.value.envio.no_paquete_envio,
      id_conglomerado: paqueteEncontrado.value.conglomerado.id,
      observaciones_generales: confirmacion.observaciones,
      fecha_envio: paqueteEncontrado.value.envio.fecha_envio,
      muestras: paqueteEncontrado.value.colecciones.map(col => ({
        n_individuo_id: col.n_individuo_id || null, // ID único del IFN
        num_individuo: col.n_individuo_id?.toString() || '',
        colector: col.diligenciado_por || '',
        num_coleccion: col.colector_numero_coleccion || null,
        fecha_coleccion: col.fecha || null,
        observaciones: col.observaciones_individuo || null
      }))
    }

    const response = await fetch('http://localhost:3004/paquetes/confirmar-recepcion', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Error al confirmar recepción')
    }

    mostrarAlerta(`✅ Recepción confirmada exitosamente. Paquete ID: ${data.paquete_id}`, 'success', 7000)
    
    // Resetear y volver a búsqueda
    setTimeout(() => {
      resetearFormularios()
      cambiarSeccion('busqueda')
    }, 3000)

  } catch (error) {
    console.error('Error confirmando recepción:', error)
    mostrarAlerta('Error al confirmar recepción: ' + error.message, 'error')
  } finally {
    confirmando.value = false
  }
}

// Mostrar formulario de entrada manual
function mostrarEntradaManual() {
  cambiarSeccion('manual')
  
  // Si viene de búsqueda, pre-llenar el número
  if (busqueda.numeroPaquete && !manualForm.num_paquete) {
    manualForm.num_paquete = busqueda.numeroPaquete
  }
  
  // Cargar conglomerados si no están cargados
  if (conglomerados.value.length === 0) {
    cargarConglomerados()
  }
}

// Agregar muestra manual
function agregarMuestraManual() {
  manualForm.muestras.push({
    num_individuo: '',
    colector: '',
    num_coleccion: '',
    fecha_coleccion: '',
    observaciones: ''
  })
}

// Eliminar muestra manual
function eliminarMuestraManual(index) {
  manualForm.muestras.splice(index, 1)
}

// Validar formulario manual
function validarManual() {
  if (!manualForm.num_paquete || !manualForm.id_conglomerado || !manualForm.cantidad_ejemplares) {
    return false
  }
  
  if (manualForm.muestras.length === 0) {
    return false
  }

  // Validar que cada muestra tenga al menos num_individuo y colector
  return manualForm.muestras.every(m => m.num_individuo && m.colector)
}

// Guardar paquete manual
async function guardarManual() {
  if (!validarManual()) {
    mostrarAlerta('Por favor complete todos los campos requeridos', 'error')
    return
  }

  try {
    const payload = {
      id_conglomerado: parseInt(manualForm.id_conglomerado),
      num_paquete: manualForm.num_paquete.toString(),
      cantidad_ejemplares: parseInt(manualForm.cantidad_ejemplares),
      fecha_envio: manualForm.fecha_envio || null,
      observaciones_generales: manualForm.observaciones || null,
      estado: 'recibido',
      muestras: manualForm.muestras.map(m => ({
        num_individuo: m.num_individuo,
        colector: m.colector,
        num_coleccion: m.num_coleccion || null,
        fecha_coleccion: m.fecha_coleccion || null,
        observaciones: m.observaciones || null
      }))
    }

    const response = await fetch('http://localhost:3004/paquetes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Error al guardar paquete')
    }

    mostrarAlerta(`✅ Paquete guardado exitosamente. ID: ${data.paquete_id}`, 'success', 7000)
    
    setTimeout(() => {
      resetearFormularios()
      cambiarSeccion('busqueda')
    }, 3000)

  } catch (error) {
    console.error('Error guardando paquete manual:', error)
    mostrarAlerta('Error al guardar paquete: ' + error.message, 'error')
  }
}

// Volver a búsqueda
function volverBusqueda() {
  resetearFormularios()
  cambiarSeccion('busqueda')
}

// Resetear formularios
function resetearFormularios() {
  busqueda.numeroPaquete = ''
  paqueteEncontrado.value = null
  confirmacion.observaciones = ''
  confirmacion.confirmado = false
  Object.assign(manualForm, {
    num_paquete: '',
    id_conglomerado: '',
    cantidad_ejemplares: 1,
    fecha_envio: '',
    observaciones: '',
    muestras: []
  })
}

// Formatear fecha
function formatDate(dateString) {
  if (!dateString) return '--'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-CO')
  } catch {
    return dateString
  }
}

// ==================== LIFECYCLE ====================

onMounted(() => {
  // Cargar conglomerados al inicio
  cargarConglomerados()
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.recepcion-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
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
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 30px;
}

/* Alertas */
.alert {
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
}

.alert.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* Section Cards */
.section-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 25px;
  margin-bottom: 25px;
  border: 2px solid #e9ecef;
}

.section-card h2 {
  color: #667eea;
  margin-bottom: 20px;
  font-size: 1.5em;
  border-bottom: 2px solid #667eea;
  padding-bottom: 10px;
}

.info-box {
  background: #e7f3ff;
  border-left: 4px solid #2196F3;
  padding: 15px;
  margin: 15px 0;
  border-radius: 4px;
}

/* Forms */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #495057;
  font-weight: 600;
  font-size: 0.95em;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group input[type="date"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 1em;
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-group small {
  display: block;
  margin-top: 5px;
  color: #6c757d;
  font-size: 0.875em;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

/* Buttons */
.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.btn-secondary {
  background: #6c757d;
}

.btn.btn-success {
  background: #28a745;
}

.btn.btn-danger {
  background: #dc3545;
}

.btn.btn-sm {
  padding: 8px 16px;
  font-size: 0.9em;
}

.btn.btn-large {
  padding: 15px 40px;
  font-size: 1.1em;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Info Panels */
.info-panel {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.info-panel h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.2em;
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

.info-item .label {
  font-weight: 600;
  color: #6c757d;
  font-size: 0.9em;
}

.info-item .value {
  color: #2c3e50;
  font-size: 1em;
}

/* Muestras Manuales */
.muestras-manual-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.muestras-manual-section h3 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.muestra-item {
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 15px 0;
}

.muestra-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.muestra-header h4 {
  color: #495057;
  font-size: 1.1em;
}

.muestra-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

/* Tabla de Muestras */
.muestras-tabla {
  overflow-x: auto;
}

.muestras-tabla table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.muestras-tabla th,
.muestras-tabla td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.muestras-tabla th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.muestras-tabla tr:hover {
  background: #f8f9fa;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  font-weight: 500;
}

.badge-success {
  background: #d4edda;
  color: #155724;
}

.badge-warning {
  background: #fff3cd;
  color: #856404;
}

/* Confirmación Form */
.confirmacion-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.confirmacion-form h3 {
  color: #28a745;
  margin-bottom: 15px;
}

.confirmacion-form label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.confirmacion-form input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 20px;
  }

  .form-grid,
  .info-grid,
  .muestra-form-grid {
    grid-template-columns: 1fr;
  }

  .button-group {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
