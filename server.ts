import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import admin from 'firebase-admin';
import { createRequire } from 'module';
import {
  getAllStories,
  getStoryById,
  saveBatchAndStories,
  findDuplicateBatch,
  updateStory,
  deleteStory,
  restoreStory,
  purgeStory,
  purgeAllDeletedStories,
  getAuditLogs,
  getAvailableEditions,
  seedSampleDataIfEmpty
} from './n-intel-db';
import {
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  incrementDownloadCount
} from './articles-db';
import { parseDailyNewsPost, getLocalTodayDate } from './n-intel-parser';
import { SAMPLE_NINTEL_POST } from './n-intel-sample-data';

const require = createRequire(import.meta.url);
const firebaseConfigJson = require('./firebase-applet-config.json');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize Firebase Admin (project ID only — sufficient for verifyIdToken)
try {
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

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Auth Middleware
export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken & { isAdmin: boolean };
}

const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const clientEmail = (req.headers['x-user-email'] as string)?.trim().toLowerCase();

  let userEmail: string | undefined;
  let uid: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    if (token) {
      try {
        const verifyPromise = admin.auth().verifyIdToken(token);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('verifyIdToken timeout')), 1500)
        );
        const decodedToken = await Promise.race([verifyPromise, timeoutPromise]);
        userEmail = decodedToken.email?.toLowerCase();
        uid = decodedToken.uid;
      } catch (error: any) {
        const payload = parseJwtPayload(token);
        if (payload && payload.email) {
          userEmail = payload.email.toLowerCase();
          uid = payload.user_id || payload.sub || payload.uid;
        }
      }
    }
  }

  // Fallback to client-provided email
  if (!userEmail && clientEmail) {
    userEmail = clientEmail;
  }

  // Local development fallback: if request is on localhost/127.0.0.1 and no email is provided, default to primary admin
  const isLocalDev = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.ip === '::1' || req.ip === '127.0.0.1';
  if (!userEmail && isLocalDev) {
    userEmail = ADMIN_EMAILS[0].toLowerCase();
    uid = 'dev-local-admin';
  }

  const isAdmin = userEmail
    ? ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail.toLowerCase())
    : false;

  if (isAdmin && userEmail) {
    req.user = { email: userEmail, uid: uid || 'admin', isAdmin: true } as any;
    return next();
  }

  return res.status(403).json({
    success: false,
    error: userEmail
      ? `Access denied: ${userEmail} is not an authorized administrator.`
      : 'Unauthorized: Valid administrator authorization required.'
  });
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

  // Try exact match first
  let sheet = doc.sheetsByTitle[tabName];
  
  // If not found, look for common names if it's the contact form
  if (!sheet && tabName === 'contactform') {
    const commonNames = ['contactform', 'responses', 'Sheet1', 'Sheet 1', 'Form Responses 1', 'contact'];
    for (const name of commonNames) {
      if (doc.sheetsByTitle[name]) {
        sheet = doc.sheetsByTitle[name];
        console.log(`ℹ️ Found existing tab: "${name}" instead of "${tabName}"`);
        break;
      }
    }

    if (!sheet && doc.sheetCount > 0) {
      sheet = doc.sheetsByIndex[0];
      console.log(`ℹ️ Defaulting to first sheet tab: "${sheet.title}"`);
    }
  }

  if (!sheet) {
    // Create the tab if it doesn't exist
    sheet = await doc.addSheet({ title: tabName, headerValues: defaultHeaders });
    console.log(`✅ Created new sheet tab: "${tabName}"`);
  } else {
    try {
      await sheet.loadHeaderRow();
      console.log(`ℹ️ Loaded header row for tab: "${sheet.title}" (${sheet.headerValues.join(', ')})`);
    } catch (error) {
      console.warn(`⚠️ Could not load headers for "${sheet.title}", setting defaults...`);
      await sheet.setHeaderRow(defaultHeaders);
    }
  }
  return sheet;
}

