import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import crypto from 'crypto';
import admin from 'firebase-admin';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin (project ID only — sufficient for verifyIdToken)
try {
  const firebaseConfigJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId;
  
  if (projectId) {
    admin.initializeApp({
      projectId,
    });
    console.log('✅ Firebase Admin initialized (projectId:', projectId, ')');
  } else {
    console.warn('⚠️ Firebase Admin NOT initialized (missing projectId)');
  }
} catch (error: any) {
  console.error('❌ Firebase Admin initialization error:', error.message);
}

// Admin Emails (Mirroring firebase.ts for server-side verification)
const ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
  "vedantranjeetjadhav@gmail.com",
  "abhijeetgaikwad1904@gmail.com",
  "muthalrishikesh2006@gmail.com",
  "adityasahane076@gmail.com"
];

// Auth Middleware
export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken & { isAdmin: boolean };
}

const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const isAdmin = decodedToken.email ? ADMIN_EMAILS.includes(decodedToken.email) : false;
    req.user = { ...decodedToken, isAdmin };
    next();
  } catch (error: any) {
    console.error('❌ Auth error:', error.message);
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

// Request logging
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

/* =========================
   GOOGLE SHEETS HELPERS
========================= */

function getSheetAuth() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Service Account credentials');
  }
  const privateKey = GOOGLE_PRIVATE_KEY
    .replace(/\\n/g, '\n')
    .replace(/^"(.*)"$/, '$1')
    .trim();
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_PRIVATE_KEY is malformed');
  }
  return new JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheet(sheetId: string, tabName: string, defaultHeaders: string[]) {
  const auth = getSheetAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[tabName];
  if (!sheet) {
    // Create the tab if it doesn't exist
    sheet = await doc.addSheet({ title: tabName, headerValues: defaultHeaders });
    console.log(`✅ Created new sheet tab: ${tabName}`);
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow(defaultHeaders);
    }
  }
  return sheet;
}

async function getQnaSheetId() {
  const id = process.env.GOOGLE_SHEET_ID_QNA;
  if (!id) throw new Error('Missing GOOGLE_SHEET_ID_QNA');
  return id;
}

/* =========================
   EMAIL HELPER
========================= */

function createEmailTransporter() {
  const email = process.env.SMTP_EMAIL;
  const password = process.env.SMTP_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️ SMTP_EMAIL or SMTP_PASSWORD not set — emails will not be sent');
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: password },
  });
}

