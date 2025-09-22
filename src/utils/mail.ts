
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com', // Your email provider's SMTP server
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_MAIL, // Your email address
      pass: process.env.SMTP_PASSWORD, // App-specific password if using Gmail
    },
  });
  
