import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import admin from 'firebase-admin';
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
  deleteStoriesByDate,
  deleteStoriesByCategory,
  deleteStoriesByIds,
  getAuditLogs,
  getAvailableEditions,
  seedSampleDataIfEmpty,
  syncNIntelStories
} from './n-intel-db';
import {
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  incrementDownloadCount,
  syncArticles
} from './articles-db';
import {
  getAllPyqSessions,
  savePyqFileRecord,
  deletePyqFileRecord,
  syncPyqSessions
} from './pyq-db';
import {
  getAllNotes,
  getNotesBySubject,
  getNoteById,
  saveNote,
  deleteNote,
  syncNotes
} from './notes-db';
import { parseDailyNewsPost, getLocalTodayDate } from './n-intel-parser';
import { SAMPLE_NINTEL_POST } from './n-intel-sample-data';
import { ADMIN_EMAILS } from './admin-emails';

dotenv.config();

const app = express();
const PORT = 3000;

function validateEnvironment() {
  const required = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'VITE_FIREBASE_PROJECT_ID'];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      process.exit(1);
    }
  }
}
validateEnvironment();

// Trust Vercel / reverse-proxy headers for IP resolution and rate limiters
app.set('trust proxy', 1);

// Normalize Vercel Serverless Function rewritten paths
app.use((req: Request, res: Response, next: NextFunction) => {
  const matchedPath = req.headers['x-matched-path'] as string;
  if (matchedPath) {
    req.url = matchedPath;
  } else {
    const realUrl = req.originalUrl || req.url;
    if (realUrl && (req.url === '/api' || req.url === '/api/index' || req.url.startsWith('/api?'))) {
      req.url = realUrl;
    }
  }
  next();
});

// Security: Disable Express fingerprinting
app.disable('x-powered-by');

// Security: Enforce HTTP Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://apis.google.com",
          "https://*.firebaseapp.com",
          "https://*.gstatic.com",
          "https://accounts.google.com"
        ],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://*.google.com",
          "https://accounts.google.com",
          "https://*.unsplash.com",
          "ws:",
          "wss:"
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.google.com", "https://accounts.google.com"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // Essential for Firebase signInWithPopup so the authentication popup can communicate with the opener window
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: 'sameorigin' },
  })
);

// Security: Strict CORS Configuration with Whitelist
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://nishchaydefence.in',
  'https://www.nishchaydefence.in',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked request from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Original-Name']
  })
);

// Raw binary body parser for PDFs to prevent Base64 expansion on Serverless runtimes
app.use(express.raw({ type: 'application/pdf', limit: '10mb' }));
// Request body size limit
// A 5 MB image becomes about 6.7 MB when base64 encoded; allow modest JSON overhead.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware to catch 413 Payload Too Large / JSON parse errors from body-parser and return clean JSON
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      error: 'The request payload is too large. Banner images must be 5 MB or smaller; use a PDF or Drive link for larger documents.'
    });
  }
  if (err && err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload received.'
    });
  }
  next(err);
});

// Rate Limiters
const globalApiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 300, // 300 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: 'Too many requests from this network. Please slow down.' }
});
app.use('/api', globalApiLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: 'Submission limit reached. Please wait before submitting another message.' }
});

const downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 increments per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: 'Download limit exceeded.' }
});

const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: 'Publishing rate limit exceeded.' }
});

const IS_VERCEL = Boolean(process.env.VERCEL);
const UPLOADS_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'nishchay_uploads')
  : path.join(process.cwd(), 'public', 'uploads');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (fsErr) {
  console.warn('Could not initialize uploads directory:', fsErr);
}

app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    dotfiles: 'ignore',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  })
);



