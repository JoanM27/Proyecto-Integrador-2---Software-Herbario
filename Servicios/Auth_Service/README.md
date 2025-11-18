# Auth_Service — Servicio de Autenticación

Servicio responsable de registro y login de usuarios y de la emisión de tokens JWT para la arquitectura SOA de IDEAM.

## Resumen de lo implementado

- Stack: Node.js (ESM), Express, jose (JWT), argon2 (hash de contraseñas), helmet, rate limiting.
- Endpoints iniciales:
  - POST `/auth/register`: registro en memoria con hash Argon2id.
  - POST `/auth/login`: verificación de contraseña y emisión de JWT firmado (ES256 por defecto).
  - GET `/health`: healthcheck.
- Seguridad:
  - Hash de contraseñas con Argon2id.
  - JWT firmado con clave privada (ES256/RS256 vía jose).
- Configuración ESM en `package.json` (`"type": "module"`).
- Script para generar par de claves (`scripts/gen-keys.js`).

> Nota: Por ahora el almacenamiento de usuarios es en memoria para demostración. En producción reemplazar por base de datos (por ejemplo, Supabase/Postgres) y aplicar RLS/cifrado por columna según sea necesario.

---

## Estructura de carpetas

```
Auth_Service/
├── src/
│   └── app.js            # App Express con /auth/register, /auth/login, /health
├── scripts/
│   └── gen-keys.js       # Genera par de claves (privada/pública) para JWT
├── .env.example          # Variables de entorno de ejemplo
├── package.json          # Dependencias y scripts (ESM habilitado)
└── README.md             # Este documento
```

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```
PORT=3001
JWT_ALG=ES256
# Clave privada PKCS8 para firmar JWT (no la comprometas)
JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- `JWT_ALG`: Algoritmo de firma (`ES256` recomendado; alternativamente `RS256`).
- `JWT_PRIVATE_KEY_PEM`: Clave privada en formato PKCS8 (PEM) para `jose`.

### Generar claves (opcional)
Puedes generar un par de claves válido con el script incluido:

```powershell
cd "C:\Users\joan-\Downloads\IDEAM\Proyecto\Servicios\Auth_Service"
npm run keys
```

El script imprime en consola la clave privada (PKCS8 PEM) y la clave pública (SPKI PEM). Copia:
- La privada en `JWT_PRIVATE_KEY_PEM` de este servicio.
- La pública en el `.env` del `Api_Gateway` (`JWT_PUBLIC_KEY_PEM`) u otros servicios que validen JWT.

---

## Instalación y ejecución

```powershell
cd "C:\Users\joan-\Downloads\IDEAM\Proyecto\Servicios\Auth_Service"
# Instalar dependencias (ya ejecutado previamente)
npm install
# Ejecutar en modo normal
npm run start
# o en modo desarrollo
npm run dev
```

El servicio escuchará en `http://localhost:3001` (o el puerto definido en `PORT`).

---

## Endpoints

### POST /auth/register
Registra un usuario (almacenamiento en memoria por ahora) y guarda la contraseña con Argon2id.

- Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "Secreta123"
}
```
- Respuesta 201:
```json
{ "ok": true }
```

Ejemplo PowerShell:
```powershell
$body = @{ email="user@example.com"; password="Secreta123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/register -ContentType "application/json" -Body $body
```

### POST /auth/login
Verifica la contraseña y devuelve un JWT firmado.

- Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "Secreta123"
}
```
- Respuesta 200:
```json
{
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

Ejemplo PowerShell:
```powershell
$body = @{ email="user@example.com"; password="Secreta123" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -ContentType "application/json" -Body $body
$token = $login.access_token
$token
```

### GET /health
Devuelve un estado simple del servicio.

```powershell
Invoke-RestMethod -Uri http://localhost:3001/health
```

---

## JWT y verificación aguas abajo
- Este servicio emite JWT con `issuer=ideam` y `audience=ideam-services`.
- El `Api_Gateway` debe verificar el JWT con la clave pública mediante `Servicios/shared/crypto/jwt.js`.
- Configura en el gateway `.env`:
  - `JWT_PUBLIC_KEY_PEM` con la clave pública correspondiente a `JWT_PRIVATE_KEY_PEM`.
  - `JWT_ALG` igual al usado aquí.

---

## Seguridad y consideraciones
- Sustituir almacenamiento en memoria por base de datos con RLS.
- No registrar tokens ni contraseñas en logs.
- Rotación de claves: planificar JWKS o versiones de clave.
- Tiempos de expiración cortos para access tokens y uso de refresh tokens (pendiente de implementar).

---

## Próximos pasos sugeridos
- Persistencia real de usuarios (Supabase/Postgres).
- Endpoint JWKS (`/.well-known/jwks.json`) para publicar la clave pública y facilitar rotación.
- Implementar refresh tokens y revocación.
- Pruebas unitarias e integración (login y emisión/validación de JWT).
