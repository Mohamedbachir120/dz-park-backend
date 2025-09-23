
import express from 'express';

export const router = express.Router();

import {listReservations, listClients, updateReservationStatus, downloadBonDeCommande} from '../controllers/dashboard.controller';

// Route to list all reservations (admin only)
router.get('/reservations', listReservations);

// Route to list all clients (admin only)
router.get('/clients', listClients);

router.get('/download-bon/:id',downloadBonDeCommande);

// Route to update reservation status (admin only)
router.put('/reservations/:id/status', updateReservationStatus);