// Initialize Firebase Admin for token verification
try {
  if (!admin.apps.length) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'nishchay-defence';
    const serviceEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawServiceKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
    const serviceKey = rawServiceKey
      ? rawServiceKey.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim()
      : undefined;

    if (serviceEmail && serviceKey && serviceKey.includes('BEGIN PRIVATE KEY')) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: serviceEmail,
          privateKey: serviceKey
        }),
        projectId
      });
      console.log('✅ Firebase Admin initialized with Service Account for:', projectId);
    } else {
      admin.initializeApp({ projectId });
      console.log('✅ Firebase Admin initialized with Project ID (public cert token verification):', projectId);
    }
  }
} catch (error: any) {
  console.error('❌ Firebase Admin initialization error:', error.message);
}

// Admin Emails (Authoritative list for server-side verification)
// Helper: Validate absolute or safe relative HTTP URLs, Data URLs, and upload paths
function isValidUrlOrPath(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return true;
  }
  if (trimmed.startsWith('/uploads/') && !trimmed.includes('..')) {
    return true;
  }
  if (trimmed.startsWith('/api/uploads/') && !trimmed.includes('..')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidBannerImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('data:image/')) return value.length <= 300_000;
  return isValidUrlOrPath(value);
}

// Helper: Sanitize inputs for Google Sheets / CSV formula injection defense
function sanitizeSheetCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // If string begins with formula triggers (=, +, -, @, tab, return), escape with leading single quote
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

// Auth Middleware (Cryptographically verifies Firebase ID tokens & verifies admin role)
export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken & { isAdmin: boolean };
}

const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[SECURITY WARN] Missing or malformed Authorization header from IP: ${clientIp} for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication required with a valid Bearer token.'
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Empty token provided.'
    });
  }

  try {
    // Verify Firebase ID Token cryptographically using Google public keys
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Token contains no verified email address.'
      });
    }

    const hasAdminClaim = decodedToken.admin === true;
    const isEmailAdmin = decodedToken.email_verified === true && ADMIN_EMAILS.some(e => e.toLowerCase() === email);

    if (!hasAdminClaim && !isEmailAdmin) {
      console.warn(`[SECURITY WARN] Forbidden admin access attempt by ${email} from IP: ${clientIp}`);
      return res.status(403).json({
        success: false,
        error: `Access denied: Account ${email} is not authorized for administrative operations.`
      });
    }

    req.user = {
      ...decodedToken,
      email,
      isAdmin: true
    };

    next();
  } catch (error: any) {
    console.error(`[SECURITY ERROR] Token verification failed from IP: ${clientIp}:`, error.code || error.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication token is invalid, expired, or revoked.'
    });
  }
};

// Request logging
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});


// No-cache headers for all API routes (prevents stale CDN/browser cached responses)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
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

let contactSheetWriteQueue: Promise<unknown> = Promise.resolve();
function saveToGoogleSheet(data: any): Promise<void> {
  const result = contactSheetWriteQueue.then(() => saveToGoogleSheetNow(data));
  contactSheetWriteQueue = result.catch(() => undefined);
  return result;
}

async function saveToGoogleSheetNow(data: any): Promise<void> {
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

    console.log('ℹ️ [contact] Mapping validated submission to the contact sheet.');

    mappings.forEach(m => {
      const sanitizedVal = sanitizeSheetCell(m.value);
      const match = sheet.headerValues.find(h => 
        h.toLowerCase().trim() === m.key.toLowerCase() || 
        (m.aliases && m.aliases.includes(h.toLowerCase().trim()))
      );
      if (match) {
        rowData[match] = sanitizedVal;
      } else {
        rowData[m.key] = sanitizedVal;
      }
    });
    
    await sheet.addRow(rowData);
    console.log('✅ [contact] Row added successfully to contact form sheet');
  } catch (error: any) {
    console.error('❌ [contact] Google Sheet Error:', error.message);
    if (error.message.includes('403') || error.message.includes('permission')) {
      throw new Error(`Permission Denied: Service Account has insufficient permissions.`);
    }
    if (error.message.includes('404')) {
      throw new Error(`Sheet Not Found: Ensure the Sheet ID is correct and the tab exists.`);
    }
    throw error;
  }
}

// Health check endpoint (Information disclosure protected: internal emails stripped)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      sheetsConfigured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      firebaseConfigured: !!admin.apps.length,
    }
  });
});