async function sendReplyEmail(
  studentEmail: string,
  studentName: string,
  founderName: string,
  originalDoubt: string,
  category: string,
  adminReply: string
) {
  const transporter = createEmailTransporter();
  if (!transporter) return;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 40px 20px;">
      <div style="background: #1B4332; border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: white; font-size: 24px; margin: 0; letter-spacing: 2px;">NISHCHAY DEFENCE</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 8px; letter-spacing: 3px;">FOUNDER'S RESPONSE</p>
      </div>
      <div style="background: white; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">Hi <strong>${studentName}</strong>,</p>
        <p style="color: #1a1a1a; font-size: 16px; font-weight: 700; margin: 0 0 24px;">
          <strong>${founderName}</strong> responded to your doubt!
        </p>
        <div style="background: #f3f4f6; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
          <p style="color: #9ca3af; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px;">YOUR DOUBT · ${category}</p>
          <p style="color: #374151; font-size: 14px; margin: 0;">${originalDoubt}</p>
        </div>
        <div style="background: #f0fdf4; border-radius: 16px; padding: 20px; border: 1px solid #bbf7d0;">
          <p style="color: #15803d; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px;">FOUNDER'S RESPONSE</p>
          <p style="color: #166534; font-size: 14px; margin: 0;">${adminReply}</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
          Visit the Doubts page on our website to continue the conversation.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Nishchay Defence" <${process.env.SMTP_EMAIL}>`,
      to: studentEmail,
      subject: `${founderName} responded to your doubt`,
      html,
    });
    console.log(`📧 Email sent to ${studentEmail}`);
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${studentEmail}:`, error.message);
  }
}

/* =========================
   DOUBT API ROUTES
========================= */

const DOUBT_HEADERS = ['ID', 'Name', 'Email', 'Category', 'Question', 'Status', 'Date', 'UID'];
const MESSAGE_HEADERS = ['DoubtID', 'SenderName', 'Message', 'IsAdmin', 'Date'];

// POST /api/doubts — Submit a new doubt (Authenticated)
app.post('/api/doubts', authenticate as any, async (req: AuthRequest, res) => {
  try {
    const { name, email, category, question } = req.body;
    if (!name || !email || !question) {
      return res.status(400).json({ success: false, error: 'name, email, and question are required' });
    }

    // Security check: Verify email matches token
    if (req.user?.email && req.user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Forbidden: Email mismatch' });
    }

    const sheetId = await getQnaSheetId();
    const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
    const messagesSheet = await getSheet(sheetId, 'messages', MESSAGE_HEADERS);

    const doubtId = crypto.randomUUID();
    const now = new Date().toISOString();

    await doubtsSheet.addRow({
      ID: doubtId,
      Name: name,
      Email: email,
      Category: category || 'General',
      Question: question,
      Status: 'pending',
      Date: now,
      UID: req.user?.uid || '',
    });

    await messagesSheet.addRow({
      DoubtID: doubtId,
      SenderName: name,
      Message: question,
      IsAdmin: 'false',
      Date: now,
    });

    res.json({ success: true, doubtId });
  } catch (error: any) {
    console.error('❌ POST /api/doubts error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/doubts — Fetch doubts (Authenticated)
app.get('/api/doubts', authenticate as any, async (req: AuthRequest, res) => {
  try {
    const sheetId = await getQnaSheetId();
    const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
    const rows = await doubtsSheet.getRows();

    let doubts = rows.map((row) => ({
      id: row.get('ID') || '',
      name: row.get('Name') || '',
      email: row.get('Email') || '',
      category: row.get('Category') || '',
      question: row.get('Question') || '',
      status: row.get('Status') || 'pending',
      date: row.get('Date') || '',
      uid: row.get('UID') || '',
    })).filter(d => d.id);

    // Visibility Security
    if (!req.user?.isAdmin) {
      // Students only see their own doubts (by email or UID)
      const userEmail = req.user?.email?.toLowerCase();
      doubts = doubts.filter(d => d.email.toLowerCase() === userEmail || (req.user?.uid && d.uid === req.user.uid));
    }

    // Sort: newest first
    doubts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, doubts });
  } catch (error: any) {
    console.error('❌ GET /api/doubts error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/doubts/:id/messages — Fetch messages (Authenticated)
app.get('/api/doubts/:id/messages', authenticate as any, async (req: AuthRequest, res) => {
  try {
    const doubtId = req.params.id;
    const sheetId = await getQnaSheetId();
    
    // Security: Verify user can access this doubt
    if (!req.user?.isAdmin) {
      const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
      const rows = await doubtsSheet.getRows();
      const doubt = rows.find(r => r.get('ID') === doubtId);
      if (!doubt || (doubt.get('Email').toLowerCase() !== req.user?.email?.toLowerCase() && doubt.get('UID') !== req.user?.uid)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      }
    }

    const messagesSheet = await getSheet(sheetId, 'messages', MESSAGE_HEADERS);
    const rows = await messagesSheet.getRows();

    const messages = rows
      .filter(row => row.get('DoubtID') === doubtId)
      .map(row => ({
        doubtId: row.get('DoubtID') || '',
        senderName: row.get('SenderName') || '',
        message: row.get('Message') || '',
        isAdmin: row.get('IsAdmin') === 'true',
        date: row.get('Date') || '',
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({ success: true, messages });
  } catch (error: any) {
    console.error('❌ GET /api/doubts/:id/messages error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/doubts/:id/reply — Reply (Authenticated)
app.post('/api/doubts/:id/reply', authenticate as any, async (req: AuthRequest, res) => {
  try {
    const { senderName, message, isAdmin } = req.body;
    if (!senderName || !message) {
      return res.status(400).json({ success: false, error: 'senderName and message are required' });
    }

    // Security: Only admins can send isAdmin: true
    if (isAdmin && !req.user?.isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const sheetId = await getQnaSheetId();
    
    // Security: Verify student owns the doubt
    if (!isAdmin) {
      const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
      const doubtRows = await doubtsSheet.getRows();
      const doubtRow = doubtRows.find(row => row.get('ID') === req.params.id);
      if (!doubtRow || (doubtRow.get('Email').toLowerCase() !== req.user?.email?.toLowerCase() && doubtRow.get('UID') !== req.user?.uid)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      }
    }

    const messagesSheet = await getSheet(sheetId, 'messages', MESSAGE_HEADERS);
    const now = new Date().toISOString();

    await messagesSheet.addRow({
      DoubtID: req.params.id,
      SenderName: senderName,
      Message: message,
      IsAdmin: isAdmin ? 'true' : 'false',
      Date: now,
    });

    // Admin reply logic
    if (isAdmin) {
      const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
      const doubtRows = await doubtsSheet.getRows();
      const doubtRow = doubtRows.find(row => row.get('ID') === req.params.id);

      if (doubtRow) {
        doubtRow.set('Status', 'resolved');
        await doubtRow.save();

        sendReplyEmail(doubtRow.get('Email'), doubtRow.get('Name'), senderName, doubtRow.get('Question'), doubtRow.get('Category'), message)
          .catch(err => console.error('Email send failed:', err));
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ POST /api/doubts/:id/reply error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/doubts/:id/status — Status (Admin Only)
app.patch('/api/doubts/:id/status', authenticate as any, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ success: false, error: 'Admin only' });

    const { status } = req.body;
    if (!['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const sheetId = await getQnaSheetId();
    const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
    const rows = await doubtsSheet.getRows();
    const row = rows.find(r => r.get('ID') === req.params.id);

    if (!row) return res.status(404).json({ success: false, error: 'Not found' });

    row.set('Status', status);
    await row.save();
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ PATCH /api/doubts/:id/status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/doubts/:id — Delete (Admin Only)
app.delete('/api/doubts/:id', authenticate as any, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ success: false, error: 'Admin only' });

    const doubtId = req.params.id;
    const sheetId = await getQnaSheetId();
    
    // Delete from doubts tab
    const doubtsSheet = await getSheet(sheetId, 'doubts', DOUBT_HEADERS);
    const doubtRows = await doubtsSheet.getRows();
    const doubtRow = doubtRows.find(r => r.get('ID') === doubtId);
    if (doubtRow) await doubtRow.delete();

    // Delete messages from messages tab
    const messagesSheet = await getSheet(sheetId, 'messages', MESSAGE_HEADERS);
    const messageRows = await messagesSheet.getRows();
    for (const row of messageRows) {
      if (row.get('DoubtID') === doubtId) {
        await row.delete();
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ DELETE /api/doubts/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   LEGACY API ROUTES
========================= */

async function saveToGoogleSheet(data: any, type: 'qna' | 'contact') {
  const sheetId = type === 'contact' ? process.env.GOOGLE_SHEET_ID_CONTACT : await getQnaSheetId();
  if (!sheetId) throw new Error(`Missing Google Sheet ID for ${type}`);

  const tabName = type === 'qna' ? 'doubts' : 'contactform';
  const headers = type === 'qna'
    ? ['Name', 'Phone', 'Category', 'Question']
    : ['Full Name', 'Email', 'Message'];
  const sheet = await getSheet(sheetId, tabName, headers);

  const rowData = type === 'qna'
    ? { Name: data.name || '', Phone: data.phone || '', Category: data.category || '', Question: data.question || '' }
    : { 'Full Name': data.fullName || '', Email: data.email || '', Message: data.message || '' };

  await sheet.addRow(rowData);
  console.log(`✅ ${type} saved to Google Sheet: ${sheet.title}`);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: !!process.env.GOOGLE_PRIVATE_KEY,
      sheetQna: !!process.env.GOOGLE_SHEET_ID_QNA,
      sheetContact: !!process.env.GOOGLE_SHEET_ID_CONTACT,
      smtp: !!process.env.SMTP_EMAIL,
      firebase: !!admin.apps.length,
    }
  });
});

app.post('/api/contact', async (req, res) => {
  try {
    await saveToGoogleSheet(req.body, 'contact');
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   VITE / VERCEL SETUP
========================= */

async function setupServer() {
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID_QNA,
    GOOGLE_SHEET_ID_CONTACT,
    SMTP_EMAIL,
  } = process.env;

  console.log('--- Environment Variable Check ---');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_SHEET_ID_QNA:', GOOGLE_SHEET_ID_QNA ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_SHEET_ID_CONTACT:', GOOGLE_SHEET_ID_CONTACT ? '✅ Present' : '❌ Missing');
  console.log('SMTP_EMAIL:', SMTP_EMAIL ? '✅ Present' : '❌ Missing');
  console.log('---------------------------------');

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

export default app;