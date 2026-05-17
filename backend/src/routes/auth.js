import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { passphrase } = req.body;

    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase is required' });
    }

    if (!config.authPassphraseHash) {
      return res.status(500).json({ error: 'Server authentication not configured' });
    }

    const isValid = await bcrypt.compare(passphrase, config.authPassphraseHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid passphrase' });
    }

    const token = jwt.sign({ authenticated: true }, config.jwtSecret, { expiresIn: '24h' });

    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ valid: false });
  }

  const token = authHeader.slice(7);

  try {
    jwt.verify(token, config.jwtSecret);
    return res.json({ valid: true });
  } catch (err) {
    return res.json({ valid: false });
  }
});

export default router;