// Contact Form with Strict Validation & Anti-Abuse Rate Limiter
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { fullName, name, email, emailAddress, message, msg, question } = req.body || {};
    const contactName = (fullName || name || '').trim();
    const contactEmail = (email || emailAddress || '').trim().toLowerCase();
    const contactMessage = (message || msg || question || '').trim();

    // Input validation: Name
    if (!contactName || contactName.length < 2 || contactName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid full name (between 2 and 100 characters).'
      });
    }

    // Input validation: Email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!contactEmail || !emailRegex.test(contactEmail) || contactEmail.length > 150) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    // Input validation: Message
    if (!contactMessage || contactMessage.length < 5 || contactMessage.length > 3000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be between 5 and 3000 characters.'
      });
    }

    await saveToGoogleSheet({
      fullName: contactName,
      email: contactEmail,
      message: contactMessage
    });

    res.json({ success: true, message: 'Your message has been received successfully.' });
  } catch (error: any) {
    console.error('❌ Contact submission error:', error.message);
    res.status(500).json({
      success: false,
      error: 'An error occurred while submitting your message. Please try again later.'
    });
  }
});

/* =========================
   N-INTEL API ROUTES
========================= */

// Public: Get all stories (supports filtering by date, category, search, month)
app.get('/api/n-intel/stories', (req, res, next) => {
  // Deleted stories are private moderation data; require an admin token to request them.
  if (req.query.includeDeleted === 'true') {
    return authenticate(req as AuthRequest, res, next);
  }
  next();
}, async (req: AuthRequest, res) => {
  try {
    const { date, month, category, search } = req.query;
    const includeDeleted = req.query.includeDeleted === 'true';
    if (includeDeleted && !req.user?.isAdmin) {
      return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
    }
    const stories = await getAllStories({
      date: date as string,
      month: month as string,
      category: category as string,
      search: search as string,
      includeDeleted
    });
    res.json({ success: true, stories });
  } catch (error: any) {
    console.error('Error fetching N-INTEL stories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Security: Parameter validation for all :id routes (prevents path traversal & parameter manipulation)
app.param('id', (req, res, next, id) => {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid identifier parameter format.' });
  }
  next();
});

// Public: Get a single story by ID
app.get('/api/n-intel/stories/:id', async (req, res) => {
  try {
    const story = await getStoryById(req.params.id);
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
app.get('/api/n-intel/editions', async (req, res) => {
  try {
    const editions = await getAvailableEditions();
    res.json({ success: true, editions });
  } catch (error: any) {
    console.error('Error fetching editions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── ARTICLES API ──

// Public: Get all articles
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await getAllArticles();
    res.json({ success: true, articles });
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Get single article
app.get('/api/articles/:id', async (req, res) => {
  try {
    const article = await getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, article });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Serve uploaded banner images directly under /api prefix for Vercel SPA compatibility
app.get('/api/uploads/:filename', (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(filePath)) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ success: false, error: 'File not found.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Error reading file.' });
  }
});

// Two-way synchronization: Repopulates server in-memory & /tmp storage from client cache
app.post('/api/articles/sync', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }
  try {
    const { articles } = req.body;
    if (!Array.isArray(articles)) {
      return res.status(400).json({ success: false, error: 'Articles array required.' });
    }
    if (articles.some((article: any) => typeof article?.bannerImageUrl === 'string' && article.bannerImageUrl.startsWith('data:image/') && article.bannerImageUrl.length > 300_000)) {
      return res.status(400).json({ success: false, error: 'Compressed banner image exceeds the free Firestore document limit.' });
    }
    const result = await syncArticles(articles);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error syncing articles:', error);
    res.status(500).json({ success: false, error: 'Failed to sync articles.' });
  }
});

// Public: Increment PDF download count (Rate limited to prevent counter manipulation)
app.post('/api/articles/:id/download', downloadLimiter, async (req, res) => {
  try {
    await incrementDownloadCount(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to record download count.' });
  }
});

// Admin Only: Upload Banner Image with Signature/Magic-Byte Validation
app.post('/api/articles/upload-banner', publishLimiter, authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'No image data provided.' });
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;

    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    // Strict file size boundary: 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Image size exceeds maximum limit of 5MB.' });
    }

    // Inspect Magic Bytes for safe image formats
    let ext = '';
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      ext = 'png';
    } else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      ext = 'jpg';
    } else if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      ext = 'webp';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid file signature. Only verified PNG, JPEG, and WebP images are permitted.'
      });
    }

    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const safeRandomToken = crypto.randomBytes(16).toString('hex');
      const safeName = `banner-${Date.now()}-${safeRandomToken}.${ext}`;
      if (IS_VERCEL) {
        if (imageBase64.length > 350_000) {
          return res.status(413).json({ success: false, error: 'Compressed banner is too large to store on the free Firestore plan. Reduce its dimensions or use a public image URL.' });
        }
        return res.json({ success: true, url: imageBase64, localUrl: imageBase64 });
      }
      const filePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(filePath, buffer, { flag: 'wx' });

      const publicUrl = `/api/uploads/${safeName}`;
      res.json({ success: true, url: publicUrl, localUrl: `/uploads/${safeName}` });
    } catch (writeErr: any) {
      console.error('Error writing banner image:', writeErr);
      res.status(500).json({ success: false, error: 'Failed to save banner image to server storage.' });
    }
  } catch (err: any) {
    console.error('Error uploading banner image:', err);
    res.status(500).json({ success: false, error: 'Failed to process image upload.' });
  }
});

