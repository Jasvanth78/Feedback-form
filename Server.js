const express = require('express');
const dotenv = require('dotenv');
const userRoutes = require('./Routes/UserRute');
const feedbackRoutes = require('./Contrroller/feedbackcontroller');
const userManagementRoutes = require('./Routes/UserManagement');
const cors = require('cors');
const passwordResetRouter = require('./Routes/PasswordReset');

dotenv.config();
const app = express();

// CORS configuration for deployed frontend
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://feedback-form-5sd6.onrender.com',
    'https://jasvanth78.github.io',
    '*'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
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
