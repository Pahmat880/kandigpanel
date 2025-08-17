// api/create-panel.js

import fetch from 'node-fetch'; 
import { connectToDatabase } from '../utils/db.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';
const VERCEL_BASE_URL = process.env.VERCEL_BASE_URL;

function escapeHTML(str) {
  return str.replace(/[&<>\"']/g, function(tag) {
    var charsToReplace = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      "\'": '&#039;'
    };
    return charsToReplace[tag] || tag;
  });
}

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    console.log("Error: No token provided.");
    return res.status(401).json({ status: false, message: 'Access Denied: No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Error: Invalid token.", err);
      return res.status(403).json({ status: false, message: 'Access Denied: Invalid token.' });
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
      return res.status(405).json({ status: false, message: 'Method Not Allowed.' });
    }

    const { username, ram, disk, cpu, hostingPackage, panelType } = req.query;

    if (!username || !ram || !disk || !cpu || !hostingPackage || !panelType) {
      console.log("Error: Missing required parameters.");
      return res.status(400).json({ status: false, message: 'Missing required parameters.' });
    }
    
    console.log("Log 2: Parameters received. Panel Type:", panelType);

    if (req.user.role !== 'user') {
      return res.status(403).json({ status: false, message: 'Forbidden. Only users can create panels.' });
    }

    try {
      const db = await connectToDatabase();
      const userPanelsCollection = db.collection('userPanels');
      const panelConfigsCollection = db.collection('panelConfigs');
      
      console.log("Log 3: Connected to database.");

      const userAccountType = req.user.accountType;
      // Perbaiki logika validasi peran
      if (userAccountType === 'reguler' && panelType !== 'public') {
        return res.status(403).json({ status: false, message: 'Akun reguler hanya diizinkan membuat panel public.' });
      }
      if (userAccountType === 'premium' && panelType !== 'private') {
        return res.status(403).json({ status: false, message: 'Akun premium hanya diizinkan membuat panel private.' });
      }
      if (userAccountType === 'eksklusif' && (panelType !== 'public' && panelType !== 'private')) {
          return res.status(403).json({ status: false, message: 'Akun eksklusif hanya dapat membuat panel public dan private.' });
      }

      console.log("Log 4: User account type validated.");

      const config = await panelConfigsCollection.findOne({ type: panelType });
      if (!config) {
        console.log("Error: Panel configuration not found for type", panelType);
        return res.status(404).json({ status: false, message: `Panel type '${panelType}' not found in configs.` });
      }
      
      console.log("Log 5: Found configuration:", config.type);

      const API_URL = 'https://restapi.mat.web.id/api/pterodactyl/create';
      
      // Menggunakan URLSearchParams untuk memastikan parameter terisi dengan benar
      const params = new URLSearchParams({
        username: username,
        ram: ram,
        disk: disk,
        cpu: cpu,
        egg: config.eggId,
        nest: config.nestId,
        loc: config.loc,
        domain: config.domain,
        ptla: config.ptla,
        ptlc: config.ptlc
      });

      const finalUrl = `${API_URL}?${params.toString()}`;
      console.log("Log 6: Final URL for Pterodactyl API call:", finalUrl);

      const apiResponse = await fetch(finalUrl);
      
      console.log("Log 7: Pterodactyl API call sent. Status:", apiResponse.status);
      const apiData = await apiResponse.json();
      console.log("Log 8: Pterodactyl API response:", apiData);

      if (apiResponse.ok && apiData.status) {
        await userPanelsCollection.insertOne({
          userId: new ObjectId(req.user.id),
          idServer: apiData.result.id_server,
          idUser: apiData.result.id_user,
          username: apiData.result.username,
          domain: apiData.result.domain,
          panelType: panelType,
          createdAt: new Date()
        });
        
        console.log("Log 9: Panel details saved to database.");

        const escapedUsername = escapeHTML(apiData.result.username);
        const escapedPassword = escapeHTML(apiData.result.password);
        const escapedDomain = escapeHTML(apiData.result.domain);
        
        const notificationMessage = `
✅ <b>Panel Baru Dibuat!</b>
------------------------------
👤 Dibuat oleh: <b>${req.user.username}</b>
📦 Paket: <b>${hostingPackage.toUpperCase()}</b>
⚙️ Tipe Panel: <b>${panelType.toUpperCase()}</b>
------------------------------
Detail Akun:
👤 Username: <b>${escapedUsername}</b>
🔑 Password: <b>${escapedPassword}</b>
🔗 Domain: ${escapedDomain}
------------------------------
ID User: ${apiData.result.id_user}
Server ID: ${apiData.result.id_server}
`;
        
        await fetch(`${VERCEL_BASE_URL}/api/send-telegram-notification`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: notificationMessage }),
        });
        console.log("Log 10: Telegram notification sent.");

        res.status(200).json(apiData);
      } else {
        res.status(apiResponse.status || 500).json(apiData || { status: false, message: 'Failed to create server via external API.' });
      }
    } catch (error) {
      console.error('Log 11: CRITICAL Error in Vercel Serverless Function:', error);
      res.status(500).json({ status: false, message: `Internal Server Error: ${error.message}` });
    }
  });
}
