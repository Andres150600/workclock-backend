import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /turnos
// Admin: todas las jornadas + empleados asignados a cada una
// Empleado: solo su jornada asignada (via empleados.turno_id)
router.get('/', requireAuth, async (req, res) => {
  if (req.user.es_admin) {
    const [{ data: ts, error }, { data: emps }] = await Promise.all([
      sb.from('turnos').select('id,nombre,hora_entrada,hora_salida,dias_semana').eq('activo', true).order('created_at', { ascending: false }),
      sb.from('empleados').select('id,nombre,cargo,turno_id').eq('activo', true).eq('es_admin', false).order('nombre')
    ])
    if (error) return res.status(500).json({ error: error.message })
    const result = (ts || []).map(t => ({
      ...t,
      empleados: (emps || []).filter(e => e.turno_id === t.id)
    }))
    return res.json(result)
  }

  // Empleado: busca su turno_id en su perfil
  const { data: emp } = await sb.from('empleados').select('turno_id').eq('id', req.user.id).single()
  if (!emp?.turno_id) return res.json([])
  const { data, error } = await sb.from('turnos')
    .select('id,nombre,hora_entrada,hora_salida,dias_semana')
    .eq('id', emp.turno_id)
    .eq('activo', true)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// POST /turnos  — admin crea jornada plantilla (sin empleado_id)
router.post('/', requireAdmin, async (req, res) => {
  const { nombre, hora_entrada, hora_salida, dias_semana } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre obligatorio' })
  const { data, error } = await sb.from('turnos')
    .insert({ nombre, hora_entrada, hora_salida, dias_semana: dias_semana || [1,2,3,4,5], activo: true })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /turnos/:id  — admin edita jornada
router.patch('/:id', requireAdmin, async (req, res) => {
  const { nombre, hora_entrada, hora_salida, dias_semana } = req.body
  const datos = {}
  if (nombre)      datos.nombre      = nombre
  if (hora_entrada) datos.hora_entrada = hora_entrada
  if (hora_salida)  datos.hora_salida  = hora_salida
  if (dias_semana)  datos.dias_semana  = dias_semana
  const { data, error } = await sb.from('turnos').update(datos).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /turnos/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await sb.from('turnos').update({ activo: false }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
