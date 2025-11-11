const express = require('express');
const dotenv = require('dotenv');
const userRoutes = require('./Routes/UserRute');
const feedbackRoutes = require('./Contrroller/feedbackcontroller');
const userManagementRoutes = require('./Routes/UserManagement');
const cors = require('cors');
const passwordResetRouter = require('./Routes/PasswordReset');

dotenv.config();
const app = express();


app.use(cors({origin: '*'}));
app.use(express.json());
app.use('/api', userRoutes);
app.use('/api', passwordResetRouter);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', userManagementRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
