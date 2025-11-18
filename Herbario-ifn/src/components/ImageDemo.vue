<template>
  <div class="demo-images">
    <div class="view-header">🖼️ Demostración de Componentes de Imagen</div>
    
    <div class="container">
      <!-- Componente de imagen individual -->
      <section class="demo-section">
        <h3>Componente de Imagen Individual</h3>
        <div class="demo-grid">
          <div class="demo-item">
            <h4>Con imagen (con overlay)</h4>
            <ImageComponent
              image-url="https://images.unsplash.com/photo-1597848212624-e8867652ad3e?w=400&h=300&fit=crop"
              alt-text="Girasol - Helianthus annuus"
              size="medium"
              shape="rectangle"
              :show-overlay="true"
              overlay-title="Helianthus annuus"
              overlay-subtitle="Asteraceae"
              :overlay-actions="sampleActions"
              badge="IDEAM-001"
              badge-type="primary"
              :zoomable="true"
              @image-click="handleImageClick"
              @overlay-action="handleOverlayAction"
            />
          </div>
          
          <div class="demo-item">
            <h4>Sin imagen (placeholder)</h4>
            <ImageComponent
              size="medium"
              shape="rectangle"
              placeholder-icon="🌿"
              placeholder-text="Sin imagen del espécimen"
              :allow-upload="true"
              @placeholder-click="handlePlaceholderClick"
              @file-upload="handleFileUpload"
            />
          </div>
          
          <div class="demo-item">
            <h4>Forma circular</h4>
            <ImageComponent
              image-url="https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400&h=300&fit=crop"
              alt-text="Mimosa pudica"
              size="medium"
              shape="circle"
              badge="FABACEAE"
              badge-type="success"
            />
          </div>
          
          <div class="demo-item">
            <h4>Estado de carga</h4>
            <ImageComponent
              :loading="true"
              loading-text="Cargando espécimen..."
              size="medium"
            />
          </div>
        </div>
      </section>

      <!-- Galería de imágenes -->
      <section class="demo-section">
        <h3>Galería de Imágenes</h3>
        <ImageGallery
          :images="galleryImages"
          title="Colección de Especímenes"
          subtitle="Herbario Digital - Tax-IFN - Ejemplos de la colección"
          :show-controls="true"
          :show-image-info="true"
          :zoomable="true"
          :allow-selection="true"
          :show-pagination="true"
          :images-per-page="6"
          @image-click="handleGalleryImageClick"
          @image-select="handleImageSelect"
        />
      </section>

      <!-- Ejemplos de diferentes tamaños -->
      <section class="demo-section">
        <h3>Diferentes Tamaños</h3>
        <div class="size-demo">
          <div class="size-item">
            <h4>Pequeño</h4>
            <ImageComponent
              image-url="https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=200&h=200&fit=crop"
              size="small"
              shape="square"
            />
          </div>
          
          <div class="size-item">
            <h4>Mediano</h4>
            <ImageComponent
              image-url="https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&h=300&fit=crop"
              size="medium"
              shape="square"
            />
          </div>
          
          <div class="size-item">
            <h4>Grande</h4>
            <ImageComponent
              image-url="https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&h=400&fit=crop"
              size="large"
              shape="square"
            />
          </div>
        </div>
      </section>

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
import { reactive } from 'vue'
import ImageComponent from './ImageComponent.vue'
import ImageGallery from './ImageGallery.vue'

// Eventos
const emit = defineEmits(['navigate'])

// Datos para los ejemplos
const sampleActions = [
  { id: 'zoom', icon: '🔍', label: 'Ampliar' },
  { id: 'edit', icon: '✏️', label: 'Editar' },
  { id: 'download', icon: '💾', label: 'Descargar' }
]

