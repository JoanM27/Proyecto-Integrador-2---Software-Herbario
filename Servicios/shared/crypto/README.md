# shared/crypto — Utilitarios de cifrado para IDEAM

Conjunto de utilitarios comunes de seguridad para los servicios: hash de contraseñas, cifrado AES-GCM, firmas HMAC y JWT.

## Módulos
- `password.js`: Argon2id para hash/verificación de contraseñas.
- `aesgcm.js`: AES-256-GCM para cifrado simétrico con autenticación (IV.tag incluidos en el payload `iv.ct.tag`).
- `hmac.js`: HMAC-SHA-256 para autenticidad/integridad de mensajes (webhooks, eventos, etc.).
- `jwt.js`: Verificación de JWT con jose; soporta JWKS remoto (`AUTH_JWKS_URL`) y PEM local (`JWT_PUBLIC_KEY_PEM`).
- `index.js`: re-exporta todo.

## Variables de entorno
- `JWT_ALG` (ES256/RS256)
- `AUTH_JWKS_URL` (opcional, recomendado)
- `JWT_PUBLIC_KEY_PEM` (opcional si no usas JWKS)

## Ejemplos

### Hash de contraseñas
```js
import { hashPassword, verifyPassword } from './password.js';
const hash = await hashPassword('Secreta123');
const ok = await verifyPassword(hash, 'Secreta123');
```

### Cifrado AES-GCM
```js
import { encrypt, decrypt } from './aesgcm.js';
const keyB64 = process.env.ENC_KEY_AES_B64; // 32 bytes base64
const ct = encrypt('hola mundo', keyB64);
const pt = decrypt(ct, keyB64);
```

### HMAC
```js
import { signMessage, verifyMessage } from './hmac.js';
const sig = signMessage('payload', process.env.HMAC_KEY_B64);
const valid = verifyMessage('payload', sig, process.env.HMAC_KEY_B64);
```

### Verificación JWT
```js
import { verifyAccessToken } from './jwt.js';
const { payload } = await verifyAccessToken(token); // valida con JWKS o PEM
```

## Notas
- No reutilices IV con la misma clave en AES-GCM.
- Separa claves por propósito (JWT, AES, HMAC) y por entorno.
- Preferir JWKS para rotación de claves del Auth_Service.
