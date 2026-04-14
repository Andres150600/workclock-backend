import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /festivos?anio=2026
router.get('/', requireAuth, async (req, res) => {
  const anio  = parseInt(req.query.anio) || new Date().getFullYear()
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-31`
  const { data, error } = await sb.from('festivos')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /festivos  — admin crea festivo
router.post('/', requireAdmin, async (req, res) => {
  const { fecha, nombre, tipo = 'empresa' } = req.body
  if (!fecha || !nombre) return res.status(400).json({ error: 'Fecha y nombre son obligatorios' })
  const { data, error } = await sb.from('festivos')
    .insert({ fecha, nombre, tipo })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// DELETE /festivos/:id  — admin elimina festivo
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await sb.from('festivos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
