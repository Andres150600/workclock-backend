import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

// POST /fichajes-manuales — empleado solicita corrección
router.post('/', requireAuth, async (req, res) => {
  const { fecha, entrada, salida, motivo } = req.body
  if (!fecha || !entrada || !motivo)
    return res.status(400).json({ error: 'Fecha, entrada y motivo son obligatorios' })
  if (salida && new Date(salida) <= new Date(entrada))
    return res.status(400).json({ error: 'La salida debe ser posterior a la entrada' })

  const { data, error } = await sb.from('fichajes_manuales')
    .insert({ empleado_id: req.user.id, fecha, entrada, salida, motivo, estado: 'pendiente' })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// GET /fichajes-manuales
router.get('/', requireAuth, async (req, res) => {
  let q = sb.from('fichajes_manuales')
    .select('id,fecha,entrada,salida,motivo,estado,created_at,empleados(nombre)')
    .order('created_at', { ascending: false })
  if (!req.user.es_admin) q = q.eq('empleado_id', req.user.id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// PATCH /fichajes-manuales/:id — admin aprueba o rechaza
router.patch('/:id', requireAdmin, async (req, res) => {
  const { estado } = req.body
  if (!['aprobado', 'rechazado'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' })

  const { data: manual } = await sb.from('fichajes_manuales').select('*').eq('id', req.params.id).single()
  if (!manual) return res.status(404).json({ error: 'No encontrado' })

  const { data, error } = await sb.from('fichajes_manuales')
    .update({ estado }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })

  // Si se aprueba, crear o actualizar el fichaje real
  if (estado === 'aprobado') {
    const { data: existing } = await sb.from('fichajes')
      .select('id').eq('empleado_id', manual.empleado_id).eq('fecha', manual.fecha).maybeSingle()
    if (existing) {
      await sb.from('fichajes').update({ entrada: manual.entrada, salida: manual.salida }).eq('id', existing.id)
    } else {
      await sb.from('fichajes').insert({ empleado_id: manual.empleado_id, fecha: manual.fecha, entrada: manual.entrada, salida: manual.salida })
    }
  }

  res.json(data)
})

export default router
