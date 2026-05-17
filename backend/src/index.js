import express from 'express';
import cors from 'cors';
import config from './config.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import { verifyToken } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// JSON body parser with 1MB limit
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', verifyToken, rateLimit, aiRoutes);

// Catch-all error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`SIMAK backend running on port ${config.port}`);
});

export default app;
