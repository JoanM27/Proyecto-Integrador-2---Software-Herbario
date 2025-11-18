/**
 * Script para crear usuarios de prueba en el sistema
 * Ejecutar con: node scripts/seed-users.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://shofnxgzwqhvdznznfwp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNob2ZueGd6d3FodmR6bnpuZndwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTM2NDAzNywiZXhwIjoyMDc0OTQwMDM3fQ.lMnJ0wJeNXVY8bPwj4uWurenTwvH8Opb3ate7FD-Tkw';

const supabase = createClient(supabaseUrl, supabaseKey);

const testUsers = [
  {
    nombre_completo: 'María Rodríguez',
    email: 'maria.rodriguez@ifn.gov.co',
    password: 'password123',
    cedula: '1001234567',
    telefono: '3101234567',
    rol: 'recepcionista'
  },
  {
    nombre_completo: 'Carlos Vargas',
    email: 'carlos.vargas@ifn.gov.co',
    password: 'password123',
    cedula: '1007654321',
    telefono: '3207654321',
    rol: 'laboratorista'
  },
  {
    nombre_completo: 'Administrador Sistema',
    email: 'admin@ifn.gov.co',
    password: 'admin123',
    cedula: '1000000001',
    telefono: '3000000001',
    rol: 'admin'
  }
];

async function seedUsers() {
  console.log('🌱 Iniciando creación de usuarios de prueba...\n');

  // Primero, obtener el primer herbario disponible
  const { data: herbarios, error: herbarioError } = await supabase
    .from('herbario')
    .select('id, nombre')
    .limit(1);

  if (herbarioError || !herbarios || herbarios.length === 0) {
    console.error('❌ Error: No se encontró ningún herbario en la base de datos');
    console.log('   Debes crear al menos un herbario antes de crear usuarios');
    process.exit(1);
  }

  const id_herbario = herbarios[0].id;
  console.log(`📍 Usando herbario: ${herbarios[0].nombre} (ID: ${id_herbario})\n`);

  for (const user of testUsers) {
    try {
      console.log(`👤 Creando usuario: ${user.nombre_completo} (${user.email})`);

      // 1. Verificar si ya existe en info_usuario
      const { data: existingUser } = await supabase
        .from('info_usuario')
        .select('id_user, correo_electronico')
        .eq('correo_electronico', user.email)
        .single();

      if (existingUser) {
        console.log(`   ⚠️  Usuario ya existe en info_usuario (ID: ${existingUser.id_user})`);
        
        // Verificar si existe en Auth
        const { data: authData } = await supabase.auth.admin.listUsers();
        const authUser = authData.users.find(u => u.email === user.email);
        
        if (!authUser) {
          console.log(`   🔧 Creando usuario en Supabase Auth...`);
          const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true
          });

          if (authError) {
            console.log(`   ❌ Error creando en Auth: ${authError.message}`);
          } else {
            // Actualizar id_user en info_usuario
            await supabase
              .from('info_usuario')
              .update({ id_user: newAuthUser.user.id })
              .eq('correo_electronico', user.email);
            console.log(`   ✅ Usuario creado en Auth y vinculado`);
          }
        } else {
          console.log(`   ℹ️  Usuario ya existe en Auth`);
        }
        
        continue;
      }

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });

      if (authError) {
        console.log(`   ❌ Error en Auth: ${authError.message}`);
        continue;
      }

      console.log(`   ✅ Usuario creado en Supabase Auth (ID: ${authData.user.id})`);

      // 3. Crear registro en info_usuario
      const { data: infoData, error: infoError } = await supabase
        .from('info_usuario')
        .insert({
          id_user: authData.user.id,
          nombre_completo: user.nombre_completo,
          correo_electronico: user.email,
          cedula: user.cedula,
          telefono: user.telefono,
          rol: user.rol,
          id_herbario: id_herbario
        })
        .select()
        .single();

      if (infoError) {
        console.log(`   ❌ Error en info_usuario: ${infoError.message}`);
        // Intentar eliminar el usuario de Auth si falló info_usuario
        await supabase.auth.admin.deleteUser(authData.user.id);
        continue;
      }

      console.log(`   ✅ Registro creado en info_usuario`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: ${user.password}`);
      console.log(`   👔 Rol: ${user.rol}\n`);

    } catch (error) {
      console.error(`   ❌ Error inesperado: ${error.message}\n`);
    }
  }

  console.log('✨ Proceso completado\n');
  console.log('📝 Credenciales de acceso:');
  console.log('─────────────────────────────────────────────');
  console.log('Recepcionista:');
  console.log('  📧 maria.rodriguez@ifn.gov.co');
  console.log('  🔑 password123\n');
  console.log('Laboratorista:');
  console.log('  📧 carlos.vargas@ifn.gov.co');
  console.log('  🔑 password123\n');
  console.log('Administrador:');
  console.log('  📧 admin@ifn.gov.co');
  console.log('  🔑 admin123\n');
}

seedUsers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
