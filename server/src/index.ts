import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import notificationRoutes from './routes/notifications.js';
import autoApplyRoutes from './routes/autoapply.js';
import billingRoutes from './routes/billing.js';
import analyticsRoutes from './routes/analytics.js';
import { initDb } from './db.js';
import { ensureFreshJobs } from './jobs/ingest.js';
import { startDigestScheduler } from './notifications/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Initialize database (async for sql.js)
  await initDb();

  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

  // Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/autoapply', autoApplyRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static dashboard files if built
const dashboardDist = path.join(__dirname, '..', '..', 'dashboard', 'dist');
app.use(express.static(dashboardDist));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const indexPath = path.join(dashboardDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Dashboard not built yet. Run the dashboard build first.' });
    }
  });
});

  app.listen(PORT, () => {
    console.log(`JobTracker API server running on http://localhost:${PORT}`);
    console.log(`  API:       http://localhost:${PORT}/api`);
    console.log(`  Health:    http://localhost:${PORT}/api/health`);
    console.log(`  Dashboard: http://localhost:${PORT} (if built)`);

    // Warm up the job store in the background (non-blocking).
    ensureFreshJobs()
      .then(() => console.log('  Jobs:      ingestion warm-up complete'))
      .catch((err) => console.error('  Jobs:      warm-up failed', err?.message || err));

    // Start the daily WhatsApp digest scheduler.
    startDigestScheduler();
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