const galleryImages = reactive([
  {
    id: 1,
    url: 'https://images.unsplash.com/photo-1597848212624-e8867652ad3e?w=400&h=300&fit=crop',
    title: 'Helianthus annuus',
    subtitle: 'Asteraceae',
    alt: 'Girasol',
    description: 'Espécimen de girasol recolectado en Cundinamarca',
    date: '2024-03-15',
    size: '2.3 MB',
    type: 'Asteraceae',
    badge: 'IDEAM-001',
    badgeType: 'primary',
    info: {
      title: 'Helianthus annuus L.',
      date: '15 Mar 2024',
      size: '2.3 MB'
    }
  },
  {
    id: 2,
    url: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400&h=300&fit=crop',
    title: 'Mimosa pudica',
    subtitle: 'Fabaceae',
    alt: 'Planta sensitiva',
    description: 'Planta sensitiva con hojas que se cierran al contacto',
    date: '2024-03-18',
    size: '1.8 MB',
    type: 'Fabaceae',
    badge: 'IDEAM-002',
    badgeType: 'success',
    info: {
      title: 'Mimosa pudica L.',
      date: '18 Mar 2024',
      size: '1.8 MB'
    }
  },
  {
    id: 3,
    url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&h=300&fit=crop',
    title: 'Rosa canina',
    subtitle: 'Rosaceae',
    alt: 'Rosa silvestre',
    description: 'Rosa silvestre con flores blancas-rosadas',
    date: '2024-03-20',
    size: '2.1 MB',
    type: 'Rosaceae',
    badge: 'IDEAM-003',
    badgeType: 'warning',
    info: {
      title: 'Rosa canina L.',
      date: '20 Mar 2024',
      size: '2.1 MB'
    }
  },
  {
    id: 4,
    url: 'https://images.unsplash.com/photo-1574263867128-7e5ac58edf1d?w=400&h=300&fit=crop',
    title: 'Poa annua',
    subtitle: 'Poaceae',
    alt: 'Gramínea anual',
    description: 'Gramínea anual común en áreas urbanas',
    date: '2024-03-22',
    size: '1.5 MB',
    type: 'Poaceae',
    badge: 'IDEAM-004',
    badgeType: 'primary',
    info: {
      title: 'Poa annua L.',
      date: '22 Mar 2024',
      size: '1.5 MB'
    }
  },
  {
    id: 5,
    url: 'https://images.unsplash.com/photo-1568409938596-d0d2d5d39b9d?w=400&h=300&fit=crop',
    title: 'Taraxacum officinale',
    subtitle: 'Asteraceae',
    alt: 'Diente de león',
    description: 'Diente de león común con flores amarillas',
    date: '2024-03-25',
    size: '1.9 MB',
    type: 'Asteraceae',
    badge: 'IDEAM-005',
    badgeType: 'error',
    info: {
      title: 'Taraxacum officinale Weber',
      date: '25 Mar 2024',
      size: '1.9 MB'
    }
  },
  {
    id: 6,
    url: 'https://images.unsplash.com/photo-1585336261022-680e8c2c0b34?w=400&h=300&fit=crop',
    title: 'Trifolium repens',
    subtitle: 'Fabaceae',
    alt: 'Trébol blanco',
    description: 'Trébol blanco rastrero con hojas trifoliadas',
    date: '2024-03-28',
    size: '2.0 MB',
    type: 'Fabaceae',
    badge: 'IDEAM-006',
    badgeType: 'success',
    info: {
      title: 'Trifolium repens L.',
      date: '28 Mar 2024',
      size: '2.0 MB'
    }
  },
  {
    id: 7,
    url: 'https://images.unsplash.com/photo-1620794108219-80e44fb75c10?w=400&h=300&fit=crop',
    title: 'Plantago major',
    subtitle: 'Plantaginaceae',
    alt: 'Llantén mayor',
    description: 'Llantén mayor con hojas basales',
    date: '2024-04-01',
    size: '1.7 MB',
    type: 'Plantaginaceae',
    badge: 'IDEAM-007',
    badgeType: 'secondary',
    info: {
      title: 'Plantago major L.',
      date: '01 Abr 2024',
      size: '1.7 MB'
    }
  },
  {
    id: 8,
    url: 'https://images.unsplash.com/photo-1566146991569-696da38bb775?w=400&h=300&fit=crop',
    title: 'Chenopodium album',
    subtitle: 'Amaranthaceae',
    alt: 'Cenizo blanco',
    description: 'Cenizo blanco con hojas alternas',
    date: '2024-04-03',
    size: '1.6 MB',
    type: 'Amaranthaceae',
    badge: 'IDEAM-008',
    badgeType: 'primary',
    info: {
      title: 'Chenopodium album L.',
      date: '03 Abr 2024',
      size: '1.6 MB'
    }
  }
])

// Métodos para manejar eventos
const handleImageClick = (event) => {
  console.log('Imagen clickeada:', event)
}

const handleOverlayAction = (action) => {
  console.log('Acción del overlay:', action)
  switch (action.id) {
    case 'zoom':
      console.log('Ampliando imagen...')
      break
    case 'edit':
      console.log('Editando imagen...')
      break
    case 'download':
      console.log('Descargando imagen...')
      break
  }
}

const handlePlaceholderClick = (event) => {
  console.log('Placeholder clickeado:', event)
}

const handleFileUpload = (file) => {
  console.log('Archivo subido:', file)
}

const handleGalleryImageClick = (data) => {
  console.log('Imagen de galería clickeada:', data)
}

const handleImageSelect = (selectedImages) => {
  console.log('Imágenes seleccionadas:', selectedImages)
}
</script>

<style scoped>
.demo-section {
  margin-bottom: 50px;
  padding: 30px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fcfcfc;
}

.demo-section h3 {
  margin: 0 0 25px 0;
  color: var(--primary-green);
  text-align: center;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-top: 20px;
}

.demo-item {
  text-align: center;
}

.demo-item h4 {
  margin: 0 0 15px 0;
  color: var(--text-color);
  font-size: 1rem;
}

.size-demo {
  display: flex;
  justify-content: center;
  align-items: end;
  gap: 30px;
  flex-wrap: wrap;
}

.size-item {
  text-align: center;
}

.size-item h4 {
  margin: 0 0 15px 0;
  color: var(--text-color);
}

@media (max-width: 768px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
  
  .size-demo {
    flex-direction: column;
    align-items: center;
  }
  
  .demo-section {
    padding: 20px;
  }
}
</style>