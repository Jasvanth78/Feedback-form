// Backend/Routes/PasswordReset.js
const express = require('express');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb'); // uses mongodb package (already in deps)
const nodemailer = require('nodemailer');
const { PrismaClient } = require('../generated/prisma'); // for user lookup/update
const prisma = new PrismaClient();

const router = express.Router();

// Configure mailer (example using Mailtrap or environment variables)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper: connect to same Mongo DB that Prisma uses (use DATABASE_URL)
const mongoUrl = process.env.DATABASE_URL; // e.g. mongodb+srv://...

// If no DATABASE_URL is provided or Mongo fails, fall back to an in-memory store
let useInMemoryStore = false;
const inMemoryResetStore = new Map(); // key: tokenHash, value: record

let client;
if (!mongoUrl) {
  console.warn('PASSWORD RESET: No DATABASE_URL found — using in-memory reset store (dev only)');
  useInMemoryStore = true;
} else {
  try {
    client = new MongoClient(mongoUrl);
  } catch (err) {
    console.error('PASSWORD RESET: Failed to create MongoClient, falling back to in-memory store', err);
    useInMemoryStore = true;
  }
}

async function getPasswordResetCollection() {
  if (useInMemoryStore) {
    // Provide a tiny shim with insertOne/findOne/deleteOne
    return {
      insertOne: async (doc) => {
        inMemoryResetStore.set(doc.tokenHash, { ...doc, _id: doc._id || doc.tokenHash });
        return { acknowledged: true, insertedId: doc._id || doc.tokenHash };
      },
      findOne: async (query) => {
        if (query.tokenHash) {
          return inMemoryResetStore.get(query.tokenHash) || null;
        }
        // fallback search by userId
        for (const v of inMemoryResetStore.values()) {
          if (v.userId === query.userId) return v;
        }
        return null;
      },
      deleteOne: async (query) => {
        if (query._id) {
          // _id in our shim is tokenHash or provided id
          return { deletedCount: inMemoryResetStore.delete(query._id) ? 1 : 0 };
        }
        if (query.tokenHash) {
          return { deletedCount: inMemoryResetStore.delete(query.tokenHash) ? 1 : 0 };
        }
        return { deletedCount: 0 };
      }
    };
  }

  // real MongoClient path
  if (client && client.connect) {
    if (!client.topology || !client.topology.isConnected()) {
      // connect once
      await client.connect();
    }
    const db = client.db(); // default DB from connection string
    return db.collection('password_resets'); // new collection
  }

  // as a last resort fall back to in-memory
  console.warn('PASSWORD RESET: MongoClient not available — falling back to in-memory store');
  useInMemoryStore = true;
  return getPasswordResetCollection();
}

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: 'Email required' });

    // find user (prisma)
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond 200 so we don't leak whether email exists
    if (!user) {
      // Optionally create a tiny delay to make timing similar
      return res.json({ message: 'If the email exists, a reset link will be sent' });
    }

    // Generate token (plain token to send, hashed token to store)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // store in password_resets collection
    const col = await getPasswordResetCollection();
    await col.insertOne({
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date()
    });

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}&id=${user.id}`;

    // send email (don't fail the whole request if mail sending fails)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@example.com',
        to: user.email,
        subject: 'Password reset request',
        html: `<p>You requested a password reset. Click the link below to reset your password (valid 1 hour):</p>
               <p><a href="${resetLink}">Reset password</a></p>`
      });
    } catch (mailErr) {
      console.warn('PASSWORD RESET: failed to send email, continuing without failing request', mailErr)
      // fallthrough — still return a success response to the client
    }

    return res.json({ message: 'If the email exists, a reset link will be sent' });
  } catch (err) {
    console.error('forgot-password error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  const { userId, token, newPassword } = req.body;
  try {
    if (!userId || !token || !newPassword) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const col = await getPasswordResetCollection();

    // find a matching record
    const record = await col.findOne({ userId, tokenHash });

    if (!record) return res.status(400).json({ message: 'Invalid or expired token' });
    if (new Date() > new Date(record.expiresAt)) {
      // cleanup expired token
      await col.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Token expired' });
    }

    // Hash new password and update user
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });

    // remove token record
    await col.deleteOne({ _id: record._id });

    return res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('reset-password error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;