// api/list-panels.js

import { connectToDatabase } from '../utils/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Akses Ditolak: Token tidak diberikan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Akses Ditolak: Token tidak valid.' });
        }
        req.user = user;
        next();
    });
}

export default async function handler(req, res) {
    await authenticateToken(req, res, async () => {
        if (!req.user) return;

        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, message: 'Metode Tidak Diizinkan.' });
        }

        try {
            const db = await connectToDatabase();
            const userPanelsCollection = db.collection('userPanels');

            let panels;
            if (req.user.role === 'admin') {
                panels = await userPanelsCollection.find({}).toArray();
            } else {
                // Filter panel berdasarkan accountId yang didapat dari token JWT
                panels = await userPanelsCollection.find({ accountId: req.user.id }).toArray();
            }
            
            return res.status(200).json({ success: true, panels });
        } catch (error) {
            console.error('Error in list-panels.js:', error);
            res.status(500).json({ success: false, message: `Kesalahan Server Internal: ${error.message}` });
        }
    });
}
