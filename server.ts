import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Request logging for debugging in Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

/* =========================
   GOOGLE SHEETS FUNCTION
========================= */
async function saveToGoogleSheet(data: any, type: 'qna' | 'contact') {
  console.log(`➡️ Saving ${type} data to Google Sheets...`);

  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID_QNA,
    GOOGLE_SHEET_ID_CONTACT,
  } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    const msg = 'Missing Google Service Account credentials (EMAIL or PRIVATE_KEY)';
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }

  const sheetId = type === 'qna' ? GOOGLE_SHEET_ID_QNA : GOOGLE_SHEET_ID_CONTACT;
  if (!sheetId) {
    const msg = `Missing Google Sheet ID for ${type}`;
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }

  try {
    const privateKey = GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/\n/g, '\n')
      .replace(/^"(.*)"$/, '$1')
      .trim();

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('GOOGLE_PRIVATE_KEY is missing the "BEGIN PRIVATE KEY" marker. Ensure you copied the entire key from the JSON file.');
    }

    // Initialize auth
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); // loads document properties and worksheets

    // Use the first sheet (index 0) or find by title
    const sheetTitle = type === 'qna' ? 'doubts' : 'contactform';
    let sheet = doc.sheetsByTitle[sheetTitle];
    
    // Fallback to first sheet if title doesn't match
    if (!sheet) {
      if (doc.sheetCount > 0) {
        sheet = doc.sheetsByIndex[0];
        console.log(`⚠️ Sheet '${sheetTitle}' not found, using first sheet: '${sheet.title}'`);
      } else {
        throw new Error(`No sheets found in document ${sheetId}`);
      }
    }

    if (sheet.headerValues.length === 0) {
      const headers = type === 'qna' 
        ? ['Name', 'Phone', 'Category', 'Question'] 
        : ['Full Name', 'Email', 'Message'];
      await sheet.setHeaderRow(headers);
      console.log(`✅ Set headers for ${type} sheet: ${headers.join(', ')}`);
    }

    let rowData = {};
    if (type === 'qna') {
      rowData = {
        'Name': data.name || '',
        'Phone': data.phone || '',
        'Category': data.category || '',
        'Question': data.question || '',
      };
    } else {
      rowData = {
        'Full Name': data.fullName || '',
        'Email': data.email || '',
        'Message': data.message || '',
      };
    }

    await sheet.addRow(rowData);
    console.log(`✅ ${type} saved successfully to Google Sheet: ${sheet.title}`);
  } catch (error: any) {
    console.error(`❌ Error saving ${type} to Google Sheets:`, error.message);
    throw error; // Rethrow to allow the route handler to catch it
  }
}

/* =========================
   API ROUTES
========================= */

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    env: {
      email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: !!process.env.GOOGLE_PRIVATE_KEY,
      sheetQna: !!process.env.GOOGLE_SHEET_ID_QNA,
      sheetContact: !!process.env.GOOGLE_SHEET_ID_CONTACT
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

app.post('/api/qna', async (req, res) => {
  try {
    await saveToGoogleSheet(req.body, 'qna');
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ QnA error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   VITE / VERCEL SETUP
========================= */

async function setupServer() {
  // Check environment variables
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID_QNA,
    GOOGLE_SHEET_ID_CONTACT,
  } = process.env;

  console.log('--- Environment Variable Check ---');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? '✅ Present' : '❌ Missing');
  if (GOOGLE_PRIVATE_KEY) {
    const isWellFormed = GOOGLE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY') && GOOGLE_PRIVATE_KEY.includes('END PRIVATE KEY');
    console.log('GOOGLE_PRIVATE_KEY Format:', isWellFormed ? '✅ Well-formed' : '❌ Missing BEGIN/END markers');
    console.log('GOOGLE_PRIVATE_KEY Length:', GOOGLE_PRIVATE_KEY.length, 'characters');
  }
  console.log('GOOGLE_SHEET_ID_QNA:', GOOGLE_SHEET_ID_QNA ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_SHEET_ID_CONTACT:', GOOGLE_SHEET_ID_CONTACT ? '✅ Present' : '❌ Missing');
  console.log('---------------------------------');

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files if NOT on Vercel (Vercel handles this via vercel.json)
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
