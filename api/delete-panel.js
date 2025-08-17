// api/delete-panel.js
import fetch from 'node-fetch';
import { connectToDatabase } from '../utils/db.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

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
    
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
    }

    const { idServer } = req.query;

    if (!idServer) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    try {
      const db = await connectToDatabase();
      const userPanelsCollection = db.collection('userPanels');
      const panelConfigsCollection = db.collection('panelConfigs');

      const query = { idServer: idServer };
      if (req.user.role !== 'admin') {
        query.userId = new ObjectId(req.user.id);
      }
      const panelToDelete = await userPanelsCollection.findOne(query);

      if (!panelToDelete) {
        return res.status(404).json({ success: false, message: 'Panel tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.' });
      }

      const config = await panelConfigsCollection.findOne({ type: panelToDelete.panelType });
      if (!config) {
        return res.status(404).json({ success: false, message: 'Panel configuration not found.' });
      }

      const DELETE_API_URL = 'https://restapi.mat.web.id/api/pterodactyl/delete';
      const deleteResponse = await fetch(`${DELETE_API_URL}?idserver=${encodeURIComponent(idServer)}&domain=${encodeURIComponent(config.domain)}&ptla=${encodeURIComponent(config.ptla)}`);
      const deleteData = await deleteResponse.json();

      if (deleteResponse.ok && deleteData.status) {
        await userPanelsCollection.deleteOne({ _id: panelToDelete._id });
        res.status(200).json({ success: true, message: 'Panel berhasil dihapus.' });
      } else {
        res.status(deleteResponse.status || 500).json({ success: false, message: deleteData.message || 'Gagal menghapus panel dari API eksternal.' });
      }

    } catch (error) {
      console.error('Error in delete-panel.js:', error);
      res.status(500).json({ success: false, message: `Internal Server Error: ${error.message}` });
    }
  });
}