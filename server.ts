import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
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
import {
  getAllPyqSessions,
  savePyqFileRecord,
  deletePyqFileRecord
} from './pyq-db';
import {
  getAllNotes,
  getNotesBySubject,
  getNoteById,
  saveNote,
  deleteNote
} from './notes-db';
import {
  uploadPdfToDrive,
  deletePdfFromDrive,
  extractDriveFileId,
  isDriveConfigured
} from './google-drive';
import { parseDailyNewsPost, getLocalTodayDate } from './n-intel-parser';
import { SAMPLE_NINTEL_POST } from './n-intel-sample-data';

const require = createRequire(import.meta.url);
const firebaseConfigJson = require('./firebase-applet-config.json');

dotenv.config();

const app = express();
const PORT = 3000;

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
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Request body size limit (support PDF uploads up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiters
const globalApiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 300, // 300 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this network. Please slow down.' }
});
app.use('/api', globalApiLimiter);

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Submission limit reached. Please wait before submitting another message.' }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Upload limit exceeded. Please try again later.' }
});

const downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 increments per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Download limit exceeded.' }
});

const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Publishing rate limit exceeded.' }
});

// Secure static uploads directory with Sandboxing and nosniff
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const PYQ_UPLOADS_DIR = path.join(UPLOADS_DIR, 'pyq');
const NOTES_UPLOADS_DIR = path.join(UPLOADS_DIR, 'notes');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PYQ_UPLOADS_DIR)) {
  fs.mkdirSync(PYQ_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(NOTES_UPLOADS_DIR)) {
  fs.mkdirSync(NOTES_UPLOADS_DIR, { recursive: true });
}
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (filePath.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      } else {
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      }
    }
  })
);

// Initialize Firebase Admin with Service Account credentials if available
try {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim()
    : undefined;

  if (serviceEmail && serviceKey && serviceKey.includes('BEGIN PRIVATE KEY')) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId || 'nishchay-defence',
        clientEmail: serviceEmail,
        privateKey: serviceKey
      }),
      projectId: projectId || 'nishchay-defence'
    });
    console.log('✅ Firebase Admin initialized with Service Account credentials');
  } else if (projectId) {
    admin.initializeApp({
      projectId,
    });
    console.log('✅ Firebase Admin initialized with Project ID:', projectId);
  } else {
    console.warn('⚠️ Firebase Admin NOT initialized (missing credentials and projectId)');
  }
} catch (error: any) {
  console.error('❌ Firebase Admin initialization error:', error.message);
}

// Admin Emails (Authoritative list for server-side verification)
const ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
  "vedantranjeetjadhav@gmail.com",
  "abhijeetgaikwad1904@gmail.com",
  "muthalrishikesh2006@gmail.com",
  "adityasahane076@gmail.com"
];

