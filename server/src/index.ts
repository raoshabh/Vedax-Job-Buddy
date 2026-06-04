import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig, isProd } from './config.js';
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
  // Fail fast on fatal misconfiguration (e.g. default JWT secret in prod).
  validateConfig();

  // Initialize database (async for sql.js)
  await initDb();

  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

  // Behind a proxy/load balancer (Railway/Render/Fly) — needed for correct
  // client IPs (rate limiting) and secure cookies.
  if (config.trustProxy) app.set('trust proxy', 1);

  // ── Security & infra middleware ──
  // CSP disabled: this serves an SPA + loads the Razorpay checkout script.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    morgan(isProd() ? 'tiny' : 'dev', {
      skip: (req) => req.path === '/api/health' || req.path === '/api/ready',
    })
  );

  // Rate limiting: a general API limiter + a stricter limiter on auth.
  const generalLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.rateLimitPerMin,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.authRateLimitPerMin,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a minute and try again.' },
  });
  app.use('/api/', generalLimiter);

  // ── API Routes ──
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/autoapply', autoApplyRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // Health & readiness
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/ready', (_req, res) => {
    res.json({ status: 'ready' });
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

  // Central error handler — last resort for anything thrown in middleware.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[unhandled]', err.message);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`Vedax Job Buddy API server running on http://localhost:${PORT}`);
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
