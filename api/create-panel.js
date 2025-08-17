// api/create-panel.js

import fetch from 'node-fetch'; 
import { connectToDatabase } from '../../utils/db.js';
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

    if (req.method !== 'GET') {
      return res.status(405).json({ status: false, message: 'Method Not Allowed.' });
    }

    const { username, ram, disk, cpu, hostingPackage, panelType } = req.query;

    if (!username || !ram || !disk || !cpu || !hostingPackage || !panelType) {
      return res.status(400).json({ status: false, message: 'Missing required parameters.' });
    }

    if (req.user.role !== 'user') {
      return res.status(403).json({ status: false, message: 'Forbidden. Only users can create panels.' });
    }

    try {
      const db = await connectToDatabase();
      const userPanelsCollection = db.collection('userPanels');
      const panelConfigsCollection = db.collection('panelConfigs');

      const userAccountType = req.user.accountType;
      // Perbarui logika validasi izin berdasarkan accountType
      if (userAccountType === 'reguler' && panelType !== 'public') {
        return res.status(403).json({ status: false, message: 'Akun Anda hanya diizinkan membuat panel public.' });
      }
      if (userAccountType === 'premium' && (panelType !== 'public' && panelType !== 'private')) {
        return res.status(403).json({ status: false, message: 'Akun premium tidak bisa membuat panel exclusive.' });
      }
      if (userAccountType === 'eksklusif' && (panelType !== 'public' && panelType !== 'private')) {
          return res.status(403).json({ status: false, message: 'Akun eksklusif hanya dapat membuat panel public dan private.' });
      }

      const config = await panelConfigsCollection.findOne({ type: panelType });
      if (!config) {
        return res.status(404).json({ status: false, message: `Panel type '${panelType}' not found in configs.` });
      }

      const API_URL = 'https://restapi.mat.web.id/api/pterodactyl/create';
      const apiResponse = await fetch(`${API_URL}?username=${encodeURIComponent(username)}&ram=${encodeURIComponent(ram)}&disk=${encodeURIComponent(disk)}&cpu=${encodeURIComponent(cpu)}&egg=${encodeURIComponent(config.eggId)}&nest=${encodeURIComponent(config.nestId)}&loc=${encodeURIComponent(config.loc)}&domain=${encodeURIComponent(config.domain)}&ptla=${encodeURIComponent(config.ptla)}&ptlc=${encodeURIComponent(config.ptlc)}`);
      const apiData = await apiResponse.json();

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

        res.status(200).json(apiData);
      } else {
        res.status(apiResponse.status || 500).json(apiData || { status: false, message: 'Failed to create server via external API.' });
      }
    } catch (error) {
      console.error('Error in Vercel Serverless Function:', error);
      res.status(500).json({ status: false, message: `Internal Server Error: ${error.message}` });
    }
  });
}