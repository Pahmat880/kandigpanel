// api/admin/manage-configs.js
import { connectToDatabase } from '../../utils/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access Denied: No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Access Denied: Invalid token.' });
    req.user = user;
    next();
  });
}

export default async function handler(req, res) {
  await authenticateToken(req, res, async () => {
    if (!req.user) return;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden. Only administrators can perform this action.' });
    }

    try {
      const db = await connectToDatabase();
      const configsCollection = db.collection('panelConfigs');

      if (req.method === 'GET') {
        const { type } = req.query;
        let configs;
        
        if (type) {
            // Ambil satu konfigurasi berdasarkan tipe
            const config = await configsCollection.findOne({ type: type });
            configs = config ? [config] : [];
        } else {
            // Jika tidak ada tipe, ambil semua konfigurasi
            configs = await configsCollection.find({}).toArray();
        }

        return res.status(200).json({ success: true, configs });
      }

      if (req.method === 'POST') {
        const { type, domain, ptla, ptlc, eggId, nestId, loc } = req.body;
        if (!type || !domain || !ptla || !ptlc || !eggId || !nestId || !loc) {
          return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const existingConfig = await configsCollection.findOne({ type });
        if (existingConfig) {
          return res.status(409).json({ success: false, message: 'Config type already exists.' });
        }

        await configsCollection.insertOne({ type, domain, ptla, ptlc, eggId, nestId, loc, createdAt: new Date() });
        return res.status(201).json({ success: true, message: 'Config created successfully.' });
      }

      if (req.method === 'PUT') {
        const { type, domain, ptla, ptlc, eggId, nestId, loc } = req.body;
        if (!type) {
          return res.status(400).json({ success: false, message: 'Config type is required.' });
        }

        const updateData = { type, domain, ptla, ptlc, eggId, nestId, loc, updatedAt: new Date() };

        const result = await configsCollection.updateOne(
          { type },
          { $set: updateData }
        );
        
        if (result.modifiedCount === 0) {
          return res.status(404).json({ success: false, message: 'Config not found or no changes were made.' });
        }

        return res.status(200).json({ success: true, message: 'Config updated successfully.' });
      }
      
      if (req.method === 'DELETE') {
        const { type } = req.body;
        if (!type) {
          return res.status(400).json({ success: false, message: 'Config type is required.' });
        }

        const result = await configsCollection.deleteOne({ type });

        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: 'Config not found.' });
        }

        return res.status(200).json({ success: true, message: 'Config deleted successfully.' });
      }

      return res.status(405).json({ success: false, message: 'Method Not Allowed.' });

    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
}
