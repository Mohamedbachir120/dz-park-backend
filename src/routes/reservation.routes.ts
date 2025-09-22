import express from 'express';

export const router = express.Router();

import { createReservation,  } from '../controllers/reservation.controller';

// Route to create a reservation
router.post('/reservations', createReservation);