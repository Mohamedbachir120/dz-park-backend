
import express from 'express';

export const router = express.Router();

import { login, verifyToken } from '../controllers/auth.controller';

// Login route
router.post('/login', login);
router.get('/verify', verifyToken); // You might want to create a separate controller for token verification