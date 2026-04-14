import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /turnos
router.get('/', requireAuth, async (req, res) => {
  let q = sb.from('turnos')
    .select('id,nombre,hora_entrada,hora_salida,dias_semana,empleados(nombre)')
    .eq('activo', true)
    .order('created_at', { ascending: false })
  if (!req.user.es_admin) q = q.eq('empleado_id', req.user.id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /turnos  — admin crea turno
router.post('/', requireAdmin, async (req, res) => {
  const { nombre, empleado_id, hora_entrada, hora_salida, dias_semana } = req.body
  if (!nombre || !empleado_id) {
    return res.status(400).json({ error: 'Nombre y empleado son obligatorios' })
  }
  const { data, error } = await sb.from('turnos')
    .insert({ nombre, empleado_id, hora_entrada, hora_salida, dias_semana, activo: true })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// DELETE /turnos/:id  — admin elimina turno
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await sb.from('turnos')
    .update({ activo: false })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
