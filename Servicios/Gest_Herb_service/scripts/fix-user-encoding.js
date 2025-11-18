/**
 * Script para corregir la codificación de caracteres de los usuarios de prueba
 * Ejecutar con: node scripts/fix-user-encoding.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://shofnxgzwqhvdznznfwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNob2ZueGd6d3FodmR6bnpuZndwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTM2NDAzNywiZXhwIjoyMDc0OTQwMDM3fQ.lMnJ0wJeNXVY8bPwj4uWurenTwvH8Opb3ate7FD-Tkw';

const supabase = createClient(supabaseUrl, supabaseKey);

const usuarios = [
  {
    email: 'maria.rodriguez@ifn.gov.co',
    nombre_completo: 'María Rodríguez'
  },
  {
    email: 'carlos.vargas@ifn.gov.co',
    nombre_completo: 'Carlos Vargas'
  },
  {
    email: 'admin@ifn.gov.co',
    nombre_completo: 'Administrador Sistema'
  }
];

async function fixEncoding() {
  console.log('🔧 Corrigiendo codificación de caracteres...\n');

  for (const usuario of usuarios) {
    try {
      console.log(`👤 Actualizando: ${usuario.nombre_completo} (${usuario.email})`);

      const { data, error } = await supabase
        .from('info_usuario')
        .update({ nombre_completo: usuario.nombre_completo })
        .eq('correo_electronico', usuario.email)
        .select();

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`   ✅ Actualizado correctamente`);
      } else {
        console.log(`   ⚠️  No se encontró el usuario`);
      }

    } catch (error) {
      console.error(`   ❌ Error inesperado: ${error.message}`);
    }
  }

  console.log('\n✨ Proceso completado\n');
  
  // Verificar resultado
  console.log('📋 Verificando usuarios actualizados...\n');
  
  const { data: finalUsers } = await supabase
    .from('info_usuario')
    .select('nombre_completo, correo_electronico')
    .in('correo_electronico', usuarios.map(u => u.email));

  if (finalUsers) {
    finalUsers.forEach(u => {
      console.log(`   - ${u.nombre_completo} (${u.correo_electronico})`);
    });
  }
  
  console.log('');
}

fixEncoding()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
