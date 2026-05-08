import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { sb } from '../config/supabase.js'

const router = Router()
const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000

// POST /auth/login
router.post('/login', async (req, res) => {
  const { nombre, pin } = req.body
  if (!nombre || !pin) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  const { data: emp } = await sb
    .from('empleados')
    .select('id,nombre,email,rol,departamento,cargo,es_admin,activo,dias_vacaciones,dias_usados,pin')
    .ilike('username', nombre.trim())
    .eq('activo', true)
    .maybeSingle()

  if (!emp) return res.status(401).json({ error: 'Credenciales incorrectas' })

  const { count } = await sb
    .from('intentos_login')
    .select('id', { count: 'exact' })
    .eq('empleado_id', emp.id)
    .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  if (count >= 5) {
    return res.status(429).json({ error: 'Cuenta bloqueada 15 min por exceso de intentos', bloqueado: true })
  }

  await sb.from('intentos_login').insert({ empleado_id: emp.id })

  const valido = await bcrypt.compare(pin, emp.pin)
  if (!valido) return res.status(401).json({ error: 'Credenciales incorrectas' })

  await sb.from('intentos_login').delete().eq('empleado_id', emp.id)

  const { pin: _, ...empleado } = emp

  // Access token corto (15 min); se renueva silenciosamente con el refresh token
  const accessToken = jwt.sign(empleado, process.env.JWT_SECRET, { expiresIn: '15m' })

  // Refresh token opaco — guardado en DB, válido 7 días
  const refreshToken = randomUUID()
  await sb.from('refresh_tokens').insert({
    empleado_id: emp.id,
    token: refreshToken,
    expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString()
  })

  // Devuelve `token` por compatibilidad con código existente + los nuevos campos
  res.json({ token: accessToken, accessToken, refreshToken, empleado })
})

// POST /auth/refresh  — renueva el access token silenciosamente
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'Falta refreshToken' })

  const { data: rt } = await sb
    .from('refresh_tokens')
    .select('empleado_id, expires_at')
    .eq('token', refreshToken)
    .maybeSingle()

  if (!rt || new Date(rt.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' })
  }

  const { data: emp } = await sb
    .from('empleados')
    .select('id,nombre,email,rol,departamento,cargo,es_admin,activo,dias_vacaciones,dias_usados')
    .eq('id', rt.empleado_id)
    .eq('activo', true)
    .maybeSingle()

  if (!emp) {
    await sb.from('refresh_tokens').delete().eq('token', refreshToken)
    return res.status(401).json({ error: 'Cuenta desactivada' })
  }

  const accessToken = jwt.sign(emp, process.env.JWT_SECRET, { expiresIn: '15m' })
  res.json({ token: accessToken, accessToken, empleado: emp })
})

// POST /auth/logout  — invalida el refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body
  if (refreshToken) {
    await sb.from('refresh_tokens').delete().eq('token', refreshToken)
  }
  res.json({ ok: true })
})

export default router
