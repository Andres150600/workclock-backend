import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sb } from '../config/supabase.js'

const router = Router()

// POST /auth/login
router.post('/login', async (req, res) => {
  const { empleado_id, pin } = req.body
  if (!empleado_id || !pin) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  // Comprobar bloqueo por intentos
  const { count } = await sb
    .from('intentos_login')
    .select('id', { count: 'exact' })
    .eq('empleado_id', empleado_id)
    .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  if (count >= 5) {
    return res.status(429).json({ error: 'Cuenta bloqueada 15 min por exceso de intentos', bloqueado: true })
  }

  // Buscar empleado
  const { data: emp } = await sb
    .from('empleados')
    .select('id,nombre,email,rol,departamento,cargo,es_admin,activo,dias_vacaciones,dias_usados,pin')
    .eq('id', empleado_id)
    .eq('activo', true)
    .single()

  if (!emp) {
    return res.status(401).json({ error: 'Empleado no encontrado' })
  }

  // Registrar intento
  await sb.from('intentos_login').insert({ empleado_id })

  // Verificar PIN con bcrypt
  const valido = await bcrypt.compare(pin, emp.pin)
  if (!valido) {
    return res.status(401).json({ error: 'PIN incorrecto' })
  }

  // Limpiar intentos tras login correcto
  await sb.from('intentos_login').delete().eq('empleado_id', empleado_id)

  // Generar JWT (8 horas)
  const { pin: _, ...empleado } = emp
  const token = jwt.sign(empleado, process.env.JWT_SECRET, { expiresIn: '8h' })

  res.json({ token, empleado })
})

// GET /auth/empleados  (lista pública para el selector del login)
router.get('/empleados', async (req, res) => {
  const { data } = await sb
    .from('empleados')
    .select('id,nombre,es_admin')
    .eq('activo', true)
    .order('nombre')
  res.json(data || [])
})

export default router
