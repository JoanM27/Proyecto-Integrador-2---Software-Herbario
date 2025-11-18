/**
 * Script para inicializar usuarios de prueba en el sistema
 * Ejecutar: node scripts/init-users.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Usuarios de prueba
const testUsers = [
  {
    email: 'maria.rodriguez@ideam.gov.co',
    password: 'password123',
    nombres: 'María',
    apellidos: 'Rodríguez',
    rol: 'recepcionista',
    herbario_id: 1
  },
  {
    email: 'carlos.vargas@ideam.gov.co',
    password: 'password123',
    nombres: 'Carlos',
    apellidos: 'Vargas',
    rol: 'laboratorista',
    herbario_id: 1
  },
  {
    email: 'admin@ideam.gov.co',
    password: 'admin123',
    nombres: 'Administrador',
    apellidos: 'Sistema',
    rol: 'admin',
    herbario_id: 1
  }
]

async function initUsers() {
  console.log('🔧 Iniciando creación de usuarios de prueba...\n')

  for (const user of testUsers) {
    try {
      console.log(`📝 Creando usuario: ${user.email}`)
      
      // Crear usuario en auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          nombres: user.nombres,
          apellidos: user.apellidos,
          rol: user.rol
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  Usuario ya existe: ${user.email}`)
          continue
        }
        console.error(`   ❌ Error creando usuario: ${authError.message}`)
        continue
      }

      console.log(`   ✅ Usuario creado exitosamente: ${user.email}`)
      console.log(`      ID: ${authData.user.id}`)
      console.log(`      Rol: ${user.rol}\n`)

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`)
    }
  }

  console.log('✨ Proceso completado!\n')
  console.log('📋 Credenciales de prueba:')
  console.log('   Recepcionista: maria.rodriguez@ideam.gov.co / password123')
  console.log('   Laboratorista: carlos.vargas@ideam.gov.co / password123')
  console.log('   Administrador: admin@ideam.gov.co / admin123\n')
}

initUsers().catch(console.error)
