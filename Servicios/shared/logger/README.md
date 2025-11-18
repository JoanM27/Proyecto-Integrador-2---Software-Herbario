# 📝 Sistema de Logging Centralizado

Sistema de logging robusto para todos los microservicios del Herbario Digital.

## ✨ Características

- **Logs en consola con colores** - Fácil lectura durante desarrollo
- **Logs en archivos rotativos** - Persistencia de logs con rotación automática
- **4 niveles de log** - debug, info, warn, error
- **Formato JSON** - Logs estructurados en archivos
- **Metadata contextual** - Información adicional por log
- **Middleware Express** - Logging automático de requests/responses
- **Error handlers** - Captura de errores no manejados

## 🚀 Uso Básico

```javascript
import createLogger from '../shared/logger/index.js'

// Crear logger para el servicio
const logger = createLogger('Auth_Service')

// Logs simples
logger.debug('Mensaje de debug')
logger.info('Operación exitosa')
logger.warn('Advertencia')
logger.error('Error crítico')

// Logs con metadata
logger.info('Usuario autenticado', { 
  userId: '123', 
  email: 'user@example.com' 
})

logger.error('Error en base de datos', {
  error: err.message,
  stack: err.stack,
  query: 'SELECT * FROM users'
})
```

## 🔧 Integración con Express

```javascript
import express from 'express'
import createLogger from '../shared/logger/index.js'

const app = express()
const logger = createLogger('Mi_Service')

// Guardar logger en app para usarlo en rutas
app.set('logger', logger)

// Middleware de logging automático
app.use(logger.expressMiddleware())

// Usar en rutas
app.get('/users', async (req, res) => {
  const logger = req.app.get('logger')
  
  try {
    logger.debug('Obteniendo usuarios')
    const users = await getUsers()
    logger.info('Usuarios obtenidos', { count: users.length })
    res.json(users)
  } catch (error) {
    logger.error('Error obteniendo usuarios', {
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Internal error' })
  }
})
```

## ⚙️ Configuración

```javascript
const logger = createLogger('Auth_Service', {
  logLevel: 'debug',           // Nivel mínimo: debug|info|warn|error
  enableFileLogging: true,     // Habilitar logs en archivo
  logDir: './logs',            // Directorio de logs
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5                  // Máximo de archivos rotados
})
```

## 📂 Estructura de Archivos

Los logs se guardan en `Servicios/logs/`:

```
logs/
├── Auth_Service-debug-2025-11-12.log
├── Auth_Service-info-2025-11-12.log
├── Auth_Service-warn-2025-11-12.log
├── Auth_Service-error-2025-11-12.log
├── Auth_Service-combined-2025-11-12.log
├── Lab_Service-error-2025-11-12.log
└── ...
```

## 📋 Formato de Logs

### Consola (con colores)
```
[2025-11-12T17:30:45.123Z] INFO  [Auth_Service] Usuario autenticado
{
  "userId": "123",
  "email": "user@example.com"
}
```

### Archivo (JSON)
```json
{"timestamp":"2025-11-12T17:30:45.123Z","level":"info","service":"Auth_Service","message":"Usuario autenticado","userId":"123","email":"user@example.com","pid":12345}
```

## 🛡️ Error Handlers

El logger captura automáticamente errores no manejados:

```javascript
const logger = createLogger('Auth_Service')
// Automáticamente registra uncaughtException y unhandledRejection
```

## 🌍 Variables de Entorno

Puedes configurar el nivel de log globalmente:

```bash
# .env
LOG_LEVEL=debug  # Para desarrollo
LOG_LEVEL=info   # Para producción
LOG_LEVEL=error  # Solo errores
```

## 📊 Niveles de Log

| Nivel | Uso | Consola | Archivo |
|-------|-----|---------|---------|
| **debug** | Información detallada de depuración | Gris | ✅ |
| **info** | Información general de operaciones | Cyan | ✅ |
| **warn** | Advertencias que requieren atención | Amarillo | ✅ |
| **error** | Errores críticos | Rojo | ✅ |

## 🔍 Ver Logs

### Logs en tiempo real
```bash
# En consola mientras corre el servicio
npm run dev

# Seguir archivo de log
tail -f logs/Auth_Service-combined-2025-11-12.log
```

### Buscar en logs
```bash
# PowerShell
Get-Content logs\Auth_Service-error-2025-11-12.log | Select-String "error"

# Bash
grep "error" logs/Auth_Service-error-2025-11-12.log
```

### Analizar logs JSON
```bash
# Usando jq (herramienta JSON)
cat logs/Auth_Service-combined-2025-11-12.log | jq 'select(.level=="error")'
```

## 💡 Mejores Prácticas

1. **Usa el nivel apropiado**:
   - `debug` - Información de desarrollo
   - `info` - Eventos importantes
   - `warn` - Situaciones inesperadas pero manejables
   - `error` - Errores que requieren atención

2. **Incluye contexto útil**:
   ```javascript
   // ❌ Mal
   logger.error('Error')
   
   // ✅ Bien
   logger.error('Error al autenticar usuario', {
     email: user.email,
     error: err.message,
     stack: err.stack
   })
   ```

3. **No loguees información sensible**:
   ```javascript
   // ❌ Mal
   logger.info('Login', { password: '123456' })
   
   // ✅ Bien
   logger.info('Login', { email: 'user@example.com' })
   ```

4. **Usa metadata estructurada**:
   ```javascript
   logger.info('Operación completada', {
     operation: 'createUser',
     duration: 250,
     result: 'success'
   })
   ```

## 🧹 Limpieza de Logs

```bash
# Eliminar logs antiguos (PowerShell)
Get-ChildItem logs\*.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item

# Bash
find logs/ -name "*.log" -mtime +7 -delete
```
