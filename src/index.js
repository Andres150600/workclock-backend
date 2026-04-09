import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes from './routes/auth.js'
import fichajesRoutes from './routes/fichajes.js'
import ausenciasRoutes from './routes/ausencias.js'
import empleadosRoutes from './routes/empleados.js'
import turnosRoutes from './routes/turnos.js'
import informesRoutes from './routes/informes.js'
import documentosRoutes from './routes/documentos.js'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

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
