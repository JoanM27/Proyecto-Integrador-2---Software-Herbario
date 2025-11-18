# Auth_Service - Servicio de Autenticación

Servicio de autenticación y autorización basado en JWT para el Sistema de Herbario Digital.

## 📋 Descripción

Auth_Service maneja toda la lógica de autenticación, generación de tokens JWT, refresh tokens y validación de credenciales de usuarios.

## 🔌 Puerto

**3001** (configurable via `.env`)

## 🎯 Responsabilidades

- ✅ Autenticación de usuarios (login)
- ✅ Generación de access tokens (JWT)
- ✅ Generación de refresh tokens
- ✅ Renovación de tokens (refresh)
- ✅ Validación de tokens
- ✅ Cierre de sesión (logout)
- ✅ Rotación de claves JWT

## 🛠️ Tecnologías

- Node.js v22.18.0
- Express.js
- Supabase (PostgreSQL)
- bcrypt (hash de passwords)
- jsonwebtoken (JWT)
- dotenv (variables de entorno)
- Shared crypto module (AES-GCM, HMAC)

## 📁 Estructura

```
Auth_Service/
├── src/
│   ├── app.js          # Aplicación principal
│   ├── keys.js         # Gestión de claves JWT
│   └── supabase.js     # Cliente Supabase
├── scripts/
│   └── gen-keys.js     # Script para generar claves
├── .env                # Variables de entorno (no en repo)
├── package.json
└── README.md
```

## 🚀 Instalación

```bash
cd Servicios/Auth_Service
npm install
```

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Port (opcional)
PORT=3001
```

### Generar Claves JWT

```bash
node scripts/gen-keys.js
```

Este script genera claves RSA y las almacena de forma segura.

## ▶️ Ejecución

### Desarrollo

```bash
npm start
```

### Producción

```bash
NODE_ENV=production npm start
```

## 📡 API Endpoints

### 1. Login

Autentica un usuario y devuelve access token + refresh token.

**Endpoint**: `POST /api/auth/login`

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response Success** (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nombre": "Juan Pérez",
      "rol": "recepcion",
      "herbario_id": "uuid"
    }
  }
}
```

**Response Error** (401):
```json
{
  "success": false,
  "error": "Credenciales inválidas"
}
```

### 2. Refresh Token

Renueva el access token usando un refresh token válido.

**Endpoint**: `POST /api/auth/refresh`

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response Success** (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error** (401):
```json
{
  "success": false,
  "error": "Refresh token inválido o expirado"
}
```

### 3. Logout

Invalida el refresh token del usuario.

**Endpoint**: `POST /api/auth/logout`

**Headers**:
```
Authorization: Bearer <access_token>
```

**Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response Success** (200):
```json
{
  "success": true,
  "message": "Logout exitoso"
}
```

### 4. Validate Token

Valida un access token y devuelve los datos del usuario.

**Endpoint**: `GET /api/auth/validate`

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response Success** (200):
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "rol": "recepcion",
    "herbarioId": "uuid"
  }
}
```

**Response Error** (401):
```json
{
  "success": false,
  "error": "Token inválido o expirado"
}
```

### 5. Rotate Keys (Admin Only)

Rota las claves JWT por razones de seguridad.

**Endpoint**: `POST /api/auth/rotate-keys`

**Headers**:
```
Authorization: Bearer <access_token>
```

**Note**: Solo usuarios con rol `admin` pueden ejecutar esta acción.

**Response Success** (200):
```json
{
  "success": true,
  "message": "Claves rotadas exitosamente"
}
```

**Response Error** (403):
```json
{
  "success": false,
  "error": "No autorizado - Solo admins"
}
```

## 🔐 Seguridad

### Password Hashing

Las contraseñas se almacenan usando bcrypt con salt rounds = 10.

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
```

### JWT Tokens

**Access Token**:
- Expiración: 1 hora (configurable)
- Contiene: userId, email, rol, herbarioId
- Firmado con JWT_SECRET

**Refresh Token**:
- Expiración: 7 días (configurable)
- Almacenado en base de datos
- Puede ser revocado

### Validación

- Todos los endpoints excepto `/login` requieren JWT válido
- Los tokens expirados retornan 401
- Los refresh tokens pueden ser revocados en logout

## 📊 Base de Datos

### Tabla: `usuarios`

```sql
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'recepcion', 'laboratorio')),
    herbario_id UUID REFERENCES herbarios(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🧪 Testing

### Test Manual con cURL

**Login**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@herbario.com",
    "password": "admin123"
  }'
```

**Validate**:
```bash
curl -X GET http://localhost:3001/api/auth/validate \
  -H "Authorization: Bearer <your_access_token>"
```

**Refresh**:
```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your_refresh_token>"
  }'
```

## 📝 Logging

El servicio utiliza el sistema de logging compartido:

```javascript
const logger = createLogger('Auth_Service');

logger.info('Usuario autenticado', { userId, email });
logger.error('Error en login', { error, email });
```

Formato de logs:
```json
{
  "timestamp": "2025-11-13T13:34:36.414Z",
  "level": "INFO",
  "service": "Auth_Service",
  "message": "Usuario autenticado",
  "metadata": {
    "userId": "uuid",
    "email": "user@example.com"
  }
}
```

## 🐛 Troubleshooting

### Error: "JWT_SECRET not found"

**Causa**: Variable de entorno JWT_SECRET no está configurada.

**Solución**: Verifica que `.env` existe y contiene `JWT_SECRET`.

### Error: "Cannot connect to Supabase"

**Causa**: Credenciales de Supabase inválidas o red no disponible.

**Solución**: 
1. Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
2. Verifica conectividad a internet
3. Verifica que el proyecto Supabase está activo

### Error: "bcrypt error"

**Causa**: Versión de Node.js incompatible con bcrypt nativo.

**Solución**: 
```bash
npm rebuild bcrypt
```

## 🔄 Flujo de Autenticación

```
┌──────────┐                                   ┌──────────────┐
│  Client  │                                   │ Auth_Service │
└────┬─────┘                                   └──────┬───────┘
     │                                                 │
     │  POST /api/auth/login                          │
     │  { email, password }                           │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                          Verify password (bcrypt)
     │                          Generate access token │
     │                          Generate refresh token │
     │                          Store refresh token    │
     │                                                 │
     │  { accessToken, refreshToken, user }           │
     <────────────────────────────────────────────────┤
     │                                                 │
     │  GET /api/some-protected-endpoint              │
     │  Authorization: Bearer <accessToken>           │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                          Verify JWT            │
     │                                                 │
     │  { data }                                      │
     <────────────────────────────────────────────────┤
     │                                                 │
     │  (Access token expires)                        │
     │                                                 │
     │  POST /api/auth/refresh                        │
     │  { refreshToken }                              │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                          Verify refresh token  │
     │                          Generate new access   │
     │                                                 │
     │  { accessToken }                               │
     <────────────────────────────────────────────────┤
     │                                                 │
```

## 📚 Referencias

- [JWT.io](https://jwt.io/) - Debugger y documentación de JWT
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [Express.js](https://expressjs.com/) - Web framework
- [Supabase Docs](https://supabase.com/docs) - Base de datos

---

**Versión**: 1.0.0  
**Última actualización**: Noviembre 2025
