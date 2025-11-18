import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/conglomerados
 * Obtiene todos los conglomerados con información completa (incluye municipio y departamento)
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, codigo } = req.query;

    let query = supabase
      .from('conglomerado')
      .select(`
        id,
        codigo,
        id_municipio,
        latitud_dec,
        longitud_dec,
        municipio(
          id,
          nombre,
          departamento_id,
          departamento:departamento_id(
            id,
            nombre
          )
        )
      `)
      .order('codigo', { ascending: true });

    // Filtro por código si se proporciona
    if (codigo) {
      query = query.ilike('codigo', `%${codigo}%`);
    }

    // Paginación
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error obteniendo conglomerados:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo conglomerados' 
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: data.length
      }
    });

  } catch (error) {
    console.error('Error en GET /conglomerados:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/conglomerados/:codigo
 * Obtiene información detallada de un conglomerado específico (incluye municipio y departamento)
 */
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('conglomerado')
      .select(`
        id,
        codigo,
        id_municipio,
        latitud_dec,
        longitud_dec,
        municipio(
          id,
          nombre,
          departamento_id,
          departamento:departamento_id(
            id,
            nombre
          )
        )
      `)
      .eq('codigo', codigo)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Conglomerado no encontrado' 
        });
      }
      console.error('Error obteniendo conglomerado:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo conglomerado' 
      });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error en GET /conglomerados/:codigo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/conglomerados/:codigo/subparcelas
 * Obtiene todas las subparcelas de un conglomerado
 */
router.get('/:codigo/subparcelas', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('subparcelas')
      .select('*')
      .eq('id_conglomerado_txt', codigo)
      .order('subparcela', { ascending: true });

    if (error) {
      console.error('Error obteniendo subparcelas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo subparcelas' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /conglomerados/:codigo/subparcelas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/conglomerados/:codigo/ruta
 * Obtiene información de ruta de acceso a un conglomerado
 */
router.get('/:codigo/ruta', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('ruta_conglomerado')
      .select('*')
      .eq('id_conglomerado_txt', codigo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Ruta no encontrada para este conglomerado' 
        });
      }
      console.error('Error obteniendo ruta:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo ruta' 
      });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error en GET /conglomerados/:codigo/ruta:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/conglomerados/:codigo/puntos-referencia
 * Obtiene puntos de referencia de ruta de un conglomerado
 */
router.get('/:codigo/puntos-referencia', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('puntos_referencia_ruta')
      .select('*')
      .eq('id_conglomerado_txt', codigo)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error obteniendo puntos de referencia:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo puntos de referencia' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /conglomerados/:codigo/puntos-referencia:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
