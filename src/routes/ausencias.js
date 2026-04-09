import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /ausencias  — soporta ?estado=aprobada&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/', requireAuth, async (req, res) => {
  const { estado, desde, hasta } = req.query
  let q = sb.from('ausencias')
    .select('id,tipo,desde,hasta,motivo,estado,created_at,empleados(nombre)')
    .order('created_at', { ascending: false })

  if (!req.user.es_admin) {
    q = q.eq('empleado_id', req.user.id)
  }
  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('desde', desde)
  if (hasta) q = q.lte('hasta', hasta)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /ausencias  — empleado solicita ausencia
router.post('/', requireAuth, async (req, res) => {
  const { tipo, desde, hasta, motivo } = req.body
  if (!tipo || !desde || !hasta || !motivo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }
  const { data, error } = await sb.from('ausencias')
    .insert({ empleado_id: req.user.id, tipo, desde, hasta, motivo, estado: 'pendiente' })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /ausencias/:id  — admin aprueba o rechaza
router.patch('/:id', requireAdmin, async (req, res) => {
  const { estado } = req.body
  if (!['aprobada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' })
  }
  const { data, error } = await sb.from('ausencias')
    .update({ estado })
    .eq('id', req.params.id)
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Ausencia no encontrada' })
  res.json(data)
})

export default router
