const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

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
      console.log('Using in-memory MongoDB instance');
    }
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Startup Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
