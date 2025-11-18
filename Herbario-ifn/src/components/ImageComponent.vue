<template>
  <div class="image-container" :class="containerClass">
    <!-- Imagen principal -->
    <div 
      v-if="!loading && !error && imageUrl" 
      class="image-wrapper"
      :class="{ 'has-overlay': showOverlay }"
      @click="handleImageClick"
    >
      <img 
        :src="imageUrl" 
        :alt="altText"
        :class="imageClass"
        @load="onImageLoad"
        @error="onImageError"
        @click="$emit('imageClick', $event)"
      />
      
      <!-- Overlay con información -->
      <div v-if="showOverlay" class="image-overlay">
        <div class="overlay-content">
          <div v-if="overlayTitle" class="overlay-title">{{ overlayTitle }}</div>
          <div v-if="overlaySubtitle" class="overlay-subtitle">{{ overlaySubtitle }}</div>
          <div v-if="overlayActions" class="overlay-actions">
            <button 
              v-for="action in overlayActions" 
              :key="action.id"
              class="overlay-button"
              @click.stop="$emit('overlayAction', action)"
            >
              {{ action.icon }} {{ action.label }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Badge o etiqueta en la esquina -->
      <div v-if="badge" class="image-badge" :class="badgeClass">
        {{ badge }}
      </div>
      
      <!-- Indicador de zoom -->
      <div v-if="zoomable" class="zoom-indicator">
        🔍
      </div>
    </div>

    <!-- Placeholder cuando no hay imagen -->
    <div 
      v-else-if="!loading && !imageUrl" 
      class="image-placeholder"
      :class="placeholderClass"
      @click="$emit('placeholderClick', $event)"
    >
      <div class="placeholder-content">
        <div class="placeholder-icon">
          {{ placeholderIcon || '📷' }}
        </div>
        <div v-if="placeholderText" class="placeholder-text">
          {{ placeholderText }}
        </div>
        <button v-if="allowUpload" class="upload-button" @click.stop="triggerUpload">
          📁 Subir Imagen
        </button>
      </div>
    </div>

    <!-- Estado de carga -->
    <div v-else-if="loading" class="image-loading" :class="loadingClass">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText || 'Cargando imagen...' }}</div>
    </div>

    <!-- Estado de error -->
    <div v-else-if="error" class="image-error" :class="errorClass">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ errorText || 'Error al cargar la imagen' }}</div>
      <button v-if="allowRetry" class="retry-button" @click="retryLoad">
        🔄 Reintentar
      </button>
    </div>

    <!-- Input file oculto para upload -->
    <input 
      v-if="allowUpload"
      type="file" 
      ref="fileInput"
      accept="image/*"
      multiple="false"
      style="display: none"
      @change="handleFileUpload"
    />

    <!-- Información adicional debajo de la imagen -->
    <div v-if="showInfo && imageInfo" class="image-info">
      <div v-if="imageInfo.title" class="info-title">{{ imageInfo.title }}</div>
      <div v-if="imageInfo.description" class="info-description">{{ imageInfo.description }}</div>
      <div v-if="imageInfo.metadata" class="info-metadata">
        <span v-for="(value, key) in imageInfo.metadata" :key="key" class="metadata-item">
          <strong>{{ key }}:</strong> {{ value }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  // URL de la imagen
  imageUrl: {
    type: String,
    default: null
  },
  
  // Texto alternativo
  altText: {
    type: String,
    default: 'Imagen'
  },
  
  // Tamaño predefinido
  size: {
    type: String,
    default: 'medium', // small, medium, large, full
    validator: (value) => ['small', 'medium', 'large', 'full'].includes(value)
  },
  
  // Forma de la imagen
  shape: {
    type: String,
    default: 'rectangle', // rectangle, square, circle
    validator: (value) => ['rectangle', 'square', 'circle'].includes(value)
  },
  
  // Modo de ajuste de la imagen
  objectFit: {
    type: String,
    default: 'cover', // cover, contain, fill
    validator: (value) => ['cover', 'contain', 'fill'].includes(value)
  },
  
  // Estado de carga
  loading: {
    type: Boolean,
    default: false
  },
  
  // Texto de carga personalizado
  loadingText: {
    type: String,
    default: null
  },
  
  // Estado de error
  error: {
    type: Boolean,
    default: false
  },
  
  // Texto de error personalizado
  errorText: {
    type: String,
    default: null
  },
  
  // Permitir reintentar carga
  allowRetry: {
    type: Boolean,
    default: true
  },
  
  // Placeholder
  placeholderIcon: {
    type: String,
    default: '📷'
  },
  
  placeholderText: {
    type: String,
    default: 'Sin imagen'
  },
  
  // Upload de archivos
  allowUpload: {
    type: Boolean,
    default: false
  },
  
  // Overlay
  showOverlay: {
    type: Boolean,
    default: false
  },
  
  overlayTitle: {
    type: String,
    default: null
  },
  
  overlaySubtitle: {
    type: String,
    default: null
  },
  
  overlayActions: {
    type: Array,
    default: () => []
  },
  
  // Badge
  badge: {
    type: String,
    default: null
  },
  
  badgeType: {
    type: String,
    default: 'primary', // primary, secondary, success, warning, error
    validator: (value) => ['primary', 'secondary', 'success', 'warning', 'error'].includes(value)
  },
  
  // Zoom
  zoomable: {
    type: Boolean,
    default: false
  },
  
  // Información adicional
  showInfo: {
    type: Boolean,
    default: false
  },
  
  imageInfo: {
    type: Object,
    default: () => ({})
  },
  
  // Clases personalizadas
  containerClass: {
    type: String,
    default: ''
  },
  
  imageClass: {
    type: String,
    default: ''
  },
  
  placeholderClass: {
    type: String,
    default: ''
  },
  
  loadingClass: {
    type: String,
    default: ''
  },
  
  errorClass: {
    type: String,
    default: ''
  }
})

