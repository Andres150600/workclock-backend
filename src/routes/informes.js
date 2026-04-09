import { Router } from 'express'
import { sb } from '../config/supabase.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /informes?mes=3&anio=2026
router.get('/', requireAdmin, async (req, res) => {
  const mes = parseInt(req.query.mes ?? new Date().getMonth())
  const anio = parseInt(req.query.anio ?? new Date().getFullYear())
  const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${new Date(anio, mes + 1, 0).getDate()}`

  const [{ data: emps }, { data: fichs }, { data: aus }] = await Promise.all([
    sb.from('empleados').select('id,nombre,departamento').eq('es_admin', false).eq('activo', true).order('nombre'),
    sb.from('fichajes').select('empleado_id,fecha,entrada,salida').gte('fecha', desde).lte('fecha', hasta),
    sb.from('ausencias').select('empleado_id,estado').gte('desde', desde).lte('hasta', hasta),
  ])

  const filas = (emps || []).map(emp => {
    const mf = (fichs || []).filter(f => f.empleado_id === emp.id)
    const ma = (aus || []).filter(a => a.empleado_id === emp.id)
    const ms = mf.filter(f => f.salida).reduce((a, f) => a + (new Date(f.salida) - new Date(f.entrada)), 0)
    const horas = `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
    return {
      nombre: emp.nombre,
      departamento: emp.departamento,
      dias: mf.filter(f => f.entrada).length,
      horas,
      ausencias_aprobadas: ma.filter(a => a.estado === 'aprobada').length,
      ausencias_pendientes: ma.filter(a => a.estado === 'pendiente').length,
      fichajes: mf,
    }
  })

  res.json({ mes, anio, filas })
})

// GET /informes/dashboard  — datos para el panel de admin
router.get('/dashboard', requireAdmin, async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0]
  const dow = new Date().getDay()
  const getLunes = () => {
    const d = new Date(); const dw = d.getDay() || 7
    d.setDate(d.getDate() - dw + 1); return d.toISOString().split('T')[0]
  }

  const [empRes, ficHoyRes, pendRes, semRes, recRes] = await Promise.all([
    sb.from('empleados').select('id,departamento', { count: 'exact' }).eq('es_admin', false).eq('activo', true),
    sb.from('fichajes').select('id,entrada,salida').eq('fecha', hoy),
    sb.from('ausencias').select('id', { count: 'exact' }).eq('estado', 'pendiente'),
    sb.from('fichajes').select('fecha').gte('fecha', getLunes()),
    sb.from('fichajes').select('id,fecha,entrada,salida,empleados(nombre)').order('created_at', { ascending: false }).limit(6),
  ])

  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const map = {}; (semRes.data || []).forEach(x => { map[x.fecha] = (map[x.fecha] || 0) + 1 })
  const semana = dias.map((d, i) => {
    const dt = new Date(); const dw = dt.getDay() || 7
    dt.setDate(dt.getDate() - dw + i + 1)
    return { d, n: map[dt.toISOString().split('T')[0]] || 0 }
  })

  const depMap = {}; (empRes.data || []).forEach(x => { depMap[x.departamento] = (depMap[x.departamento] || 0) + 1 })

  res.json({
    stats: {
      empleados: empRes.count || 0,
      fichajes_hoy: (ficHoyRes.data || []).filter(x => x.entrada).length,
      en_oficina: (ficHoyRes.data || []).filter(x => x.entrada && !x.salida).length,
      pendientes: pendRes.count || 0,
    },
    semana,
    departamentos: Object.entries(depMap),
    recientes: recRes.data || [],
  })
})

// GET /informes/alertas
router.get('/alertas', requireAdmin, async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0]
  const dow = new Date().getDay()
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [abiertos, recientes, emps, fichadosHoy] = await Promise.all([
    sb.from('fichajes').select('id,fecha,entrada,empleados(nombre,departamento)').is('salida', null).not('entrada', 'is', null).lt('fecha', hoy),
    sb.from('fichajes').select('id,fecha,entrada,salida,empleados(nombre)').not('salida', 'is', null).gte('fecha', hace30),
    dow >= 1 && dow <= 5 ? sb.from('empleados').select('id,nombre,departamento').eq('es_admin', false).eq('activo', true) : Promise.resolve({ data: [] }),
    dow >= 1 && dow <= 5 ? sb.from('fichajes').select('empleado_id').eq('fecha', hoy) : Promise.resolve({ data: [] }),
  ])

  const alertas = []
  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'
  const fmtDur = ms => `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`

  ;(abiertos.data || []).forEach(f => alertas.push({ tipo: 'sin_salida', nivel: 'danger', msg: `${f.empleados?.nombre} — sin registrar salida el ${fmtDate(f.fecha)}` }))
  ;(recientes.data || []).forEach(f => {
    const dur = new Date(f.salida) - new Date(f.entrada)
    if (dur > 10 * 3600000) alertas.push({ tipo: 'jornada_larga', nivel: 'warn', msg: `${f.empleados?.nombre} — ${fmtDur(dur)} trabajadas el ${fmtDate(f.fecha)}` })
  })
  if (dow >= 1 && dow <= 5) {
    const ids = new Set((fichadosHoy.data || []).map(f => f.empleado_id))
    ;(emps.data || []).forEach(e => {
      if (!ids.has(e.id)) alertas.push({ tipo: 'no_fichado', nivel: 'info', msg: `${e.nombre}${e.departamento ? ' (' + e.departamento + ')' : ''} — no ha registrado entrada hoy` })
    })
  }

  res.json(alertas)
})

export default router
