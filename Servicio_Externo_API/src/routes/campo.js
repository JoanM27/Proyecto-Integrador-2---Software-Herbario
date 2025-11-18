import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/campo/coberturas/:codigo
 * Obtiene coberturas y alteraciones de un conglomerado
 */
router.get('/coberturas/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('coberturas_alteraciones')
      .select('*')
      .eq('id_conglomerado_txt', codigo)
      .order('subparcela', { ascending: true });

    if (error) {
      console.error('Error obteniendo coberturas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo coberturas' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /campo/coberturas:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/campo/inclinacion/:codigo
 * Obtiene inclinaciones y pendientes de un conglomerado
 */
router.get('/inclinacion/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { subparcela } = req.query;

    let query = supabase
      .from('inclinacion_pendiente')
      .select('*')
      .eq('id_conglomerado_txt', codigo);

    if (subparcela) {
      query = query.eq('subparcela', parseInt(subparcela));
    }

    query = query.order('subparcela', { ascending: true })
                 .order('punto_pendiente', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo inclinaciones:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo inclinaciones' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /campo/inclinacion:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/campo/esquema/:codigo
 * Obtiene el esquema del conglomerado
 */
router.get('/esquema/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const { data, error } = await supabase
      .from('esquema_conglomerado')
      .select('*')
      .eq('id_conglomerado_txt', codigo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'Esquema no encontrado' 
        });
      }
      console.error('Error obteniendo esquema:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo esquema' 
      });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error en GET /campo/esquema:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/campo/puntos-subparcela/:codigo
 * Obtiene puntos de referencia de subparcelas
 */
router.get('/puntos-subparcela/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { subparcela } = req.query;

    let query = supabase
      .from('puntos_referencia_subparcela')
      .select('*')
      .eq('id_conglomerado_txt', codigo);

    if (subparcela) {
      query = query.eq('subparcela', parseInt(subparcela));
    }

    query = query.order('subparcela', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo puntos de referencia:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo puntos de referencia' 
      });
    }

    res.json({ success: true, data, total: data.length });

  } catch (error) {
    console.error('Error en GET /campo/puntos-subparcela:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
