import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/envios
 * Obtiene envíos de muestras con filtros opcionales
 */
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0,
      id_conglomerado,
      fecha_desde,
      fecha_hasta
    } = req.query;

    let query = supabase
      .from('envio_muestras')
      .select('*')
      .order('fecha_envio', { ascending: false });

    // Filtros opcionales
    if (id_conglomerado) {
      query = query.eq('id_conglomerado', id_conglomerado);
    }

    if (fecha_desde) {
      query = query.gte('fecha_envio', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.lte('fecha_envio', fecha_hasta);
    }

    // Paginación
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo envíos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo envíos' 
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
    console.error('Error en GET /envios:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/envios/:id
 * Obtiene un envío específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('envio_muestras')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Envío no encontrado' 
        });
      }
      console.error('Error obteniendo envío:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo envío' 
      });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error en GET /envios/:id:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/envios/conglomerado/:codigo
 * Obtiene todos los envíos de un conglomerado específico
 */
router.get('/conglomerado/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    // Obtener ID del conglomerado
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
      .from('envio_muestras')
      .select('*')
      .eq('id_conglomerado', conglomerado.id)
      .order('fecha_envio', { ascending: false });

    if (error) {
      console.error('Error obteniendo envíos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo envíos' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /envios/conglomerado/:codigo:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
