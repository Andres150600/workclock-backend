import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sb } from '../config/supabase.js'

const router = Router()

// POST /auth/login
router.post('/login', async (req, res) => {
  const { nombre, pin } = req.body
  if (!nombre || !pin) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  // Buscar empleado por username (insensible a mayúsculas)
  const { data: emp } = await sb
    .from('empleados')
    .select('id,nombre,email,rol,departamento,cargo,es_admin,activo,dias_vacaciones,dias_usados,pin')
    .ilike('username', nombre.trim())
    .eq('activo', true)
    .maybeSingle()

  if (!emp) {
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }

  // Comprobar bloqueo por intentos
  const { count } = await sb
    .from('intentos_login')
    .select('id', { count: 'exact' })
    .eq('empleado_id', emp.id)
    .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  if (count >= 5) {
    return res.status(429).json({ error: 'Cuenta bloqueada 15 min por exceso de intentos', bloqueado: true })
  }

  // Registrar intento
  await sb.from('intentos_login').insert({ empleado_id: emp.id })

  // Verificar PIN con bcrypt
  const valido = await bcrypt.compare(pin, emp.pin)
  if (!valido) {
    return res.status(401).json({ error: 'Credenciales incorrectas' })
  }

  // Limpiar intentos tras login correcto
  await sb.from('intentos_login').delete().eq('empleado_id', emp.id)

  // Generar JWT (8 horas)
  const { pin: _, ...empleado } = emp
  const token = jwt.sign(empleado, process.env.JWT_SECRET, { expiresIn: '8h' })

  res.json({ token, empleado })
})

export default router
