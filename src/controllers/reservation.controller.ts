import { Request, Response } from 'express';
import { prisma } from '..';
import { transporter } from '../utils/mail';
// Fix 1: Import both Prisma and PrismaClientKnownRequestError correctly
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface FormData {
  dateAller: string;
  flightNumberAller: string;
  dateRetour: string;
  flightNumberRetour: string;
  parkingType: 'externe' | 'interne';
  cleaningType: 'none' | 'exterior' | 'interior' | 'full';
  withFuel: boolean;
  isOversized: boolean;
  fullName: string;
  email: string;
  phoneNumber: string;
  carImmatriculation: string;
}

export const createReservation = async (req: Request, res: Response) => {
  const data: FormData = req.body;

  try {
    // Validate dates
    const startDate = new Date(data.dateAller);
    const endDate = new Date(data.dateRetour);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ error: 'Invalid dates' });
    }

    // Find clients by email or phone
    const clientByEmail = await prisma.client.findUnique({ where: { email: data.email } });
    const clientByPhone = await prisma.client.findUnique({ where: { phoneNumber: data.phoneNumber } });

     

    let client = clientByEmail || clientByPhone;

    if (client) {
      
     

      // Fix 2: Use a simple object type that matches the client fields
      const updateData: {
        fullName?: string;
        email?: string;
        phoneNumber?: string;
      } = {};
      if (client.fullName !== data.fullName) updateData.fullName = data.fullName;
      if (!client.email) updateData.email = data.email;
      if (!client.phoneNumber) updateData.phoneNumber = data.phoneNumber;

      if (Object.keys(updateData).length > 0) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: updateData,
        });
      }
    } else {
      // Create new client
      client = await prisma.client.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phoneNumber: data.phoneNumber,
        },
      });
    }

    // Check for overlapping reservations
    const overlapping = await prisma.reservation.findMany({
      where: {
        clientId: client.id,
        dateAller: { lt: endDate },
        dateRetour: { gt: startDate },
      },
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ error: 'You already have a reservation in this period' });
    }

    // Calculate total price (recalculate for security)
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let dailyRate = data.parkingType === 'externe' ? 500 : 600;
    if (data.isOversized) dailyRate += 100;
    if (diffDays > 5) dailyRate -= 100;

    let totalPrice = diffDays * dailyRate;
    const cleaningPrices = { none: 0, exterior: 800, interior: 600, full: 1200 };
    totalPrice += cleaningPrices[data.cleaningType];
    if (data.withFuel) totalPrice += 1000;

    // Generate unique reservationNumber
    const dateStr = startDate.toISOString().split('T')[0];
    const base = `${dateStr}-${data.flightNumberAller.toUpperCase()}`;
    let reservationNumber = base;
    let num = 1;
    while (await prisma.reservation.findUnique({ where: { reservationNumber } })) {
      reservationNumber = `${base}-${num++}`;
    }

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber,
        dateAller: startDate,
        flightNumberAller: data.flightNumberAller,
        dateRetour: endDate,
        flightNumberRetour: data.flightNumberRetour,
        parkingType: data.parkingType,
        cleaningType: data.cleaningType,
        withFuel: data.withFuel,
        isOversized: data.isOversized,
        carImmatriculation: data.carImmatriculation,
        totalPrice,
        clientId: client.id,
      },
    });

    // Email to client
    // await transporter.sendMail({
    //   from: process.env.EMAIL_FROM,
    //   to: data.email,
    //   subject: 'Confirmation de votre réservation',
    //   text: `Votre réservation ${reservation.reservationNumber} pour un total de ${totalPrice} DZD a été créée avec succès.`,
    // });

    // // Email to admin
    // await transporter.sendMail({
    //   from: process.env.EMAIL_FROM,
    //   to: process.env.ADMIN_EMAIL,
    //   subject: 'Nouvelle réservation créée',
    //   text: `Une nouvelle réservation a été créée par ${data.fullName}. Numéro: ${reservation.reservationNumber}, Total: ${totalPrice} DZD.`,
    // });

    res.json({ success: true, reservation });
  } catch (e: unknown) {
    // Fix 3: Properly type the error and import PrismaClientKnownRequestError from the correct location
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(400).json({ error: 'Unique constraint violation (email or phone already exists)' });
    } else {
      res.status(500).json({ error: (e as Error).message });
    }
  }
};