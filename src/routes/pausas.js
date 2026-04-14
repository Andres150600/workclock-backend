import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /pausas — iniciar pausa
router.post('/', requireAuth, async (req, res) => {
  const { fichaje_id, tipo = 'Otra' } = req.body
  if (!fichaje_id) return res.status(400).json({ error: 'Falta fichaje_id' })

  // Verificar que el fichaje pertenece al usuario
  const { data: fich } = await sb.from('fichajes').select('id,empleado_id').eq('id', fichaje_id).single()
  if (!fich || (!req.user.es_admin && fich.empleado_id !== req.user.id))
    return res.status(403).json({ error: 'No autorizado' })

  // Verificar que no hay pausa activa
  const { data: activa } = await sb.from('pausas').select('id').eq('fichaje_id', fichaje_id).is('fin', null).maybeSingle()
  if (activa) return res.status(400).json({ error: 'Ya hay una pausa activa' })

  const { data, error } = await sb.from('pausas')
    .insert({ fichaje_id, inicio: new Date().toISOString(), tipo })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /pausas/:id — terminar pausa
router.patch('/:id', requireAuth, async (req, res) => {
  const { data: pausa } = await sb.from('pausas')
    .select('id,fichajes(empleado_id)')
    .eq('id', req.params.id).single()
  if (!pausa) return res.status(404).json({ error: 'Pausa no encontrada' })
  if (!req.user.es_admin && pausa.fichajes?.empleado_id !== req.user.id)
    return res.status(403).json({ error: 'No autorizado' })

  const { data, error } = await sb.from('pausas')
    .update({ fin: new Date().toISOString() })
    .eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /pausas?fichaje_id=...
router.get('/', requireAuth, async (req, res) => {
  const { fichaje_id } = req.query
  if (!fichaje_id) return res.status(400).json({ error: 'Falta fichaje_id' })
  const { data, error } = await sb.from('pausas').select('*').eq('fichaje_id', fichaje_id).order('inicio')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

export default router
