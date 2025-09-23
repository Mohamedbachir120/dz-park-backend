import { Request, Response } from 'express';
import { prisma } from '..';
import { transporter } from '../utils/mail';
// Fix 1: Import both Prisma and PrismaClientKnownRequestError correctly
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';


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

// Function to generate PDF bon de commande
const generateBonDeCommande = async (reservation: any, client: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'bon-de-commande');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate filename
      const filename = `bon-de-commande-${reservation.reservationNumber}.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Pipe to file
      doc.pipe(fs.createWriteStream(filepath));

      // Add content to PDF
      // Header
      doc.fontSize(20)
         .text('BON DE COMMANDE', { align: 'center' })
         .moveDown();

      // Company info (adjust as needed)
      doc.fontSize(12)
         .text('PARKING AÉROPORT SERVICE', { align: 'center' })
         .text('Aéroport Houari Boumediene - Alger', { align: 'center' })
         .text('Tél: +213 XX XX XX XX', { align: 'center' })
         .moveDown(2);

      // Reservation details
      doc.fontSize(14)
         .text('DÉTAILS DE LA RÉSERVATION', { underline: true })
         .moveDown();

      doc.fontSize(11)
         .text(`Numéro de réservation: ${reservation.reservationNumber}`)
         .text(`Date de création: ${new Date().toLocaleDateString('fr-FR')}`)
         .moveDown();

      // Client information
      doc.fontSize(14)
         .text('INFORMATIONS CLIENT', { underline: true })
         .moveDown();

      doc.fontSize(11)
         .text(`Nom complet: ${client.fullName}`)
         .text(`Email: ${client.email}`)
         .text(`Téléphone: ${client.phoneNumber}`)
         .text(`Immatriculation: ${reservation.carImmatriculation}`)
         .moveDown();

      // Service details
      doc.fontSize(14)
         .text('DÉTAILS DU SERVICE', { underline: true })
         .moveDown();

      const startDate = new Date(reservation.dateAller).toLocaleDateString('fr-FR');
      const endDate = new Date(reservation.dateRetour).toLocaleDateString('fr-FR');
      const diffDays = Math.ceil((new Date(reservation.dateRetour).getTime() - new Date(reservation.dateAller).getTime()) / (1000 * 60 * 60 * 24));

      doc.fontSize(11)
         .text(`Période: du ${startDate} au ${endDate} (${diffDays} jour${diffDays > 1 ? 's' : ''})`)
         .text(`Vol aller: ${reservation.flightNumberAller}`)
         .text(`Vol retour: ${reservation.flightNumberRetour}`)
         .text(`Type de parking: ${reservation.parkingType === 'externe' ? 'Externe' : 'Interne'}`)
         .moveDown();

      // Services breakdown
      doc.fontSize(14)
         .text('DÉTAIL DES SERVICES', { underline: true })
         .moveDown();

      let y = doc.y;
      
      // Table headers
      doc.fontSize(10)
         .text('Service', 50, y)
         .text('Quantité', 250, y)
         .text('Prix unitaire', 350, y)
         .text('Total', 450, y);
      
      y += 20;
      doc.moveTo(50, y).lineTo(520, y).stroke();
      y += 10;

      // Parking cost
      let dailyRate = reservation.parkingType === 'externe' ? 500 : 600;
      if (reservation.isOversized) dailyRate += 100;
      if (diffDays > 5) dailyRate -= 100;
      
      const parkingTotal = diffDays * dailyRate;
      
      doc.text(`Parking ${reservation.parkingType}`, 50, y)
         .text(diffDays.toString(), 250, y)
         .text(`${dailyRate} DZD`, 350, y)
         .text(`${parkingTotal} DZD`, 450, y);
      y += 15;

      // Oversized supplement
      if (reservation.isOversized) {
        doc.text('Supplément véhicule surdimensionné', 50, y)
           .text('Inclus', 250, y)
           .text('', 350, y)
           .text('', 450, y);
        y += 15;
      }

      // Cleaning service
      if (reservation.cleaningType !== 'none') {
        const cleaningPrices = { exterior: 800, interior: 600, full: 1200 };
        const cleaningLabels = { 
          exterior: 'Nettoyage extérieur', 
          interior: 'Nettoyage intérieur', 
          full: 'Nettoyage complet' 
        };
        const cleaningPrice = cleaningPrices[reservation.cleaningType as keyof typeof cleaningPrices];
        
        doc.text(cleaningLabels[reservation.cleaningType as keyof typeof cleaningLabels], 50, y)
           .text('1', 250, y)
           .text(`${cleaningPrice} DZD`, 350, y)
           .text(`${cleaningPrice} DZD`, 450, y);
        y += 15;
      }

      // Fuel service
      if (reservation.withFuel) {
        doc.text('Service carburant', 50, y)
           .text('1', 250, y)
           .text('1000 DZD', 350, y)
           .text('1000 DZD', 450, y);
        y += 15;
      }

      // Discount for long stays
      if (diffDays > 5) {
        doc.text('Remise séjour long (>5j)', 50, y)
           .text(diffDays.toString(), 250, y)
           .text('-100 DZD/j', 350, y)
           .text(`-${diffDays * 100} DZD`, 450, y);
        y += 15;
      }

      // Total line
      y += 10;
      doc.moveTo(50, y).lineTo(520, y).stroke();
      y += 15;

      doc.fontSize(12)
         .text('TOTAL', 350, y, { width: 100 })
         .text(`${reservation.totalPrice} DZD`, 450, y);

      // Footer
      y += 40;
      doc.fontSize(10)
         .text('Conditions générales:', 50, y)
         .text('- Le véhicule doit être remis avec les clés', 50, y + 15)
         .text('- Aucun objet de valeur ne doit être laissé dans le véhicule', 50, y + 30)
         .text('- Le paiement doit être effectué avant la prise en charge', 50, y + 45)
         .text('- En cas de retard, des frais supplémentaires peuvent s\'appliquer', 50, y + 60);

      // Signature area
      y += 100;
      doc.text('Signature du client:', 50, y)
         .text('Signature du responsable:', 350, y);

      // Finalize PDF
      doc.end();

      // Wait for PDF to be written
      doc.on('end', () => {
        resolve(filepath);
      });

    } catch (error) {
      reject(error);
    }
  });
};


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
      // Update client if needed
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

    // Calculate total price
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

    // Create reservation (without PDF path first)
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

    // Generate PDF bon de commande
    const pdfPath = await generateBonDeCommande(reservation, client);
    
    // Update reservation with PDF path
    const updatedReservation = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { bonDeCommandePath: pdfPath },
    });

    // Email to client with PDF attachment
    await transporter.sendMail({
      from: "info@matarpark.com",
      to: data.email,
      subject: 'Confirmation de votre réservation - Bon de commande',
      text: `Votre réservation ${reservation.reservationNumber} pour un total de ${totalPrice} DZD a été créée avec succès. Veuillez trouver votre bon de commande en pièce jointe.`,
      attachments: [
        {
          filename: `bon-de-commande-${reservation.reservationNumber}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ]
    });

    // Email to admin
    await transporter.sendMail({
      from: "info@matarpark.com",
      to: "info@matarpark.com",
      subject: 'Nouvelle réservation créée',
      text: `Une nouvelle réservation a été créée par ${data.fullName}. Numéro: ${reservation.reservationNumber}, Total: ${totalPrice} DZD.`,
      attachments: [
        {
          filename: `bon-de-commande-${reservation.reservationNumber}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ]
    });

    res.json({ success: true, reservation: updatedReservation });
  } catch (e: unknown) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(400).json({ error: 'Unique constraint violation (email or phone already exists)' });
    } else {
      res.status(500).json({ error: (e as Error).message });
    }
  }
};