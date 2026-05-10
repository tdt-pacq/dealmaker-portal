require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { basicAuth } = require('./auth');
const { seedTestDeal } = require('./database');
const dealsRouter = require('./routes/deals');
const generateRouter = require('./routes/generate');
const exportRouter = require('./routes/export');
const extractRouter = require('./routes/extract');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure output directory exists
fs.mkdirSync(path.join(__dirname, '..', 'output'), { recursive: true });

// In production Express serves the React build directly (same origin — no CORS needed).
// In dev the Vite dev server runs on :3000 and needs CORS to reach the API on :3001.
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDev ? 'http://localhost:3000' : false,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth on all API routes
app.use('/api', basicAuth);

app.use('/api/deals', dealsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);
app.use('/api/extract', extractRouter);

// Serve generated output files (auth required)
app.use('/output', basicAuth, express.static(path.join(__dirname, '..', 'output')));

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve root index.html (Deal Marketing — has its own Firebase auth, no basic auth needed)
const rootHtml = path.join(__dirname, '..', 'index.html');
app.get('/pacq-app', (req, res) => res.sendFile(rootHtml));

// Serve Discovery Prep standalone app (no basic auth — standalone tool with its own key)
const discoveryHtml = path.join(__dirname, '..', 'discovery-prep.html');
app.get('/discovery-prep.html', (req, res) => res.sendFile(discoveryHtml));

// Serve root-level assets (images, fonts, etc. referenced by index.html)
const rootAssets = path.join(__dirname, '..', 'assets');
if (fs.existsSync(rootAssets)) {
  app.use('/assets', express.static(rootAssets));
}

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// Seed test data in development only
if (process.env.NODE_ENV !== 'production') {
  seedTestDeal();
}

app.listen(PORT, () => {
  console.log(`PACQ server running on http://localhost:${PORT}`);
  console.log(`Auth: ${process.env.TEAM_USERNAME} / [password from .env]`);
});
