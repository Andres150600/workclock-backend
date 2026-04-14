import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /empleados  — admin ve todos con su turno asignado
router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await sb.from('empleados')
    .select('id,nombre,email,cargo,departamento,activo,dias_vacaciones,dias_usados,turno_id')
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

// POST /empleados  — admin crea empleado
router.post('/', requireAdmin, async (req, res) => {
  const { nombre, email, cargo, departamento, pin, dias_vacaciones = 22 } = req.body
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
  res.status(201).json(data)
})

// PATCH /empleados/:id/turno  — admin asigna jornada a empleado
router.patch('/:id/turno', requireAdmin, async (req, res) => {
  const { turno_id } = req.body
  const { data, error } = await sb.from('empleados')
    .update({ turno_id: turno_id || null })
    .eq('id', req.params.id)
    .select('id,nombre,turno_id').single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
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
