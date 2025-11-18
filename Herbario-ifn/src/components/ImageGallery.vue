<template>
  <div class="image-gallery" :class="galleryClass">
    <!-- Header de la galería -->
    <div v-if="title || $slots.header" class="gallery-header">
      <slot name="header">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle" class="gallery-subtitle">{{ subtitle }}</p>
      </slot>
    </div>

    <!-- Controles de la galería -->
    <div v-if="showControls" class="gallery-controls">
      <div class="view-controls">
        <button 
          class="control-btn"
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
          title="Vista en cuadrícula"
        >
          ⊞
        </button>
        <button 
          class="control-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
          title="Vista en lista"
        >
          ☰
        </button>
        <button 
          class="control-btn"
          :class="{ active: viewMode === 'carousel' }"
          @click="viewMode = 'carousel'"
          title="Carrusel"
        >
          ⟷
        </button>
      </div>
      
      <div class="gallery-actions">
        <button v-if="allowUpload" class="control-btn" @click="triggerUpload">
          📁 Subir
        </button>
        <button v-if="allowDownload && selectedImages.length > 0" class="control-btn" @click="downloadSelected">
          💾 Descargar ({{ selectedImages.length }})
        </button>
      </div>
    </div>

    <!-- Vista en cuadrícula -->
    <div v-if="viewMode === 'grid'" class="gallery-grid" :class="`grid-${gridSize}`">
      <div 
        v-for="(image, index) in displayedImages" 
        :key="image.id || index"
        class="grid-item"
        :class="{ selected: isSelected(image) }"
      >
        <ImageComponent
          :image-url="image.url"
          :alt-text="image.alt || `Imagen ${index + 1}`"
          :size="imageSize"
          :shape="imageShape"
          :show-overlay="showImageOverlay"
          :overlay-title="image.title"
          :overlay-subtitle="image.subtitle"
          :overlay-actions="getImageActions(image)"
          :badge="image.badge"
          :badge-type="image.badgeType"
          :zoomable="zoomable"
          :loading="image.loading"
          :error="image.error"
          @image-click="handleImageClick(image, index)"
          @overlay-action="handleOverlayAction"
        />
        
        <!-- Checkbox para selección múltiple -->
        <div v-if="allowSelection" class="selection-checkbox">
          <input 
            type="checkbox" 
            :checked="isSelected(image)"
            @change="toggleSelection(image)"
          />
        </div>
        
        <!-- Información de la imagen en grid -->
        <div v-if="showImageInfo && image.info" class="grid-image-info">
          <div class="image-title">{{ image.info.title }}</div>
          <div class="image-meta">{{ image.info.date }} • {{ image.info.size }}</div>
        </div>
      </div>
    </div>

    <!-- Vista en lista -->
    <div v-else-if="viewMode === 'list'" class="gallery-list">
      <div 
        v-for="(image, index) in displayedImages" 
        :key="image.id || index"
        class="list-item"
        :class="{ selected: isSelected(image) }"
        @click="handleImageClick(image, index)"
      >
        <div class="list-image">
          <ImageComponent
            :image-url="image.url"
            :alt-text="image.alt || `Imagen ${index + 1}`"
            size="small"
            shape="square"
            :loading="image.loading"
            :error="image.error"
          />
        </div>
        
        <div class="list-content">
          <h4>{{ image.title || `Imagen ${index + 1}` }}</h4>
          <p v-if="image.description">{{ image.description }}</p>
          <div class="list-meta">
            <span v-if="image.date">📅 {{ image.date }}</span>
            <span v-if="image.size">📏 {{ image.size }}</span>
            <span v-if="image.type">🏷️ {{ image.type }}</span>
          </div>
        </div>
        
        <div class="list-actions">
          <button class="action-btn" @click.stop="viewImage(image, index)">👁️</button>
          <button v-if="allowEdit" class="action-btn" @click.stop="editImage(image)">✏️</button>
          <button v-if="allowDelete" class="action-btn delete" @click.stop="deleteImage(image)">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Vista de carrusel -->
    <div v-else-if="viewMode === 'carousel'" class="gallery-carousel">
      <div class="carousel-container">
        <button 
          class="carousel-nav prev" 
          @click="previousImage"
          :disabled="currentImageIndex === 0"
        >
          ‹
        </button>
        
        <div class="carousel-main">
          <ImageComponent
            v-if="currentImage"
            :image-url="currentImage.url"
            :alt-text="currentImage.alt || 'Imagen del carrusel'"
            size="large"
            :show-overlay="true"
            :overlay-title="currentImage.title"
            :overlay-subtitle="currentImage.subtitle"
            :zoomable="true"
            :loading="currentImage.loading"
            :error="currentImage.error"
            @image-click="openFullscreen"
          />
        </div>
        
        <button 
          class="carousel-nav next" 
          @click="nextImage"
          :disabled="currentImageIndex === displayedImages.length - 1"
        >
          ›
        </button>
      </div>
      
      <!-- Thumbnails del carrusel -->
      <div class="carousel-thumbnails">
        <div 
          v-for="(image, index) in displayedImages" 
          :key="image.id || index"
          class="thumbnail"
          :class="{ active: index === currentImageIndex }"
          @click="currentImageIndex = index"
        >
          <img :src="image.url" :alt="image.alt || `Thumbnail ${index + 1}`" />
        </div>
      </div>
    </div>

    <!-- Paginación -->
    <div v-if="showPagination && totalPages > 1" class="gallery-pagination">
      <button 
        class="pagination-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        Anterior
      </button>
      
      <div class="pagination-info">
        Página {{ currentPage }} de {{ totalPages }}
        <span class="total-images">({{ totalImages }} imágenes)</span>
      </div>
      
      <button 
        class="pagination-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        Siguiente
      </button>
    </div>

    <!-- Input file oculto -->
    <input 
      v-if="allowUpload"
      type="file" 
      ref="fileInput"
      accept="image/*"
      multiple
      style="display: none"
      @change="handleFileUpload"
    />

    <!-- Modal de imagen completa -->
    <div v-if="fullscreenImage" class="fullscreen-modal" @click="closeFullscreen">
      <div class="fullscreen-content" @click.stop>
        <button class="fullscreen-close" @click="closeFullscreen">✕</button>
        <img :src="fullscreenImage.url" :alt="fullscreenImage.alt" />
        <div v-if="fullscreenImage.title" class="fullscreen-info">
          <h3>{{ fullscreenImage.title }}</h3>
          <p v-if="fullscreenImage.description">{{ fullscreenImage.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ImageComponent from './ImageComponent.vue'

// Props
const props = defineProps({
  // Lista de imágenes
  images: {
    type: Array,
    default: () => []
  },
  
  // Configuración de la galería
  title: {
    type: String,
    default: null
  },
  
  subtitle: {
    type: String,
    default: null
  },
  
  // Modo de vista inicial
  initialViewMode: {
    type: String,
    default: 'grid',
    validator: (value) => ['grid', 'list', 'carousel'].includes(value)
  },
  
  // Configuración de grid
  gridSize: {
    type: String,
    default: 'medium', // small, medium, large
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  
  // Configuración de imágenes
  imageSize: {
    type: String,
    default: 'medium'
  },
  
  imageShape: {
    type: String,
    default: 'rectangle'
  },
  
  // Funcionalidades
  showControls: {
    type: Boolean,
    default: true
  },
  
  showImageOverlay: {
    type: Boolean,
    default: true
  },
  
  showImageInfo: {
    type: Boolean,
    default: true
  },
  
  zoomable: {
    type: Boolean,
    default: true
  },
  
  allowSelection: {
    type: Boolean,
    default: false
  },
  
  allowUpload: {
    type: Boolean,
    default: false
  },
  
  allowEdit: {
    type: Boolean,
    default: false
  },
  
  allowDelete: {
    type: Boolean,
    default: false
  },
  
  allowDownload: {
    type: Boolean,
    default: false
  },
  
  // Paginación
  showPagination: {
    type: Boolean,
    default: false
  },
  
  imagesPerPage: {
    type: Number,
    default: 12
  },
  
  // Clases personalizadas
  galleryClass: {
    type: String,
    default: ''
  }
})

// Eventos
const emit = defineEmits([
  'imageClick',
  'imageSelect',
  'imageUpload',
  'imageEdit',
  'imageDelete',
  'overlayAction'
])

// Estado reactivo
const viewMode = ref(props.initialViewMode)
const currentImageIndex = ref(0)
const currentPage = ref(1)
const selectedImages = ref([])
const fullscreenImage = ref(null)
const fileInput = ref(null)

// Computadas
const totalImages = computed(() => props.images.length)

const totalPages = computed(() => {
  if (!props.showPagination) return 1
  return Math.ceil(totalImages.value / props.imagesPerPage)
})

const displayedImages = computed(() => {
  if (!props.showPagination) return props.images
  
  const start = (currentPage.value - 1) * props.imagesPerPage
  const end = start + props.imagesPerPage
  return props.images.slice(start, end)
})

const currentImage = computed(() => {
  return displayedImages.value[currentImageIndex.value] || null
})

// Métodos
const handleImageClick = (image, index) => {
  emit('imageClick', { image, index })
  if (viewMode.value === 'carousel') {
    currentImageIndex.value = index
  }
}

const handleOverlayAction = (action) => {
  emit('overlayAction', action)
}

const getImageActions = (image) => {
  const actions = []
  
  if (props.zoomable) {
    actions.push({ id: 'zoom', icon: '🔍', label: 'Ampliar' })
  }
  
  if (props.allowEdit) {
    actions.push({ id: 'edit', icon: '✏️', label: 'Editar' })
  }
  
  if (props.allowDelete) {
    actions.push({ id: 'delete', icon: '🗑️', label: 'Eliminar' })
  }
  
  return actions
}

const isSelected = (image) => {
  return selectedImages.value.some(selected => selected.id === image.id)
}

const toggleSelection = (image) => {
  const index = selectedImages.value.findIndex(selected => selected.id === image.id)
  if (index > -1) {
    selectedImages.value.splice(index, 1)
  } else {
    selectedImages.value.push(image)
  }
  emit('imageSelect', selectedImages.value)
}

const viewImage = (image, index) => {
  handleImageClick(image, index)
}

const editImage = (image) => {
  emit('imageEdit', image)
}

const deleteImage = (image) => {
  emit('imageDelete', image)
}

const previousImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  }
}

const nextImage = () => {
  if (currentImageIndex.value < displayedImages.value.length - 1) {
    currentImageIndex.value++
  }
}

const openFullscreen = () => {
  fullscreenImage.value = currentImage.value
}

const closeFullscreen = () => {
  fullscreenImage.value = null
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event) => {
  const files = Array.from(event.target.files)
  emit('imageUpload', files)
}

const downloadSelected = () => {
  // Implementar descarga de imágenes seleccionadas
  console.log('Descargando imágenes:', selectedImages.value)
}

// Watchers
watch(() => displayedImages.value.length, () => {
  if (currentImageIndex.value >= displayedImages.value.length) {
    currentImageIndex.value = 0
  }
})
</script>

<style scoped>
.image-gallery {
  width: 100%;
}

.gallery-header {
  margin-bottom: 20px;
  text-align: center;
}

.gallery-subtitle {
  color: var(--text-light);
  margin-top: 8px;
}

.gallery-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.view-controls, .gallery-actions {
  display: flex;
  gap: 8px;
}

.control-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background-color: white;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.control-btn:hover {
  background-color: var(--primary-green);
  color: white;
  border-color: var(--primary-green);
}

.control-btn.active {
  background-color: var(--primary-green);
  color: white;
  border-color: var(--primary-green);
}

/* Vista en cuadrícula */
.gallery-grid {
  display: grid;
  gap: 20px;
  margin-bottom: 20px;
}

.grid-small {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.grid-medium {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.grid-large {
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
}

.grid-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.grid-item:hover {
  transform: translateY(-5px);
}

.grid-item.selected {
  outline: 3px solid var(--primary-green);
}

.selection-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

.selection-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.grid-image-info {
  padding: 10px;
  background-color: white;
  border-top: 1px solid var(--border-color);
}

.image-title {
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--primary-green);
}

.image-meta {
  font-size: 0.8rem;
  color: var(--text-light);
}

/* Vista en lista */
.gallery-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 10px;
}

.list-item:hover {
  box-shadow: var(--shadow-light);
  transform: translateY(-2px);
}

.list-item.selected {
  border-color: var(--primary-green);
  background-color: rgba(76, 175, 80, 0.05);
}

.list-image {
  margin-right: 15px;
  flex-shrink: 0;
}

.list-content {
  flex: 1;
}

.list-content h4 {
  margin: 0 0 8px 0;
  color: var(--primary-green);
}

.list-content p {
  margin: 0 0 8px 0;
  color: var(--text-color);
  line-height: 1.4;
}

.list-meta {
  display: flex;
  gap: 15px;
  font-size: 0.85rem;
  color: var(--text-light);
}

.list-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  background-color: white;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.action-btn:hover {
  background-color: var(--primary-green);
  color: white;
  border-color: var(--primary-green);
}

.action-btn.delete:hover {
  background-color: #dc3545;
  border-color: #dc3545;
}

/* Vista de carrusel */
.gallery-carousel {
  margin-bottom: 20px;
}

.carousel-container {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.carousel-nav {
  background-color: var(--primary-green);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-nav:hover:not(:disabled) {
  background-color: #45a049;
  transform: scale(1.1);
}

.carousel-nav:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.carousel-main {
  flex: 1;
  display: flex;
  justify-content: center;
}

.carousel-thumbnails {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 5px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.thumbnail:hover {
  border-color: var(--primary-green);
}

.thumbnail.active {
  border-color: var(--primary-green);
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Paginación */
.gallery-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
}

.pagination-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background-color: white;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--primary-green);
  color: white;
  border-color: var(--primary-green);
}

.pagination-btn:disabled {
  background-color: #f8f9fa;
  color: #ccc;
  cursor: not-allowed;
}

.pagination-info {
  font-weight: 600;
  text-align: center;
}

.total-images {
  color: var(--text-light);
  font-weight: normal;
  font-size: 0.9rem;
}

/* Modal de pantalla completa */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.fullscreen-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  text-align: center;
}

.fullscreen-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  padding: 5px;
}

.fullscreen-content img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}

.fullscreen-info {
  margin-top: 20px;
  color: white;
  text-align: center;
}

.fullscreen-info h3 {
  margin: 0 0 10px 0;
}

.fullscreen-info p {
  margin: 0;
  opacity: 0.9;
}

/* Responsive */
@media (max-width: 768px) {
  .gallery-controls {
    flex-direction: column;
    gap: 15px;
  }
  
  .grid-medium {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  
  .grid-large {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
  
  .list-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .list-image {
    margin-right: 0;
  }
  
  .carousel-container {
    flex-direction: column;
  }
  
  .carousel-nav {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }
  
  .gallery-pagination {
    flex-direction: column;
    gap: 15px;
  }
}
</style>