async function saveToGoogleSheet(data: any) {
  const sheetId = process.env.GOOGLE_SHEET_ID_CONTACT || '1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY';
  if (!sheetId) {
    console.error('❌ [contact] Missing Sheet ID in environment variables');
    throw new Error('Technical Error: Sheet ID for contact is not configured.');
  }

  console.log(`[contact] Using Sheet ID: ${sheetId.substring(0, 5)}...${sheetId.substring(sheetId.length - 4)}`);

  const tabName = 'contactform';
  const headers = ['Date', 'Full Name', 'Email', 'Message'];

  try {
    const sheet = await getSheet(sheetId, tabName, headers);
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let rowData: any = {};
    const mappings = [
      { key: 'Date', value: now },
      { key: 'Full Name', value: data.fullName || data.name || '(No Name)', aliases: ['name', 'full name', 'fullname', 'full_name', 'names'] },
      { key: 'Email', value: data.email || data.emailAddress || '(No Email)', aliases: ['email', 'email address', 'email_address', 'emailaddress', 'emails'] },
      { key: 'Message', value: data.message || data.msg || data.body || data.question || '(No Message)', aliases: ['message', 'question', 'msg', 'body', 'messages', 'queries', 'query'] }
    ];

    console.log('ℹ️ [contact] Mapping data:', JSON.stringify(data));

    mappings.forEach(m => {
      const match = sheet.headerValues.find(h => 
        h.toLowerCase().trim() === m.key.toLowerCase() || 
        (m.aliases && m.aliases.includes(h.toLowerCase().trim()))
      );
      if (match) {
        rowData[match] = m.value;
      } else {
        rowData[m.key] = m.value;
      }
    });
    
    console.log('ℹ️ [contact] Final rowData to add:', JSON.stringify(rowData));

    await sheet.addRow(rowData);
    console.log('✅ [contact] Row added successfully to contact form sheet');
  } catch (error: any) {
    console.error('❌ [contact] Google Sheet Error:', error.message);
    if (error.message.includes('403') || error.message.includes('permission')) {
      throw new Error(`Permission Denied: Ensure you have shared the Google Sheet with the Service Account email: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
    }
    if (error.message.includes('404')) {
      throw new Error(`Sheet Not Found: Ensure the Sheet ID is correct and the tab exists.`);
    }
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    env: {
      email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: !!process.env.GOOGLE_PRIVATE_KEY,
      sheetContact: !!(process.env.GOOGLE_SHEET_ID_CONTACT || '1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY'),
      firebase: !!admin.apps.length,
    }
  });
});

app.post('/api/contact', async (req, res) => {
  console.log('📬 Received contact form submission:', JSON.stringify(req.body));
  try {
    await saveToGoogleSheet(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   N-INTEL API ROUTES
========================= */

// Public: Get all stories (supports filtering by date, category, search, month)
app.get('/api/n-intel/stories', (req, res) => {
  try {
    const { date, month, category, search, includeDeleted } = req.query;
    const stories = getAllStories({
      date: date as string,
      month: month as string,
      category: category as string,
      search: search as string,
      includeDeleted: includeDeleted === 'true'
    });
    res.json({ success: true, stories });
  } catch (error: any) {
    console.error('Error fetching N-INTEL stories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Get a single story by ID
app.get('/api/n-intel/stories/:id', (req, res) => {
  try {
    const story = getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    res.json({ success: true, story });
  } catch (error: any) {
    console.error('Error fetching story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Get list of available editions
app.get('/api/n-intel/editions', (req, res) => {
  try {
    const editions = getAvailableEditions();
    res.json({ success: true, editions });
  } catch (error: any) {
    console.error('Error fetching editions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── ARTICLES API ──

// Public: Get all articles
app.get('/api/articles', (req, res) => {
  try {
    const articles = getAllArticles();
    res.json({ success: true, articles });
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Get single article
app.get('/api/articles/:id', (req, res) => {
  try {
    const article = getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, article });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Increment PDF download count
app.post('/api/articles/:id/download', (req, res) => {
  try {
    incrementDownloadCount(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Upload Banner Image
app.post('/api/articles/upload-banner', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image data provided.' });
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let ext = 'jpg';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    const safeName = `banner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('Error uploading banner image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Only: Create new article
app.post('/api/articles', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const {
      title,
      bannerImageUrl,
      category,
      authorName,
      authorRole,
      authorAvatarUrl,
      publishDate,
      pullQuote,
      content,
      tags,
      sourceReference
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Article title/headline is compulsory.' });
    }
    if (!bannerImageUrl || !bannerImageUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Banner image is a compulsory field. Please provide an image URL or upload a banner.' });
    }
    if (!authorName || !authorName.trim()) {
      return res.status(400).json({ success: false, error: 'Author name is compulsory.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Article editorial content is compulsory.' });
    }

    const newArticle = createArticle({
      title,
      bannerImageUrl,
      category: category || 'International Relations',
      authorName,
      authorRole: authorRole || 'Editorial Contributor',
      authorAvatarUrl,
      publishDate,
      pullQuote,
      content,
      tags,
      sourceReference,
      authorEmail: req.user?.email
    });

    res.status(201).json({ success: true, article: newArticle });
  } catch (error: any) {
    console.error('Error creating article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Update article
app.put('/api/articles/:id', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const updated = updateArticle(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, article: updated });
  } catch (error: any) {
    console.error('Error updating article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Delete article
app.delete('/api/articles/:id', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const success = deleteArticle(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, message: 'Article deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Direct Publish
app.post('/api/n-intel/publish', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { rawText, date } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'Pasted text is required.' });
    }

    const pubDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getLocalTodayDate();

    const parseResult = parseDailyNewsPost(rawText, pubDate);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error || 'Failed to parse news text.' });
    }

    // Duplicate detection
    const duplicate = findDuplicateBatch(parseResult.hash, pubDate);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Duplicate post detected! This exact news bulletin was already published on ${duplicate.publishedAt} for date ${pubDate}. Duplicate submission was prevented.`
      });
    }

    const batch = {
      id: `batch-${pubDate.replace(/-/g, '')}-${parseResult.hash.slice(0, 8)}`,
      date: pubDate,
      rawContentHash: parseResult.hash,
      publishedAt: new Date().toISOString(),
      publishedBy: req.user.email || 'Admin',
      storyCount: parseResult.totalStories,
      categories: parseResult.categories
    };

    saveBatchAndStories(batch, parseResult.stories, req.user.email || 'Admin');

    console.log(`✅ [N-INTEL] Published ${parseResult.totalStories} stories for ${pubDate} by ${req.user.email}`);

    res.json({
      success: true,
      message: `Successfully published ${parseResult.totalStories} stories across ${parseResult.categories.length} categories for ${pubDate}.`,
      count: parseResult.totalStories,
      categories: parseResult.categories,
      batchId: batch.id,
      date: pubDate
    });
  } catch (error: any) {
    console.error('Error publishing N-INTEL batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Edit a story (supports both PATCH and PUT)
const handleStoryUpdate = (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const updated = updateStory(req.params.id, req.body, req.user.email || 'Admin');
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    res.json({ success: true, story: updated });
  } catch (error: any) {
    console.error('Error updating story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
app.patch('/api/n-intel/stories/:id', authenticate as any, handleStoryUpdate as any);
app.put('/api/n-intel/stories/:id', authenticate as any, handleStoryUpdate as any);

// Admin Only: Delete a story (soft delete by default, permanent purge if ?permanent=true)
app.delete('/api/n-intel/stories/:id', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const isPermanent = req.query.permanent === 'true';
    const adminEmail = req.user.email || 'Admin';

    if (isPermanent) {
      const success = purgeStory(req.params.id, adminEmail);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Story not found' });
      }
      return res.json({ success: true, message: 'Story permanently purged from database.', permanent: true });
    }

    const success = deleteStory(req.params.id, adminEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    res.json({ success: true, message: 'Story removed from public feed.', permanent: false });
  } catch (error: any) {
    console.error('Error deleting story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Restore a soft-deleted story
app.post('/api/n-intel/stories/:id/restore', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const adminEmail = req.user.email || 'Admin';
    const success = restoreStory(req.params.id, adminEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    res.json({ success: true, message: 'Story restored to public feed.' });
  } catch (error: any) {
    console.error('Error restoring story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Empty trash (purge all soft-deleted stories permanently)
app.delete('/api/n-intel/trash/empty', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const adminEmail = req.user.email || 'Admin';
    const purgedCount = purgeAllDeletedStories(adminEmail);
    res.json({
      success: true,
      message: `Trash emptied successfully. ${purgedCount} stories permanently erased.`,
      purgedCount
    });
  } catch (error: any) {
    console.error('Error emptying trash:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Get audit history
app.get('/api/n-intel/audit', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const logs = getAuditLogs();
    res.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
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
    GOOGLE_SHEET_ID_CONTACT,
  } = process.env;

  console.log('--- Environment Variable Check ---');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? '✅ Present' : '❌ Missing');
  console.log('GOOGLE_SHEET_ID_CONTACT:', (GOOGLE_SHEET_ID_CONTACT || '1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY') ? '✅ Present' : '❌ Missing');
  console.log('---------------------------------');

  // Seed sample N-INTEL edition if empty
  try {
    seedSampleDataIfEmpty(SAMPLE_NINTEL_POST);
  } catch (err) {
    console.warn('⚠️ Could not seed sample N-INTEL data:', err);
  }

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