// Helper: Validate absolute or safe relative HTTP URLs
function isValidUrlOrPath(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') && !trimmed.includes('..')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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
    // Verify Firebase ID Token cryptographically and check revocation
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Token contains no verified email address.'
      });
    }

    const isEmailAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === email);

    if (!isEmailAdmin) {
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

// Security: Parameter validation for all :id routes (prevents path traversal & parameter manipulation)
app.param('id', (req, res, next, id) => {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid identifier parameter format.' });
  }
  next();
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

// Public: Increment PDF download count (Rate limited to prevent counter manipulation)
app.post('/api/articles/:id/download', downloadLimiter, (req, res) => {
  try {
    incrementDownloadCount(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to record download count.' });
  }
});

// Admin Only: Upload Banner Image with Signature/Magic-Byte Validation
app.post('/api/articles/upload-banner', uploadLimiter, authenticate as any, (req: AuthRequest, res) => {
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

    const safeRandomToken = crypto.randomBytes(16).toString('hex');
    const safeName = `banner-${Date.now()}-${safeRandomToken}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, buffer, { flag: 'wx' });

    const publicUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('Error uploading banner image:', err);
    res.status(500).json({ success: false, error: 'Failed to process image upload.' });
  }
});

// Admin Only: Create new article with Schema & URL Validation
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

    if (!title || typeof title !== 'string' || !title.trim() || title.length > 300) {
      return res.status(400).json({ success: false, error: 'Article headline is required (max 300 characters).' });
    }
    if (!bannerImageUrl || !isValidUrlOrPath(bannerImageUrl)) {
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

    const newArticle = createArticle({
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
app.put('/api/articles/:id', authenticate as any, (req: AuthRequest, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  }

  try {
    const { bannerImageUrl, authorAvatarUrl, title, authorName, content } = req.body;
    if (bannerImageUrl !== undefined && !isValidUrlOrPath(bannerImageUrl)) {
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

    const updated = updateArticle(req.params.id, req.body);
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
    res.status(500).json({ success: false, error: 'Failed to delete article.' });
  }
});

// Admin Only: Direct Publish
app.post('/api/n-intel/publish', publishLimiter, authenticate as any, (req: AuthRequest, res) => {
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

/* ==========================================================================
   PYQ PAPERS & ANSWER KEYS API (Self-Uploaded Archive)
   ========================================================================== */

// Get all uploaded PYQ sessions and file metadata
app.get('/api/pyq', (req: Request, res: Response) => {
  try {
    const sessions = getAllPyqSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    console.error('Error retrieving PYQ sessions:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to load PYQ papers' });
  }
});

// Upload a question paper or answer key PDF directly from computer (Admin Only)
app.post('/api/pyq/upload', uploadLimiter, authenticate as any, async (req: AuthRequest, res: Response) => {
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
      fileBase64,
      originalName,
      fileSize
    } = req.body;

    if (!sessionId || !subjectKey || !fileType || !fileBase64) {
      return res.status(400).json({ success: false, error: 'Missing required upload parameters.' });
    }

    const matches = fileBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(fileBase64, 'base64');
    }

    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds maximum 50MB limit.' });
    }

    // Security: Verify PDF Magic Bytes (%PDF- header)
    if (buffer.length < 5 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return res.status(400).json({ success: false, error: 'Invalid file signature. Only authentic PDF documents are allowed.' });
    }

    let publicUrl: string = '';
    let driveFileId: string | undefined;

    // Automated Google Drive Upload
    if (isDriveConfigured()) {
      try {
        const driveFileName = `${title || sessionId} - ${String(subjectKey).toUpperCase()} ${fileType === 'key' ? 'Answer Key' : 'Question Paper'}.pdf`;
        const driveResult = await uploadPdfToDrive({
          buffer,
          fileName: driveFileName,
        });
        publicUrl = driveResult.url;
        driveFileId = driveResult.fileId;
      } catch (driveErr: any) {
        console.warn('⚠️ Google Drive upload failed, falling back to local disk storage:', driveErr?.message);
      }
    }

    // Local Storage Fallback if Google Drive is not configured or fails
    if (!publicUrl) {
      if (!fs.existsSync(PYQ_UPLOADS_DIR)) {
        fs.mkdirSync(PYQ_UPLOADS_DIR, { recursive: true });
      }

      const cleanSession = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
      const cleanSubject = String(subjectKey).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
      const cleanType = String(fileType).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10);
      const randomHex = crypto.randomBytes(8).toString('hex');
      const safeFileName = `${cleanSession}-${cleanSubject}-${cleanType}-${Date.now()}-${randomHex}.pdf`;
      const targetPath = path.join(PYQ_UPLOADS_DIR, safeFileName);

      fs.writeFileSync(targetPath, buffer, { flag: 'wx' });
      publicUrl = `/uploads/pyq/${safeFileName}`;
    }

    const sessionRecord = savePyqFileRecord({
      sessionId,
      exam: exam || (sessionId.startsWith('nda') ? 'NDA' : 'CDS'),
      session: session || 'I',
      year: Number(year) || 2026,
      title: title || sessionId,
      subjectKey,
      fileType,
      url: publicUrl,
      driveFileId,
      fileName: originalName || (title ? `${title}.pdf` : 'Paper.pdf'),
      fileSize: fileSize || `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
    });

    res.json({ success: true, url: publicUrl, driveFileId, session: sessionRecord });
  } catch (err: any) {
    console.error('Error handling PYQ upload:', err);
    res.status(500).json({ success: false, error: 'Failed to process file upload.' });
  }
});

