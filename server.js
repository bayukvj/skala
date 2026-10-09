import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import { db, initDb } from './db/connection.js';
import { seed } from './db/seed.js';
import accountsRouter from './routes/accounts.js';
import journalsRouter from './routes/journals.js';
import receivablesRouter from './routes/receivables.js';
import payablesRouter from './routes/payables.js';
import projectsRouter from './routes/projects.js';
import reportsRouter from './routes/reports.js';
import { customersRouter, suppliersRouter } from './routes/crud.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import invoicesRouter from './routes/invoices.js';
import payrollRouter from './routes/payroll.js';
import productsRouter from './routes/products.js';
import warehousesRouter from './routes/warehouses.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

initDb();
seed();

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static frontend
const publicDir = join(__dirname, 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// API routes
app.use('/api/accounts', accountsRouter);
app.use('/api/journals', journalsRouter);
app.use('/api/receivables', receivablesRouter);
app.use('/api/payables', payablesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/products', productsRouter);
app.use('/api/warehouses', warehousesRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Skala', version: '1.0.0' }));

// Login page (URL: /login atau /masuk)
app.get(['/login', '/masuk'], (req, res) => {
  res.sendFile(join(publicDir, 'login.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  const index = join(publicDir, 'index.html');
  if (existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Skala berjalan di http://localhost:${PORT}`);
});

export default app;