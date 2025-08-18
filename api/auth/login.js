// api/auth/login.js
import { connectToDatabase } from '../../utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const payload = {
      id: user.accountId, // Token sekarang berisi accountId
      username: user.username,
      role: user.role,
      accountType: user.accountType
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    
    await usersCollection.updateOne(
        { _id: new ObjectId(user._id) },
        { $set: { lastLogin: new Date() } }
    );

    res.status(200).json({ success: true, token, user: payload });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