// Link an external PDF or Drive URL (Admin Only)
app.post('/api/pyq/link', authenticate as any, (req: AuthRequest, res: Response) => {
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

    const sessionRecord = savePyqFileRecord({
      sessionId,
      exam: exam || (sessionId.startsWith('nda') ? 'NDA' : 'CDS'),
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
app.post('/api/pyq/delete', authenticate as any, (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { sessionId, subjectKey, fileType } = req.body;
    if (!sessionId || !subjectKey || !fileType) {
      return res.status(400).json({ success: false, error: 'Missing required parameters.' });
    }

    // Clean up file: check Google Drive first, or remove from local disk
    const currentSessions = getAllPyqSessions();
    const existingFile = currentSessions[sessionId]?.subjects?.[subjectKey as 'maths' | 'gat' | 'english' | 'gs']?.[fileType as 'paper' | 'key'];
    if (existingFile?.driveFileId) {
      deletePdfFromDrive(existingFile.driveFileId).catch((e) => console.warn('Could not delete PYQ from Drive:', e));
    } else if (existingFile?.url) {
      const driveId = extractDriveFileId(existingFile.url);
      if (driveId) {
        deletePdfFromDrive(driveId).catch((e) => console.warn('Could not delete PYQ from Drive:', e));
      }
    }

    if (existingFile?.url && existingFile.url.startsWith('/uploads/pyq/')) {
      const filename = path.basename(existingFile.url);
      const diskPath = path.join(PYQ_UPLOADS_DIR, filename);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (cleanupErr) {
          console.warn('Could not remove PYQ file from disk:', cleanupErr);
        }
      }
    }

    const sessionRecord = deletePyqFileRecord({ sessionId, subjectKey, fileType });
    res.json({ success: true, session: sessionRecord });
  } catch (err: any) {
    console.error('Error deleting PYQ file:', err);
    res.status(500).json({ success: false, error: 'Failed to delete file.' });
  }
});

// ─────────────────────────────────────────────────────────────
// SUBJECT NOTES API ENDPOINTS
// ─────────────────────────────────────────────────────────────

// GET all notes or filter by subject
app.get('/api/notes', (req: Request, res: Response) => {
  try {
    const { subject } = req.query;
    if (typeof subject === 'string' && subject.trim()) {
      const notes = getNotesBySubject(subject.trim());
      return res.json({ success: true, notes });
    }
    const notes = getAllNotes();
    res.json({ success: true, notes });
  } catch (err: any) {
    console.error('Error fetching subject notes:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve notes.' });
  }
});

// Upload a note PDF file (Admin Only)
app.post('/api/notes/upload', uploadLimiter, authenticate as any, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { subjectId, subjectTitle, title, category, fileBase64, originalName, fileSize } = req.body;

    if (!subjectId || !subjectTitle || !title || !fileBase64) {
      return res.status(400).json({ success: false, error: 'Missing required fields (subjectId, subjectTitle, title, fileBase64).' });
    }

    const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds 50MB ceiling.' });
    }

    // Verify PDF Magic Bytes (%PDF-)
    if (buffer.length < 5 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return res.status(400).json({ success: false, error: 'File rejected: Not a valid PDF document.' });
    }

    let publicUrl: string = '';
    let driveFileId: string | undefined;

    // Automated Google Drive Upload
    if (isDriveConfigured()) {
      try {
        const driveFileName = `${subjectTitle} - ${title}.pdf`;
        const driveResult = await uploadPdfToDrive({
          buffer,
          fileName: driveFileName,
        });
        publicUrl = driveResult.url;
        driveFileId = driveResult.fileId;
      } catch (driveErr: any) {
        console.warn('⚠️ Google Drive upload failed, falling back to local storage:', driveErr?.message);
      }
    }

    // Local Storage Fallback if Google Drive is not configured or fails
    if (!publicUrl) {
      const timestamp = Date.now();
      const cleanSubject = subjectId.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const sanitizedTitle = (originalName || title || 'note').replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.pdf$/i, '');
      const safeFileName = `${cleanSubject}-${timestamp}-${sanitizedTitle}.pdf`;
      const targetPath = path.join(NOTES_UPLOADS_DIR, safeFileName);

      fs.writeFileSync(targetPath, buffer);
      publicUrl = `/uploads/notes/${safeFileName}`;
    }

    const note = saveNote({
      subjectId,
      subjectTitle,
      title,
      category,
      url: publicUrl,
      driveFileId,
      fileName: originalName || `${title}.pdf`,
      fileSize: fileSize || `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
    });

    res.json({ success: true, note });
  } catch (err: any) {
    console.error('Error uploading subject note:', err);
    res.status(500).json({ success: false, error: 'Failed to process note upload.' });
  }
});

// Link a note from Google Drive or external URL (Admin Only)
app.post('/api/notes/link', authenticate as any, (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { subjectId, subjectTitle, title, category, url, fileSize } = req.body;

    if (!subjectId || !subjectTitle || !title || !url) {
      return res.status(400).json({ success: false, error: 'Missing required parameters.' });
    }

    const note = saveNote({
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
app.post('/api/notes/delete', authenticate as any, (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied: Administrator privileges required.' });
  }

  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing note ID.' });
    }

    const note = getNoteById(id);
    if (note?.driveFileId) {
      deletePdfFromDrive(note.driveFileId).catch((e) => console.warn('Could not delete note from Drive:', e));
    } else if (note?.url) {
      const driveId = extractDriveFileId(note.url);
      if (driveId) {
        deletePdfFromDrive(driveId).catch((e) => console.warn('Could not delete note from Drive:', e));
      }
    }

    if (note?.url && note.url.startsWith('/uploads/notes/')) {
      const filename = path.basename(note.url);
      const diskPath = path.join(NOTES_UPLOADS_DIR, filename);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (cleanupErr) {
          console.warn('Could not remove note file from disk:', cleanupErr);
        }
      }
    }

    const success = deleteNote(id);
    res.json({ success });
  } catch (err: any) {
    console.error('Error deleting subject note:', err);
    res.status(500).json({ success: false, error: 'Failed to delete note.' });
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
  console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Present (Google Drive Uploads Active)' : '⚠️ Not Set (Using Local Storage fallback)');
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
