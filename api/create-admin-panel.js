// api/create-admin-panel.js
import fetch from 'node-fetch';
import { connectToDatabase } from '../../utils/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ status: false, message: 'Access Denied: No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ status: false, message: 'Access Denied: Invalid token.' });
    req.user = user;
    next();
  });
}

export default async function handler(req, res) {
  await authenticateToken(req, res, async () => {
    if (!req.user) return;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden. Only administrators can create admin panels.' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ status: false, message: 'Method Not Allowed.' });
    }

    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ status: false, message: 'Missing required parameters.' });
    }
    
    try {
      const db = await connectToDatabase();
      const panelConfigsCollection = db.collection('panelConfigs');
      const config = await panelConfigsCollection.findOne({ type: 'public' });
      
      if (!config) {
        return res.status(404).json({ status: false, message: 'Public panel configuration not found in database.' });
      }

      const ADMIN_PANEL_API_URL = 'https://restapi.mat.web.id/api/pterodactyl/createadmin';
      const apiResponse = await fetch(`${ADMIN_PANEL_API_URL}?domain=${encodeURIComponent(config.domain)}&ptla=${encodeURIComponent(config.ptla)}&username=${encodeURIComponent(username)}`);
      const apiData = await apiResponse.json();
      
      if (apiResponse.ok && apiData.status) {
        res.status(200).json(apiData);
      } else {
        res.status(apiResponse.status || 500).json(apiData || { status: false, message: 'Failed to create admin panel via external API.' });
      }
      
    } catch (error) {
      console.error('Error in create-admin-panel.js:', error);
      res.status(500).json({ status: false, message: `Internal Server Error: ${error.message}` });
    }
  });
}