// Admin Only: Create new article with Schema & URL Validation
app.post('/api/articles', authenticate as any, async (req: AuthRequest, res) => {
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

    if (!title || typeof title !== 'string' || !title.trim() || title.length > 300) {
      return res.status(400).json({ success: false, error: 'Article headline is required (max 300 characters).' });
    }
    if (!isValidBannerImage(bannerImageUrl)) {
      return res.status(400).json({ success: false, error: 'A valid banner image URL or uploaded file is required.' });
    }
    if (authorAvatarUrl && !isValidUrlOrPath(authorAvatarUrl)) {
      return res.status(400).json({ success: false, error: 'Author avatar URL must be a valid HTTP/HTTPS or uploaded image URL.' });
    }
    if (!authorName || typeof authorName !== 'string' || !authorName.trim() || authorName.length > 100) {
      return res.status(400).json({ success: false, error: 'Author name is required (max 100 characters).' });
    }
    if (!content || typeof content !== 'string' || content.trim().length < 20 || content.length > 300000) {
      return res.status(400).json({ success: false, error: 'Article content must be between 20 and 300,000 characters.' });
    }

    const newArticle = await createArticle({
      title: title.trim(),
      bannerImageUrl: bannerImageUrl.trim(),
      category: typeof category === 'string' && category.trim() ? category.trim() : 'International Relations',
      authorName: authorName.trim(),
      authorRole: typeof authorRole === 'string' && authorRole.trim() ? authorRole.trim() : 'Editorial Contributor',
      authorAvatarUrl: authorAvatarUrl ? authorAvatarUrl.trim() : undefined,
      publishDate: publishDate || undefined,
      pullQuote: typeof pullQuote === 'string' ? pullQuote.trim() : undefined,
      content: content.trim(),
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : undefined,
      sourceReference: typeof sourceReference === 'string' ? sourceReference.trim() : undefined,
      authorEmail: req.user?.email
    });

    res.status(201).json({ success: true, article: newArticle });
  } catch (error: any) {
    console.error('Error creating article:', error);
    res.status(500).json({ success: false, error: 'Failed to create article.' });
  }
});

