// api/admin/manage-users.js
import { connectToDatabase } from '../../utils/db.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

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
      const usersCollection = db.collection('users');

      if (req.method === 'GET') {
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        return res.status(200).json({ success: true, users });
      }

      if (req.method === 'POST') {
        const { username, password, role, accountType } = req.body;
        
        if (!username || !password || !role || !accountType) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'Username already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await usersCollection.insertOne({
          username,
          password: hashedPassword,
          role,
          accountType,
          createdAt: new Date(),
          lastLogin: null
        });

        return res.status(201).json({ success: true, message: 'User created successfully.' });
      }

      if (req.method === 'PUT') {
        const { id, username, role, accountType, newPassword } = req.body;
        if (!id) {
          return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (role) updateData.role = role;
        if (accountType) updateData.accountType = accountType;
        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(newPassword, salt);
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ success: false, message: 'User not found or no changes were made.' });
        }

        return res.status(200).json({ success: true, message: 'User updated successfully.' });
      }
      
      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.status(200).json({ success: true, message: 'User deleted successfully.' });
      }

      return res.status(405).json({ success: false, message: 'Method Not Allowed.' });

    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
}