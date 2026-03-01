import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { errorHandler } from './middleware/errorHandler'
import { notFound } from './middleware/notFound'
import healthRouter from './routes/health'
import usersRouter from './routes/users'
import designsRouter from './routes/designs'
import materialsRouter from './routes/materials'
import labRouter from './routes/lab'
import categoriesRouter from './routes/categories'
import notificationsRouter from './routes/notifications'
import disciplinesRouter from './routes/disciplines'
import adminRouter from './routes/admin'
import executionsRouter from './routes/executions'
import searchRouter from './routes/search'

const app = express()

// Security & logging
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/health', healthRouter)
app.use('/api/users', usersRouter)
app.use('/api/designs', designsRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/lab', labRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/disciplines', disciplinesRouter)
app.use('/api/admin', adminRouter)
app.use('/api/executions', executionsRouter)
app.use('/api/search', searchRouter)
app.use('/api/users/me/notifications', notificationsRouter)

// Error handling (must be last)
app.use(notFound)
app.use(errorHandler)

export default app
