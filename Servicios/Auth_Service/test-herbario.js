import { supabase } from './src/supabase.js';

async function testHerbario() {
  console.log('\n=== TEST: Tabla Herbario ===\n');
  
  // Test 1: Listar TODOS los herbarios
  const { data: todosHerbarios, error: errorTodos } = await supabase
    .from('herbario')
    .select('*');
  
  console.log('1. TODOS los herbarios en la tabla:');
  console.log('   Cantidad:', todosHerbarios?.length || 0);
  if (todosHerbarios && todosHerbarios.length > 0) {
    todosHerbarios.forEach(h => {
      console.log(`   - ID: ${h.id}, Nombre: ${h.nombre}`);
    });
  }
  console.log('   Error:', errorTodos);
  
  // Test 2: Buscar herbario con id = 7
  const { data: herbario7, error: error7 } = await supabase
    .from('herbario')
    .select('*')
    .eq('id', 7)
    .single();
  
  console.log('\n2. Herbario con id = 7:');
  console.log('   Resultado:', herbario7);
  console.log('   Error:', error7);
  
  // Test 3: Info de María
  const { data: infoUsuario, error: infoError } = await supabase
    .from('info_usuario')
    .select('*')
    .eq('correo_electronico', 'maria.rodriguez@ifn.gov.co')
    .single();
  
  console.log('\n3. Info Usuario María:');
  console.log('   id_herbario:', infoUsuario?.id_herbario);
  console.log('   Error:', infoError);
  
  console.log('\n=== FIN TEST ===\n');
  process.exit(0);
}

testHerbario();
