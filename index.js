const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const cluster = require('cluster');
const os = require('os');

dotenv.config();

// --- Startup Guards ---
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined. Set it in your .env file.');
  process.exit(1);
}

// Route imports
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const officerRoutes = require('./routes/officerRoutes');

// Rate limiter
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn('CORS is enabled but no CLIENT_URLS or CLIENT_URL is set. Browser requests may be blocked.');
}

// --- Core Middleware ---
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests without Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(globalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'NOC backend is running',
    health: '/health',
    apiHealth: '/api/health',
  });
});

// --- Health Check ---
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Prom Client Metrics ---
const promClient = require('prom-client');
promClient.collectDefaultMetrics();
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10]
});

app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const time = diff[0] + diff[1] / 1e9;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route ? req.route.path : req.path, res.statusCode)
      .observe(time);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  if (req.headers['x-metrics-secret'] !== process.env.METRICS_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.set('Content-Type', promClient.register.contentType);
  const metrics = await promClient.register.metrics();
  res.send(metrics);
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/officer', officerRoutes);

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// --- Global Error Handler (must be last) ---
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ message: err.message || 'Internal Server Error' });
});

// --- Database Connection + Server Startup ---
// HTTP server only starts AFTER DB is confirmed connected to prevent
// requests hitting the app before Mongoose is ready.
const startServer = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    if (process.env.USE_IN_MEMORY_DB === 'true' || !mongoUri) {
      const mem = await MongoMemoryServer.create();
      mongoUri = mem.getUri();
      console.log(`Worker ${process.pid} Using in-memory MongoDB instance`);
    }
    // Set maxPoolSize limits, max 10 connections per worker. 
    // Math: Active Connections = Workers x maxPoolSize (e.g. 4 x 10 = 40). 
    // This safely keeps us below MongoDB Atlas M0 limit of 500 or M10 limit of 750.
    // minPoolSize: 2 keeps baseline connections warm to prevent slow cold-starts.
    await mongoose.connect(mongoUri, { maxPoolSize: 10, minPoolSize: 2 });
    console.log(`Worker ${process.pid} MongoDB Connected`);

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Worker ${process.pid} Startup Error: ${error.message}`);
    process.exit(1);
  }
};

// Start cluster if not in memory mode to prevent isolated DBs, and limit workers
const numWorkers = process.env.WEB_CONCURRENCY ? parseInt(process.env.WEB_CONCURRENCY) : os.cpus().length;

if ((cluster.isPrimary || cluster.isMaster) && process.env.USE_IN_MEMORY_DB !== 'true') {
  console.log(`Primary process ${process.pid} is running`);
  console.log(`Forking ${numWorkers} workers for Node clustering (Load Balancing)`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`);
    console.log('Starting a new worker...');
    cluster.fork();
  });
} else {
  // If we're a worker process, or in memory DB mode, start the server
  startServer();
}
