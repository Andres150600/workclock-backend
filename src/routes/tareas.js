import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /tareas
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await sb.from('tareas')
    .select('*')
    .eq('empleado_id', req.user.id)
    .order('completada', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /tareas
router.post('/', requireAuth, async (req, res) => {
  const { nombre, categoria } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre obligatorio' })
  const { data, error } = await sb.from('tareas')
    .insert({
      nombre,
      categoria: categoria || 'General',
      empleado_id: req.user.id,
      fecha: new Date().toISOString().split('T')[0]
    })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /tareas/:id  — accion: iniciar | parar | completar  (o editar nombre/categoria)
router.patch('/:id', requireAuth, async (req, res) => {
  const { accion, nombre, categoria } = req.body

  const { data: t } = await sb.from('tareas')
    .select('id,empleado_id,inicio,duracion_ms')
    .eq('id', req.params.id).single()
  if (!t || t.empleado_id !== req.user.id)
    return res.status(403).json({ error: 'Sin acceso' })

  let update = {}
  if (accion === 'iniciar') {
    update = { inicio: new Date().toISOString() }
  } else if (accion === 'parar') {
    const added = t.inicio ? Date.now() - new Date(t.inicio).getTime() : 0
    update = { inicio: null, duracion_ms: (t.duracion_ms || 0) + added }
  } else if (accion === 'completar') {
    const added = t.inicio ? Date.now() - new Date(t.inicio).getTime() : 0
    update = { completada: true, inicio: null, duracion_ms: (t.duracion_ms || 0) + added }
  } else {
    if (nombre !== undefined) update.nombre = nombre
    if (categoria !== undefined) update.categoria = categoria
  }

  const { data, error } = await sb.from('tareas')
    .update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /tareas/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: t } = await sb.from('tareas')
    .select('empleado_id').eq('id', req.params.id).single()
  if (!t || t.empleado_id !== req.user.id)
    return res.status(403).json({ error: 'Sin acceso' })
  const { error } = await sb.from('tareas').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
