import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import authRoutes from './routes/auth.js'
import fichajesRoutes from './routes/fichajes.js'
import ausenciasRoutes from './routes/ausencias.js'
import empleadosRoutes from './routes/empleados.js'
import turnosRoutes from './routes/turnos.js'
import informesRoutes from './routes/informes.js'
import documentosRoutes from './routes/documentos.js'

const app = express()
app.use(helmet())

const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.some(o => origin === o || origin.endsWith('.vercel.app'))) return cb(null, true)
    cb(new Error('CORS no permitido'))
  }
}))
app.use(express.json({ limit: '20kb' }))

app.use('/auth', authRoutes)
app.use('/fichajes', fichajesRoutes)
app.use('/ausencias', ausenciasRoutes)
app.use('/empleados', empleadosRoutes)
app.use('/turnos', turnosRoutes)
app.use('/informes', informesRoutes)
app.use('/documentos', documentosRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`WorkClock API corriendo en puerto ${PORT}`))