// Admin Only: Update article with Input Validation
app.put('/api/articles/:id', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { bannerImageUrl, authorAvatarUrl, title, authorName, content } = req.body;
    if (bannerImageUrl !== undefined && !isValidBannerImage(bannerImageUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid banner image URL provided.' });
    }
    if (authorAvatarUrl !== undefined && authorAvatarUrl && !isValidUrlOrPath(authorAvatarUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid author avatar URL provided.' });
    }
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 300)) {
      return res.status(400).json({ success: false, error: 'Article title must be between 1 and 300 characters.' });
    }
    if (authorName !== undefined && (typeof authorName !== 'string' || !authorName.trim() || authorName.length > 100)) {
      return res.status(400).json({ success: false, error: 'Author name must be between 1 and 100 characters.' });
    }
    if (content !== undefined && (typeof content !== 'string' || content.trim().length < 20 || content.length > 300000)) {
      return res.status(400).json({ success: false, error: 'Content must be between 20 and 300,000 characters.' });
    }

    const updated = await updateArticle(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, article: updated });
  } catch (error: any) {
    console.error('Error updating article:', error);
    res.status(500).json({ success: false, error: 'Failed to update article.' });
  }
});

// Admin Only: Delete article
app.delete('/api/articles/:id', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const success = await deleteArticle(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    res.json({ success: true, message: 'Article deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting article:', error);
    res.status(500).json({ success: false, error: 'Failed to delete article.' });
  }
});

// Admin Only: Direct Publish
app.post('/api/n-intel/publish', publishLimiter, authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { rawText, date } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'Pasted news text is required.' });
    }
    if (rawText.length > 500000) {
      return res.status(400).json({ success: false, error: 'Pasted news text exceeds 500,000 characters limit.' });
    }

    const pubDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getLocalTodayDate();

    const parseResult = parseDailyNewsPost(rawText, pubDate);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error || 'Failed to parse news text.' });
    }

    // Duplicate detection
    const duplicate = await findDuplicateBatch(parseResult.hash, pubDate);
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

    await saveBatchAndStories(batch, parseResult.stories, req.user.email || 'Admin');

    console.log(`✅ [N-INTEL] Published ${parseResult.totalStories} stories for ${pubDate} by ${req.user.email}`);

    res.json({
      success: true,
      message: `Successfully published ${parseResult.totalStories} stories across ${parseResult.categories.length} categories for ${pubDate}.`,
      count: parseResult.totalStories,
      categories: parseResult.categories,
      batchId: batch.id,
      date: pubDate,
      stories: parseResult.stories,
      batch
    });
  } catch (error: any) {
    console.error('Error publishing N-INTEL batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Sync stories and batches from client (Multi-Layer Persistence / Cold-start recovery)
app.post('/api/n-intel/sync', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { stories, batches } = req.body;
    if (!Array.isArray(stories)) {
      return res.status(400).json({ success: false, error: 'Invalid stories array.' });
    }

    const result = await syncNIntelStories(stories, batches);
    const editions = await getAvailableEditions();
    console.log(`✅ [N-INTEL] Synced ${result.count} stories from client by ${req.user.email}. Store total: ${result.total}`);

    res.json({
      success: true,
      message: `Synced ${result.count} stories successfully. Total in storage: ${result.total}.`,
      editions
    });
  } catch (err: any) {
    console.error('Error syncing N-INTEL stories:', err);
    res.status(500).json({ success: false, error: 'Failed to sync N-INTEL stories.' });
  }
});

