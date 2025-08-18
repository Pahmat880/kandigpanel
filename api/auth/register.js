// api/auth/register.js
import { connectToDatabase } from '../../utils/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
  }

  const { username, password, role, accountType } = req.body;

  if (!username || !password || !role || !accountType) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  
  if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
  }

  const validAccountTypes = ['reguler', 'premium', 'eksklusif'];
  if (!validAccountTypes.includes(accountType) && accountType !== 'admin') {
      return res.status(400).json({ success: false, message: 'Invalid account type.' });
  }
  
  if (role === 'admin' && accountType !== 'admin') {
      return res.status(400).json({ success: false, message: 'Admin role must have admin account type.' });
  }
  if (role === 'user' && accountType === 'admin') {
      return res.status(400).json({ success: false, message: 'User role cannot have admin account type.' });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      username,
      password: hashedPassword,
      role,
      accountType,
      accountId: uuidv4(),
      createdAt: new Date(),
      lastLogin: null
    };

    await usersCollection.insertOne(newUser);
    
    res.status(201).json({ success: true, message: 'User created successfully.', userDetails: { username: newUser.username, password: password, accountType: newUser.accountType } });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
