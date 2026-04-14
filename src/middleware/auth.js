import jwt from 'jsonwebtoken'
import { sb } from '../config/supabase.js'

// Caché en memoria: evita una llamada DB por cada request durante 2 min
const _cache = new Map()
const TTL = 2 * 60 * 1000

function getCached(id) {
  const e = _cache.get(id)
  if (!e || Date.now() - e.ts > TTL) { _cache.delete(id); return null }
  return e
}
function setCache(id, activo) {
  _cache.set(id, { ts: Date.now(), activo })
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)

    const cached = getCached(payload.id)
    if (!cached) {
      const { data: emp } = await sb.from('empleados').select('id,activo').eq('id', payload.id).single()
      if (!emp || !emp.activo) return res.status(401).json({ error: 'Cuenta desactivada' })
      setCache(payload.id, true)
    } else if (!cached.activo) {
      return res.status(401).json({ error: 'Cuenta desactivada' })
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.es_admin) {
      return res.status(403).json({ error: 'Acceso restringido a administradores' })
    }
    next()
  })
}
