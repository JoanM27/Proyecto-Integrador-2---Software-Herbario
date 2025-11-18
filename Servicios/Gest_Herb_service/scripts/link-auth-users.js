/**
 * Script para vincular usuarios existentes de Supabase Auth con info_usuario
 * Ejecutar con: node scripts/link-auth-users.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://shofnxgzwqhvdznznfwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNob2ZueGd6d3FodmR6bnpuZndwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTM2NDAzNywiZXhwIjoyMDc0OTQwMDM3fQ.lMnJ0wJeNXVY8bPwj4uWurenTwvH8Opb3ate7FD-Tkw';

const supabase = createClient(supabaseUrl, supabaseKey);

const testUsers = [
  {
    nombre_completo: 'María Rodríguez',
    email: 'maria.rodriguez@ifn.gov.co',
    cedula: '1001234567',
    telefono: '3101234567',
    rol: 'recepcionista'
  },
  {
    nombre_completo: 'Carlos Vargas',
    email: 'carlos.vargas@ifn.gov.co',
    cedula: '1007654321',
    telefono: '3207654321',
    rol: 'laboratorista'
  },
  {
    nombre_completo: 'Administrador Sistema',
    email: 'admin@ifn.gov.co',
    cedula: '1000000001',
    telefono: '3000000001',
    rol: 'admin'
  }
];

async function linkAuthUsers() {
  console.log('🔗 Vinculando usuarios de Auth con info_usuario...\n');

  // Obtener el primer herbario disponible
  const { data: herbarios, error: herbarioError } = await supabase
    .from('herbario')
    .select('id, nombre')
    .limit(1);

  if (herbarioError || !herbarios || herbarios.length === 0) {
    console.error('❌ Error: No se encontró ningún herbario en la base de datos');
    process.exit(1);
  }

  const id_herbario = herbarios[0].id;
  console.log(`📍 Usando herbario: ${herbarios[0].nombre} (ID: ${id_herbario})\n`);

  // Obtener todos los usuarios de Auth
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error obteniendo usuarios de Auth:', authError.message);
    process.exit(1);
  }

  console.log(`📊 Total usuarios en Auth: ${authData.users.length}\n`);

  for (const user of testUsers) {
    try {
      console.log(`👤 Procesando: ${user.nombre_completo} (${user.email})`);

      // Buscar usuario en Auth por email
      const authUser = authData.users.find(u => u.email === user.email);
      
      if (!authUser) {
        console.log(`   ⚠️  Usuario NO encontrado en Auth - saltando\n`);
        continue;
      }

      console.log(`   ✅ Usuario encontrado en Auth (ID: ${authUser.id})`);

      // Verificar si ya existe en info_usuario
      const { data: existingInfo, error: checkError } = await supabase
        .from('info_usuario')
        .select('id_user')
        .eq('id_user', authUser.id)
        .single();

      if (existingInfo) {
        console.log(`   ℹ️  Usuario ya vinculado en info_usuario\n`);
        continue;
      }

      // Verificar si existe con mismo email pero diferente id_user (o null)
      const { data: emailMatch, error: emailError } = await supabase
        .from('info_usuario')
        .select('*')
        .eq('correo_electronico', user.email);

      if (emailMatch && emailMatch.length > 0) {
        console.log(`   🔧 Usuario existe con email pero sin vincular - actualizando...`);
        
        const { error: updateError } = await supabase
          .from('info_usuario')
          .update({
            id_user: authUser.id,
            nombre_completo: user.nombre_completo,
            cedula: user.cedula,
            telefono: user.telefono,
            rol: user.rol,
            id_herbario: id_herbario
          })
          .eq('correo_electronico', user.email);

        if (updateError) {
          console.log(`   ❌ Error actualizando: ${updateError.message}\n`);
        } else {
          console.log(`   ✅ Usuario vinculado exitosamente\n`);
        }
        continue;
      }

      // Crear nuevo registro en info_usuario
      console.log(`   🆕 Creando registro en info_usuario...`);
      
      const { error: insertError } = await supabase
        .from('info_usuario')
        .insert({
          id_user: authUser.id,
          nombre_completo: user.nombre_completo,
          correo_electronico: user.email,
          cedula: user.cedula,
          telefono: user.telefono,
          rol: user.rol,
          id_herbario: id_herbario
        });

      if (insertError) {
        console.log(`   ❌ Error insertando: ${insertError.message}\n`);
      } else {
        console.log(`   ✅ Registro creado exitosamente\n`);
      }

    } catch (error) {
      console.error(`   ❌ Error inesperado: ${error.message}\n`);
    }
  }

  // Verificar resultado final
  console.log('\n📋 Verificando usuarios vinculados...\n');
  
  const { data: finalUsers, error: finalError } = await supabase
    .from('info_usuario')
    .select('id_user, nombre_completo, correo_electronico, rol')
    .in('correo_electronico', testUsers.map(u => u.email));

  if (finalUsers) {
    finalUsers.forEach(u => {
      console.log(`   - ${u.nombre_completo} (${u.correo_electronico}) - Rol: ${u.rol}`);
    });
  }

  console.log('\n✨ Proceso completado\n');
}

linkAuthUsers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
