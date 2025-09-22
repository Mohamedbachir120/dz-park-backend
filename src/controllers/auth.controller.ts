import { Request,Response } from "express";
import { prisma } from "..";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const login = async(req: Request, res: Response) => {
    const { username, password } = req.body;
  
    try {
      const user = await prisma.user.findUnique({ where: { username } ,
      select: { id: true, username: true, role: true, password: true }});
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
       const newUser = { id: user.id, username: user.username, role: user.role };
      res.json({ user: newUser,token });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
};

export const verifyToken = (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
  
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      res.json({ message: 'Token is valid', decoded });
    });
};