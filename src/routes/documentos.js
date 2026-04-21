import { Router } from 'express'
import multer from 'multer'
import { sb } from '../config/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// GET /documentos  — empleado ve solo los suyos
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await sb.from('documentos')
    .select('id,nombre,tipo,descripcion,url,created_at')
    .eq('empleado_id', req.user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// GET /documentos/admin  — admin ve todos con info del empleado
router.get('/admin', requireAdmin, async (req, res) => {
  const { empleado_id } = req.query
  let query = sb.from('documentos')
    .select('id,nombre,tipo,descripcion,url,created_at,empleado_id,empleados(nombre)')
    .order('created_at', { ascending: false })
  if (empleado_id) query = query.eq('empleado_id', empleado_id)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// POST /documentos  — admin sube un documento para un empleado
router.post('/', requireAdmin, upload.single('archivo'), async (req, res) => {
  const { empleado_id, nombre, tipo, descripcion } = req.body
  if (!empleado_id || !nombre || !req.file) {
    return res.status(400).json({ error: 'empleado_id, nombre y archivo son obligatorios' })
  }

  const ext = req.file.originalname.split('.').pop()
  const path = `${empleado_id}/${Date.now()}.${ext}`

  const { error: uploadErr } = await sb.storage
    .from('documentos')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  const { data: { publicUrl } } = sb.storage.from('documentos').getPublicUrl(path)

  const { data, error } = await sb.from('documentos').insert({
    empleado_id: Number(empleado_id),
    nombre,
    tipo: tipo || null,
    descripcion: descripcion || null,
    url: publicUrl
  }).select('id,nombre,tipo,descripcion,url,created_at,empleado_id').single()

  if (error) {
    await sb.storage.from('documentos').remove([path])
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
})

// DELETE /documentos/:id  — admin elimina un documento
router.delete('/:id', requireAdmin, async (req, res) => {
  const { data: doc, error: findErr } = await sb.from('documentos')
    .select('url')
    .eq('id', req.params.id)
    .single()
  if (findErr) return res.status(404).json({ error: 'Documento no encontrado' })

  if (doc.url) {
    const urlParts = doc.url.split('/documentos/')
    if (urlParts.length === 2) {
      await sb.storage.from('documentos').remove([urlParts[1]])
    }
  }

  const { error } = await sb.from('documentos').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
