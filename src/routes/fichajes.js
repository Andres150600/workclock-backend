import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /fichajes  — admin ve todos, empleado ve los suyos
router.get('/', requireAuth, async (req, res) => {
  const { empleado_id, fecha } = req.query
  const page = Math.max(0, parseInt(req.query.page) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))

  let q = sb.from('fichajes')
    .select('id,empleado_id,fecha,entrada,salida,created_at,empleados(nombre)')
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

  if (req.user.es_admin) {
    if (empleado_id) q = q.eq('empleado_id', empleado_id)
    if (fecha) q = q.eq('fecha', fecha)
  } else {
    q = q.eq('empleado_id', req.user.id)
    if (fecha) q = q.eq('fecha', fecha)
  }

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /fichajes  — registrar entrada
router.post('/', requireAuth, async (req, res) => {
  const { fecha, entrada, lat_entrada, lng_entrada } = req.body
  const datos = { empleado_id: req.user.id, fecha, entrada }
  if (lat_entrada != null) { datos.lat_entrada = lat_entrada; datos.lng_entrada = lng_entrada }

  const { data, error } = await sb.from('fichajes').insert(datos).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /fichajes/:id  — registrar salida
router.patch('/:id', requireAuth, async (req, res) => {
  const { salida, lat_salida, lng_salida } = req.body
  if (!salida) return res.status(400).json({ error: 'Falta la hora de salida' })

  // Verificar que salida > entrada
  const { data: existing } = await sb.from('fichajes').select('entrada').eq('id', req.params.id).single()
  if (existing && new Date(salida) <= new Date(existing.entrada)) {
    return res.status(400).json({ error: 'La salida debe ser posterior a la entrada' })
  }

  const datos = { salida }
  if (lat_salida != null) { datos.lat_salida = lat_salida; datos.lng_salida = lng_salida }

  // Un empleado solo puede editar sus propios fichajes
  let q = sb.from('fichajes').update(datos).eq('id', req.params.id)
  if (!req.user.es_admin) q = q.eq('empleado_id', req.user.id)

  const { data, error } = await q.select().single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Fichaje no encontrado' })
  res.json(data)
})

// GET /fichajes/hoy  — fichaje de hoy del usuario actual
router.get('/hoy', requireAuth, async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0]
  const { data } = await sb.from('fichajes')
    .select('id,fecha,entrada,salida')
    .eq('empleado_id', req.user.id)
    .eq('fecha', hoy)
    .maybeSingle()
  res.json(data)
})

export default router
