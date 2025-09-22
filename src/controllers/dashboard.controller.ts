import { Request, Response } from 'express';
import { prisma } from '..';
import { PrismaClient, Prisma } from '@prisma/client';
import { transporter } from '../utils/mail';

interface AuthRequest extends Request {
    user?: { id: string; role: string };
  }

  // Admin endpoint: List all reservations
  export const listReservations =  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
    const reservations = await prisma.reservation.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reservations);
  };
  
  // Admin endpoint: List all clients
 export const listClients =  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
    const clients = await prisma.client.findMany({
      include: { reservations: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  };

  export const updateReservationStatus = async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
    const { id } = req.params;
    const { status } = req.body;
  
    try {
      const reservation = await prisma.reservation.update({
        where: { id },
        data: { status },
        include: { client: true },
      });
  

      /// Send email notification to client about status update
      const mailOptions = {
        from: "info@matarpark.com",
        to: reservation.client.email,
        subject: 'Reservation Status Updated',
        text: `Dear ${reservation.client.fullName},\n\nYour reservation status has been updated to: ${status}.\n\nThank you for using our service!\n\nBest regards,\nAero Park Team`,
      };
  
     const info =  await transporter.sendMail(mailOptions);

      res.json({ reservation, info });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }