import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Importar rutas
import conglomeradosRoutes from './routes/conglomerados.js';
import coleccionesRoutes from './routes/colecciones.js';
import enviosRoutes from './routes/envios.js';
import campoRoutes from './routes/campo.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// MIDDLEWARE
// ============================================

// Seguridad
app.use(helmet());

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como herramientas de testing)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger simple
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Servicio Externo API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Info
app.get(API_PREFIX, (req, res) => {
  res.json({
    name: 'API Externa - Datos de Campo IFN',
    version: '1.0.0',
    description: 'API simulada que provee datos de conglomerados, colecciones botánicas y datos de campo',
    endpoints: {
      conglomerados: `${API_PREFIX}/conglomerados`,
      colecciones: `${API_PREFIX}/colecciones`,
      envios: `${API_PREFIX}/envios`,
      campo: `${API_PREFIX}/campo`
    },
    documentation: '/docs'
  });
});

// API Routes
app.use(`${API_PREFIX}/conglomerados`, conglomeradosRoutes);
app.use(`${API_PREFIX}/colecciones`, coleccionesRoutes);
app.use(`${API_PREFIX}/envios`, enviosRoutes);
app.use(`${API_PREFIX}/campo`, campoRoutes);

// Documentación
app.get('/docs', (req, res) => {
  res.json({
    title: 'API Externa - Documentación',
    version: '1.0.0',
    baseUrl: `http://localhost:${PORT}${API_PREFIX}`,
    endpoints: [
      {
        group: 'Conglomerados',
        routes: [
          { method: 'GET', path: '/conglomerados', description: 'Lista todos los conglomerados' },
          { method: 'GET', path: '/conglomerados/:codigo', description: 'Obtiene un conglomerado específico' },
          { method: 'GET', path: '/conglomerados/:codigo/subparcelas', description: 'Subparcelas de un conglomerado' },
          { method: 'GET', path: '/conglomerados/:codigo/ruta', description: 'Ruta de acceso al conglomerado' },
          { method: 'GET', path: '/conglomerados/:codigo/puntos-referencia', description: 'Puntos de referencia de ruta' }
        ]
      },
      {
        group: 'Colecciones Botánicas',
        routes: [
          { method: 'GET', path: '/colecciones', description: 'Lista colecciones con filtros' },
          { method: 'GET', path: '/colecciones/:id', description: 'Obtiene una colección específica' },
          { method: 'GET', path: '/colecciones/conglomerado/:codigo', description: 'Colecciones de un conglomerado' }
        ]
      },
      {
        group: 'Envíos de Muestras',
        routes: [
          { method: 'GET', path: '/envios', description: 'Lista envíos con filtros' },
          { method: 'GET', path: '/envios/:id', description: 'Obtiene un envío específico' },
          { method: 'GET', path: '/envios/conglomerado/:codigo', description: 'Envíos de un conglomerado' }
        ]
      },
      {
        group: 'Datos de Campo',
        routes: [
          { method: 'GET', path: '/campo/coberturas/:codigo', description: 'Coberturas y alteraciones' },
          { method: 'GET', path: '/campo/inclinacion/:codigo', description: 'Inclinaciones y pendientes' },
          { method: 'GET', path: '/campo/esquema/:codigo', description: 'Esquema del conglomerado' },
          { method: 'GET', path: '/campo/puntos-subparcela/:codigo', description: 'Puntos de referencia de subparcelas' }
        ]
      }
    ],
    examples: {
      'Listar conglomerados': `GET ${API_PREFIX}/conglomerados?limit=10&offset=0`,
      'Buscar por código': `GET ${API_PREFIX}/conglomerados/CON-001`,
      'Colecciones con filtro': `GET ${API_PREFIX}/colecciones?fecha_desde=2025-01-01&limit=20`,
      'Datos de campo': `GET ${API_PREFIX}/campo/coberturas/CON-001`
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path,
    suggestion: 'Visita /docs para ver la documentación completa'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('================================================');
  console.log('  🌿 SERVICIO EXTERNO API - IFN');
  console.log('================================================');
  console.log(`  🚀 Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`  📚 Documentación: http://localhost:${PORT}/docs`);
  console.log(`  ❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`  🔗 API Base: http://localhost:${PORT}${API_PREFIX}`);
  console.log('================================================');
  console.log('');
  console.log('  Endpoints disponibles:');
  console.log(`    - GET ${API_PREFIX}/conglomerados`);
  console.log(`    - GET ${API_PREFIX}/colecciones`);
  console.log(`    - GET ${API_PREFIX}/envios`);
  console.log(`    - GET ${API_PREFIX}/campo/coberturas/:codigo`);
  console.log('');
  console.log('  Presiona Ctrl+C para detener el servidor');
  console.log('');
});

export default app;
