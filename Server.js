const express = require('express');
const dotenv = require('dotenv');
const userRoutes = require('./Routes/UserRute');
const feedbackRoutes = require('./Contrroller/feedbackcontroller');
const userManagementRoutes = require('./Routes/UserManagement');
const cors = require('cors');
const passwordResetRouter = require('./Routes/PasswordReset');

dotenv.config();
const app = express();

// CORS configuration: allow the deployed frontend or reflect origin.
// For debugging and to avoid blocked requests from various deployed domains,
// we'll reflect the request origin (origin: true). In production you may
// want to restrict this to a specific origin or list via process.env.FRONTEND_URL.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://feedback-form-5sd6.onrender.com',
  'https://jasvanth78.github.io'
].filter(Boolean)

console.log('Allowed origins for CORS:', allowedOrigins)

const corsOptions = {
  origin: true, // reflect request origin (allows requests from any origin)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.use(express.json());

// Root route for health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Feedback Form API is running',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', userRoutes);
app.use('/api', passwordResetRouter);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', userManagementRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
