import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/colecciones
 * Obtiene colecciones botánicas con filtros opcionales
 */
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      id_conglomerado, 
      fecha_desde,
      fecha_hasta,
      colector
    } = req.query;

    let query = supabase
      .from('coleccion_botanica')
      .select('*')
      .order('created_at', { ascending: false });

    // Filtros opcionales
    if (id_conglomerado) {
      query = query.eq('id_conglomerado', id_conglomerado);
    }

    if (fecha_desde) {
      query = query.gte('fecha', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.lte('fecha', fecha_hasta);
    }

    if (colector) {
      query = query.ilike('colector_numero_coleccion', `%${colector}%`);
    }

    // Paginación
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo colecciones:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo colecciones botánicas' 
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
    console.error('Error en GET /colecciones:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/colecciones/:id
 * Obtiene una colección específica por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('coleccion_botanica')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Colección no encontrada' 
        });
      }
      console.error('Error obteniendo colección:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo colección' 
      });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error en GET /colecciones/:id:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/colecciones/conglomerado/:codigo
 * Obtiene todas las colecciones de un conglomerado específico
 */
router.get('/conglomerado/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    // Primero obtener el ID del conglomerado
    const { data: conglomerado, error: errorCong } = await supabase
      .from('conglomerado')
      .select('id')
      .eq('codigo', codigo)
      .single();

    if (errorCong || !conglomerado) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conglomerado no encontrado' 
      });
    }

    const { data, error } = await supabase
      .from('coleccion_botanica')
      .select('*')
      .eq('id_conglomerado', conglomerado.id)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error obteniendo colecciones:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo colecciones' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /colecciones/conglomerado/:codigo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