// Admin Only: Edit a story (supports both PATCH and PUT)
const handleStoryUpdate = async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const updated = await updateStory(req.params.id, req.body, req.user.email || 'Admin');
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
app.delete('/api/n-intel/stories/:id', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const isPermanent = req.query.permanent === 'true';
    const adminEmail = req.user.email || 'Admin';

    if (isPermanent) {
      const success = await purgeStory(req.params.id, adminEmail);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Story not found' });
      }
      return res.json({ success: true, message: 'Story permanently purged from database.', permanent: true });
    }

    const success = await deleteStory(req.params.id, adminEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    res.json({ success: true, message: 'Story removed from public feed.', permanent: false });
  } catch (error: any) {
    console.error('Error deleting story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Bulk Delete (date-wise, category-wise, or multi-item IDs)
app.post('/api/n-intel/stories/bulk-delete', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { type, date, category, ids, permanent } = req.body;
    const adminEmail = req.user.email || 'Admin';
    const isPermanent = Boolean(permanent);

    if (type === 'date' || (date && !category && !ids)) {
      if (!date) {
        return res.status(400).json({ success: false, error: 'Target date is required for date-wise deletion.' });
      }
      const result = await deleteStoriesByDate(date, adminEmail, isPermanent);
      return res.json({
        success: true,
        type: 'date',
        count: result.count,
        date,
        permanent: isPermanent,
        message: `${result.count} stories for ${date} ${isPermanent ? 'permanently purged' : 'moved to trash'}.`
      });
    }

    if (type === 'category' || category) {
      if (!category) {
        return res.status(400).json({ success: false, error: 'Target category is required for category-wise deletion.' });
      }
      const result = await deleteStoriesByCategory(category, adminEmail, date, isPermanent);
      return res.json({
        success: true,
        type: 'category',
        count: result.count,
        category,
        date,
        permanent: isPermanent,
        message: `${result.count} stories in category "${category}"${date ? ` for date ${date}` : ''} ${isPermanent ? 'permanently purged' : 'moved to trash'}.`
      });
    }

    if (type === 'ids' || Array.isArray(ids)) {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Story IDs array is required.' });
      }
      const result = await deleteStoriesByIds(ids, adminEmail, isPermanent);
      return res.json({
        success: true,
        type: 'ids',
        count: result.count,
        ids: result.ids,
        permanent: isPermanent,
        message: `${result.count} selected stories ${isPermanent ? 'permanently purged' : 'moved to trash'}.`
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid deletion criteria. Provide date, category, or story IDs.' });
  } catch (error: any) {
    console.error('Error during bulk deletion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Date-wise deletion endpoint
app.delete('/api/n-intel/editions/:date', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const isPermanent = req.query.permanent === 'true';
    const adminEmail = req.user.email || 'Admin';
    const result = await deleteStoriesByDate(req.params.date, adminEmail, isPermanent);
    res.json({
      success: true,
      count: result.count,
      date: req.params.date,
      permanent: isPermanent,
      message: `Successfully deleted ${result.count} stories for date ${req.params.date}.`
    });
  } catch (error: any) {
    console.error('Error deleting edition by date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Only: Restore a soft-deleted story
app.post('/api/n-intel/stories/:id/restore', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const adminEmail = req.user.email || 'Admin';
    const success = await restoreStory(req.params.id, adminEmail);
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
app.delete('/api/n-intel/trash/empty', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const adminEmail = req.user.email || 'Admin';
    const purgedCount = await purgeAllDeletedStories(adminEmail);
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
app.get('/api/n-intel/audit', authenticate as any, async (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const logs = await getAuditLogs();
    res.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   PYQ PAPERS & ANSWER KEYS API (Self-Uploaded Archive)
   ========================================================================== */

// Get all uploaded PYQ sessions and file metadata
app.get('/api/pyq', async (req, res) => {
  try {
    const sessions = await getAllPyqSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    console.error('Error retrieving PYQ sessions:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to load PYQ papers' });
  }
});

// Link an external PDF or Drive URL (Admin Only)
app.post('/api/pyq/link', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const {
      sessionId,
      exam,
      session,
      year,
      title,
      subjectKey,
      fileType,
      url,
      fileName,
      fileSize
    } = req.body;

    if (!sessionId || !subjectKey || !fileType || !url) {
      return res.status(400).json({ success: false, error: 'Missing required parameters.' });
    }

    if (!isValidUrlOrPath(url)) {
      return res.status(400).json({ success: false, error: 'Invalid URL. Only valid HTTP/HTTPS URLs are accepted.' });
    }

    const sessionRecord = await savePyqFileRecord({
      sessionId,
      exam: exam || (sessionId.startsWith('nda') ? 'NDA' : sessionId.startsWith('afcat') ? 'AFCAT' : 'CDS'),
      session: session || 'I',
      year: Number(year) || 2026,
      title: title || sessionId,
      subjectKey,
      fileType,
      url,
      fileName: fileName || `${title || sessionId} ${subjectKey} ${fileType}`,
      fileSize: fileSize || 'Drive Link',
    });

    res.json({ success: true, session: sessionRecord });
  } catch (err: any) {
    console.error('Error linking PYQ URL:', err);
    res.status(500).json({ success: false, error: 'Failed to save link.' });
  }
});

// Delete an uploaded file or link (Admin Only)
app.post('/api/pyq/delete', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { sessionId, subjectKey, fileType } = req.body;
    if (!sessionId || !subjectKey || !fileType) {
      return res.status(400).json({ success: false, error: 'Missing required parameters.' });
    }

    const sessionRecord = await deletePyqFileRecord({ sessionId, subjectKey, fileType });
    res.json({ success: true, session: sessionRecord });
  } catch (err: any) {
    console.error('Error deleting PYQ file:', err);
    res.status(500).json({ success: false, error: 'Failed to delete file.' });
  }
});

// Sync PYQ sessions from client (Admin Only)
app.post('/api/pyq/sync', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { sessions } = req.body;
    if (!sessions || typeof sessions !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid sessions payload.' });
    }

    const updated = await syncPyqSessions(sessions);
    res.json({ success: true, sessions: updated });
  } catch (err: any) {
    console.error('Error syncing PYQ sessions:', err);
    res.status(500).json({ success: false, error: 'Failed to sync PYQ sessions.' });
  }
});

// ─────────────────────────────────────────────────────────────
// SUBJECT NOTES API ENDPOINTS
// ─────────────────────────────────────────────────────────────

// GET all notes or filter by subject
app.get('/api/notes', async (req, res) => {
  try {
    const { subject } = req.query;
    if (typeof subject === 'string' && subject.trim()) {
      const notes = await getNotesBySubject(subject.trim());
      return res.json({ success: true, notes });
    }
    const notes = await getAllNotes();
    res.json({ success: true, notes });
  } catch (err: any) {
    console.error('Error fetching subject notes:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve notes.' });
  }
});

// Link a note from Google Drive or external URL (Admin Only)
app.post('/api/notes/link', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { subjectId, subjectTitle, title, category, url, fileSize } = req.body;

    if (!subjectId || !subjectTitle || !title || !url) {
      return res.status(400).json({ success: false, error: 'Missing required parameters.' });
    }
    if (!isValidUrlOrPath(url)) {
      return res.status(400).json({ success: false, error: 'Invalid note URL.' });
    }

    const note = await saveNote({
      subjectId,
      subjectTitle,
      title,
      category,
      url: url.trim(),
      fileName: title.trim(),
      fileSize: fileSize || 'Online Document',
    });

    res.json({ success: true, note });
  } catch (err: any) {
    console.error('Error linking subject note:', err);
    res.status(500).json({ success: false, error: 'Failed to save note link.' });
  }
});

// Delete a note (Admin Only)
app.post('/api/notes/delete', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing note ID.' });
    }

    const success = await deleteNote(id);
    if (!success) return res.status(404).json({ success: false, error: 'Note not found.' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting subject note:', err);
    res.status(500).json({ success: false, error: 'Failed to delete note.' });
  }
});

// Sync notes from client (Admin Only)
app.post('/api/notes/sync', authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { notes } = req.body;
    if (!Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: 'Invalid notes array.' });
    }

    const updated = await syncNotes(notes);
    res.json({ success: true, notes: updated });
  } catch (err: any) {
    console.error('Error syncing notes:', err);
    res.status(500).json({ success: false, error: 'Failed to sync notes.' });
  }
});

// Centralized Error Handling Middleware (Safe error masking in production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred. Please try again later.'
      : (err.message || 'Internal server error')
  });
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

  // Seed sample N-INTEL edition if empty (local dev only)
  if (!process.env.VERCEL) {
    try {
      await seedSampleDataIfEmpty(SAMPLE_NINTEL_POST);
    } catch (err) {
      console.warn('⚠️ Could not seed sample N-INTEL data:', err);
    }
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

if (!process.env.VERCEL) {
  setupServer();
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default app;
