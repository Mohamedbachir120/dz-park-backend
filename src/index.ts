import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'
import { router as authRouter } from './routes/auth.routes';
import { router as reservationRouter } from './routes/reservation.routes';
import { router as dashboardRouter } from './routes/dashboard.routes';
import { authenticate } from './utils/authenticate';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
export const prisma = new PrismaClient();

// Use express.json() to parse JSON bodies
app.use(express.json());

// Import routes

app.use(cors());

// Use routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard',authenticate, dashboardRouter);
app.use('/api', reservationRouter);


// To create admin user (run once):
// async function createAdmin() {
//   const hashed = bcrypt.hashSync('password123', 10);
//   await prisma.user.create({ data: { username: 'admin', password: hashed, role: 'admin' } });
// }
// createAdmin();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {

   console.log(`Server is running on port ${PORT}`);
});
