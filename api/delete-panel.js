// api/delete-panel.js

import fetch from 'node-fetch';
import { connectToDatabase } from '../utils/db.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

const DELETE_API_URL = 'https://restapi.mat.web.id/api/pterodactyl/delete';

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    console.log("Error: No token provided.");
    return res.status(401).json({ success: false, message: 'Access Denied: No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Error: Invalid token.", err);
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid token.' });
    }
    req.user = user;
    next();
  });
}

export default async function handler(req, res) {
  await authenticateToken(req, res, async () => {
    if (!req.user) return;
    
    console.log("Log 1: Authentication successful. User role:", req.user.role);

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
    }

    const { idServer } = req.query;

    if (!idServer) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }
    
    console.log("Log 2: Parameters received. idServer:", idServer);

    try {
      const db = await connectToDatabase();
      const userPanelsCollection = db.collection('userPanels');
      const panelConfigsCollection = db.collection('panelConfigs');

      // VERIFIKASI DIBATALKAN: HANYA MENCARI BERDASARKAN IDSERVER
      const query = { idServer: idServer };
      
      console.log("Log Diagnostik: Query yang digunakan:", JSON.stringify(query));
      
      const panelToDelete = await userPanelsCollection.findOne(query);

      if (!panelToDelete) {
        console.log("Log 3: Panel NOT FOUND in local database. Returning 404.");
        return res.status(404).json({ success: false, message: 'Panel tidak ditemukan.' });
      }
      
      console.log("Log 4: Panel found in local database. Type:", panelToDelete.panelType);

      const config = await panelConfigsCollection.findOne({ type: panelToDelete.panelType });
      if (!config) {
        console.log("Log 5: Panel configuration NOT FOUND. Returning 404.");
        return res.status(404).json({ success: false, message: 'Panel configuration not found.' });
      }
      
      console.log("Log 6: Configuration found. Domain:", config.domain);

      const finalDeleteUrl = `${DELETE_API_URL}?idserver=${encodeURIComponent(idServer)}&domain=${encodeURIComponent(config.domain)}&ptla=${encodeURIComponent(config.ptla)}`;
      console.log("Log 7: Calling external API:", finalDeleteUrl);
      
      const deleteResponse = await fetch(finalDeleteUrl);
      console.log("Log 8: External API response status:", deleteResponse.status);

      if (deleteResponse.status === 200) {
        const deleteResult = await userPanelsCollection.deleteOne({ _id: panelToDelete._id });
        if (deleteResult.deletedCount === 1) {
            console.log("Log 9: Panel deleted from local database.");
            return res.status(200).json({ success: true, message: 'Panel berhasil dihapus.' });
        } else {
            console.log("Log 10: Failed to delete panel from local database.");
            return res.status(500).json({ success: false, message: 'Panel berhasil dihapus dari server eksternal, tetapi gagal dari database lokal.' });
        }
      } else {
        const deleteData = await deleteResponse.json();
        console.log("Log 11: External API returned an error:", deleteData);
        return res.status(deleteResponse.status || 500).json({ success: false, message: deleteData.message || 'Gagal menghapus panel dari API eksternal.' });
      }

    } catch (error) {
      console.error('Log 12: CRITICAL Error in delete-panel.js:', error);
      res.status(500).json({ success: false, message: `Internal Server Error: ${error.message}` });
    }
  });
        }