// Eventos
const emit = defineEmits([
  'imageClick',
  'placeholderClick', 
  'overlayAction',
  'imageLoad',
  'imageError',
  'fileUpload',
  'retry'
])

// Referencias
const fileInput = ref(null)
const internalLoading = ref(false)
const internalError = ref(false)

// Computadas
const badgeClass = computed(() => `badge-${props.badgeType}`)

// Watchers
watch(() => props.imageUrl, () => {
  internalError.value = false
})

// Métodos
const handleImageClick = (event) => {
  if (props.zoomable) {
    // Aquí se podría implementar un modal de zoom
    emit('imageClick', event)
  } else {
    emit('imageClick', event)
  }
}

const onImageLoad = (event) => {
  internalLoading.value = false
  internalError.value = false
  emit('imageLoad', event)
}

const onImageError = (event) => {
  internalLoading.value = false
  internalError.value = true
  emit('imageError', event)
}

const retryLoad = () => {
  internalError.value = false
  internalLoading.value = true
  emit('retry')
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    emit('fileUpload', files[0])
  }
}
</script>

<style scoped>
.image-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

/* Tamaños predefinidos */
.image-container.size-small {
  max-width: 120px;
  max-height: 120px;
}

.image-container.size-medium {
  max-width: 250px;
  max-height: 250px;
}

.image-container.size-large {
  max-width: 400px;
  max-height: 400px;
}

.image-container.size-full {
  width: 100%;
  height: auto;
}

/* Wrapper de la imagen */
.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

.image-wrapper.has-overlay:hover .image-overlay {
  opacity: 1;
}

/* Imagen principal */
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: var(--object-fit, cover);
  transition: transform 0.3s ease;
}

.image-wrapper img.shape-circle {
  border-radius: 50%;
}

.image-wrapper img.shape-square {
  aspect-ratio: 1/1;
}

.image-wrapper:hover img {
  transform: scale(1.05);
}

/* Overlay */
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.7) 100%
  );
  display: flex;
  align-items: flex-end;
  padding: 15px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.overlay-content {
  color: white;
  width: 100%;
}

.overlay-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 5px;
}

.overlay-subtitle {
  font-size: 0.9rem;
  opacity: 0.9;
  margin-bottom: 10px;
}

.overlay-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.overlay-button {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.overlay-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Badge */
.image-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 10;
}

.badge-primary {
  background-color: var(--primary-green);
  color: white;
}

.badge-secondary {
  background-color: #6c757d;
  color: white;
}

.badge-success {
  background-color: #28a745;
  color: white;
}

.badge-warning {
  background-color: #ffc107;
  color: #212529;
}

.badge-error {
  background-color: #dc3545;
  color: white;
}

/* Indicador de zoom */
.zoom-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px;
  border-radius: 50%;
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-wrapper:hover .zoom-indicator {
  opacity: 1;
}

/* Placeholder */
.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  background-color: #f8f9fa;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-placeholder:hover {
  background-color: #e9ecef;
  border-color: var(--primary-green);
}

.placeholder-content {
  text-align: center;
  color: var(--text-light);
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.placeholder-text {
  margin-bottom: 15px;
  font-size: 0.9rem;
}

.upload-button {
  background-color: var(--primary-green);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.upload-button:hover {
  background-color: #45a049;
}

/* Loading */
.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: var(--text-light);
  font-size: 0.9rem;
}

/* Error */
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  background-color: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  color: #c53030;
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 10px;
}

.error-text {
  margin-bottom: 15px;
  font-size: 0.9rem;
  text-align: center;
}

.retry-button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 15px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.retry-button:hover {
  background-color: #c82333;
}

/* Información de la imagen */
.image-info {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.info-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--primary-green);
}

.info-description {
  margin-bottom: 10px;
  color: var(--text-color);
  line-height: 1.5;
}

.info-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.metadata-item {
  font-size: 0.85rem;
  color: var(--text-light);
}

.metadata-item strong {
  color: var(--text-color);
}

/* Responsive */
@media (max-width: 768px) {
  .image-container.size-medium {
    max-width: 200px;
    max-height: 200px;
  }
  
  .image-container.size-large {
    max-width: 300px;
    max-height: 300px;
  }
  
  .overlay-actions {
    flex-direction: column;
  }
  
  .info-metadata {
    flex-direction: column;
    gap: 8px;
  }
}
</style>