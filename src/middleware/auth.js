import jwt from 'jsonwebtoken'
import { sb } from '../config/supabase.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    const { data: emp } = await sb.from('empleados').select('id,activo').eq('id', payload.id).single()
    if (!emp || !emp.activo) return res.status(401).json({ error: 'Cuenta desactivada' })
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
