import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /documentos  — empleado ve solo los suyos
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await sb.from('documentos')
    .select('id,nombre,tipo,descripcion,created_at')
    .eq('empleado_id', req.user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

export default router
