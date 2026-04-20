import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /empleados  — admin ve todos los empleados
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await sb.from('empleados')
    .select('id,nombre,email,cargo,departamento,activo,dias_vacaciones,dias_usados')
    .eq('es_admin', false)
    .eq('activo', true)
    .order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /empleados/me  — datos del empleado autenticado
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await sb.from('empleados')
    .select('id,nombre,email,cargo,departamento,dias_vacaciones,dias_usados')
    .eq('id', req.user.id)
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /empleados  — admin crea empleado (con jornada opcional)
router.post('/', requireAdmin, async (req, res) => {
  const { nombre, email, cargo, departamento, pin, dias_vacaciones = 25, turno_id } = req.body
  if (!nombre || !email || !pin) {
    return res.status(400).json({ error: 'Nombre, email y PIN son obligatorios' })
  }
  if (pin.length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' })
  }
  const hash = await bcrypt.hash(pin, 10)
  const { data, error } = await sb.from('empleados')
    .insert({ nombre, email, cargo, departamento, pin: hash, es_admin: false, rol: 'empleado', activo: true, dias_vacaciones, dias_usados: 0 })
    .select('id,nombre,email,cargo,departamento').single()
  if (error) return res.status(500).json({ error: error.message })
  if (turno_id) {
    await sb.from('empleado_turnos').insert({ empleado_id: data.id, turno_id })
  }
  res.status(201).json(data)
})

// POST /empleados/:id/turnos/:turnoId  — admin asigna jornada a empleado
router.post('/:id/turnos/:turnoId', requireAdmin, async (req, res) => {
  const { error } = await sb.from('empleado_turnos')
    .insert({ empleado_id: req.params.id, turno_id: req.params.turnoId })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// DELETE /empleados/:id/turnos/:turnoId  — admin desasigna jornada de empleado
router.delete('/:id/turnos/:turnoId', requireAdmin, async (req, res) => {
  const { error } = await sb.from('empleado_turnos')
    .delete()
    .eq('empleado_id', req.params.id)
    .eq('turno_id', req.params.turnoId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// DELETE /empleados/:id  — admin desactiva empleado
router.delete('/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
  }
  const { error } = await sb.from('empleados')
    .update({ activo: false })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
