// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import os2 from "os";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";
import { GoogleSpreadsheet as GoogleSpreadsheet2 } from "google-spreadsheet";
import { JWT as JWT2 } from "google-auth-library";
import admin from "firebase-admin";

// n-intel-whatsapp.ts
function getLocalTodayDate() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// n-intel-parser.ts
function computeTextHash(text) {
  let h1 = 2166136261;
  let h2 = 2654435769;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 2166136261);
  }
  return Math.abs(h1).toString(16).padStart(8, "0") + Math.abs(h2).toString(16).padStart(8, "0");
}
var EXCLUDED_CATEGORY_KEYWORDS = [
  // Mishaps / Accidents / Local Crime
  "MISHAP",
  "MISHAPS",
  "ACCIDENT",
  "ACCIDENTS",
  "CRIME",
  "CRIMES",
  "TRAGEDY",
  // Entertainment / Gossip
  "ENTERTAINMENT",
  "BOLLYWOOD",
  "CELEBRITY",
  "GOSSIP",
  "CINEMA",
  "MOVIES",
  "HOROSCOPE",
  "ASTROLOGY",
  "VIRAL",
  "ODD NEWS",
  // Financial Tickers, Currencies, Stock Indices, Bullion & Fuel Rates
  "INDIAN RUPEE",
  "RUPEE VALUE",
  "RUPEE",
  "BSE SENSEX",
  "SENSEX",
  "BSE",
  "NIFTY",
  "NSE",
  "RATES IN FINANCIAL CAPITAL",
  "RATES IN",
  "FINANCIAL CAPITAL MUMBAI",
  "FINANCIAL CAPITAL",
  "MUMBAI RATES",
  "GOLD RATE",
  "SILVER RATE",
  "BULLION",
  "FOREX",
  "CURRENCY",
  "CURRENCIES",
  "EXCHANGE RATE",
  "EXCHANGE RATES",
  "COMMODITY",
  "COMMODITIES",
  "FUEL PRICES",
  "PETROL",
  "DIESEL",
  "MARKET UPDATE",
  "MARKET WATCH",
  "STOCK MARKET",
  "SHARE MARKET",
  "WEATHER",
  "TEMPERATURE",
  "AQI",
  "AIR QUALITY",
  // Promotional / Community
  "PROMOTION",
  "LINKTREE",
  "SPONSORED",
  "ADVERTISEMENT",
  "JOIN NISHCHAY",
  "SUBSCRIBE",
  "COMMUNITY LINK"
];
function isExcludedHeader(text) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s&/()-]/gu, " ").replace(/\s+/g, " ").trim().toUpperCase();
  if (!cleaned) return false;
  return EXCLUDED_CATEGORY_KEYWORDS.some((kw) => cleaned === kw || cleaned.includes(kw));
}
function resolveCategory(header) {
  const cleaned = header.replace(/[^\p{L}\p{N}\s&/()-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < 3) return null;
  const upper = cleaned.toUpperCase();
  for (const ex of EXCLUDED_CATEGORY_KEYWORDS) {
    if (upper === ex || upper.includes(ex)) {
      return null;
    }
  }
  if (upper.includes("DEFENCE") || upper.includes("DEFENSE") || upper.includes("MILITARY") || upper.includes("ARMED FORCES") || upper.includes("ARMY") || upper.includes("NAVY") || upper.includes("AIR FORCE") || upper.includes("COAST GUARD") || upper.includes("SECURITY")) {
    return "Defence News";
  }
  if (upper.includes("APPOINTMENT") || upper.includes("RESIGNATION") || upper.includes("NEW CHIEF") || upper.includes("ELECTED") || upper.includes("APPOINTED")) {
    return "Important Appointments";
  }
  if (upper.includes("LEGAL") || upper.includes("JUDICIARY") || upper.includes("POLITY") || upper.includes("COURT") || upper.includes("CONSTITUTION") || upper.includes("LAW") || upper.includes("SUPREME COURT") || upper.includes("HIGH COURT")) {
    return "Polity & Judiciary";
  }
  if (upper.includes("WORLD") || upper.includes("GLOBAL NEWS") || upper.includes("GLOBAL AFFAIRS")) {
    return "World News";
  }
  if (upper.includes("INTERNATIONAL") || upper.includes("BILATERAL") || upper.includes("DIPLOMACY") || upper.includes("FOREIGN AFFAIRS") || upper.includes("RELATION")) {
    return "International Relations";
  }
  if (upper.includes("TOP") && upper.includes("NEWS") || upper.includes("TODAY") || upper.includes("NATIONAL") || upper.includes("INDIA NEWS") || upper.includes("BHARAT") || upper.includes("CABINET") || upper.includes("PARLIAMENT") || upper.includes("HEADLINE")) {
    return "National Affairs";
  }
  if (upper.includes("SPORT") || upper.includes("CRICKET") || upper.includes("OLYMPIC") || upper.includes("GAMES") || upper.includes("CHAMPIONSHIP") || upper.includes("TOURNAMENT") || upper.includes("TENNIS") || upper.includes("FOOTBALL") || upper.includes("BADMINTON")) {
    return "Sports";
  }
  if (upper.includes("SCIENCE") || upper.includes("TECH") || upper.includes("SPACE") || upper.includes("ISRO") || upper.includes("DRDO") || upper.includes("INNOVATION") || upper.includes("CYBER") || upper.includes("AI")) {
    return "Science & Technology";
  }
  if (upper.includes("ECONOM") || upper.includes("BANKING") || upper.includes("FINANCE") || upper.includes("RBI") || upper.includes("BUDGET") || upper.includes("COMMERCE") || upper.includes("TRADE") || upper.includes("GDP")) {
    return "Economy & Banking";
  }
  if (upper.includes("ENVIRONMENT") || upper.includes("ECOLOGY") || upper.includes("CLIMATE") || upper.includes("FOREST") || upper.includes("WILDLIFE") || upper.includes("POLLUTION")) {
    return "Environment & Ecology";
  }
  if (upper.includes("AWARD") || upper.includes("HONOUR") || upper.includes("HONOR") || upper.includes("PRIZE") || upper.includes("MEDAL") || upper.includes("PADMA")) {
    return "Awards & Honours";
  }
  if (upper.includes("SUMMIT") || upper.includes("CONFERENCE") || upper.includes("CONCLAVE") || upper.includes("MEETING") || upper.includes("G20") || upper.includes("BRICS") || upper.includes("SCO")) {
    return "Summits & Conferences";
  }
  if (upper.includes("SCHEME") || upper.includes("POLICY") || upper.includes("YOJANA") || upper.includes("MISSION") || upper.includes("INITIATIVE")) {
    return "Government Schemes";
  }
  return null;
}
function isPureTickerOrRates(text) {
  const upper = text.toUpperCase();
  const currencyHits = (upper.match(/\b(GBP|USD|CAD|DIRHAM|RUPIYA|NGULTRUM|TAKA|EURO|YEN|YUAN|CURRENCY)\b/g) || []).length;
  if (currencyHits >= 2 || currencyHits >= 1 && upper.includes("APPROX")) {
    return true;
  }
  if (/^\s*[\d,.]+\s+[+-]?[\d,.]+\s+\([+-]?[\d,.]+%?\)\s*[🔻🔺▲▼]?\s*$/m.test(text.trim())) {
    return true;
  }
  if (upper.includes("GOLD") && upper.includes("SILVER") && (text.includes("\u20B9") || upper.includes("KRT") || upper.includes("KG")) && text.length < 250) {
    return true;
  }
  if ((upper.includes("PETROL") || upper.includes("DIESEL")) && text.includes("\u20B9") && text.length < 150) {
    return true;
  }
  return false;
}
function extractHeadline(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "Untitled News Story";
  const firstLine = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
  const sepMatch = firstLine.match(/^(.+?)(?:\s+[—–]\s+|\s*:\s+)(.+)$/);
  if (sepMatch && sepMatch[1].length > 8 && sepMatch[1].length < 130) {
    return sepMatch[1].trim();
  }
  if (lines.length > 1 && firstLine.length > 10 && firstLine.length < 110 && !firstLine.endsWith(".")) {
    return firstLine;
  }
  const protectedText = firstLine.replace(/\b(Shri|Smt|Dr|Mr|Mrs|Ms|Prof|Gen|Lt|Maj|Col|Capt|Adm|Air|CEN|No|vs|v)\./gi, "$1__DOT__").replace(/\b([A-Z])\.([A-Z])\./g, "$1__DOT__$2__DOT__").replace(/\b([A-Z])\.\s/g, "$1__DOT__ ");
  const sMatch = protectedText.match(/^([^.!?\n]+[.!?]?)/);
  let headline = sMatch ? sMatch[1] : firstLine;
  headline = headline.replace(/__DOT__/g, ".").replace(/^\d+[\.\)]\s*/, "").trim();
  if (headline.length > 135) {
    const cut = headline.slice(0, 125).lastIndexOf(" ");
    headline = (cut > 50 ? headline.slice(0, cut) : headline.slice(0, 122)) + "...";
  }
  return headline || "Daily News Update";
}
function extractSource(content) {
  let sourceUrl;
  const urlMatch = content.match(/https?:\/\/[^\s\)\],;]+/i);
  if (urlMatch) {
    if (!urlMatch[0].includes("linktr.ee") && !urlMatch[0].includes("chat.whatsapp")) {
      sourceUrl = urlMatch[0];
    }
  }
  let sourceName;
  const knownSources = [
    "PIB",
    "Press Information Bureau",
    "IMD",
    "India Meteorological Department",
    "Supreme Court",
    "High Court",
    "ZSI",
    "Zoological Survey of India",
    "TRAI",
    "NCRB",
    "UNFCCC",
    "Zootaxa",
    "Bar Council",
    "DPIIT",
    "RRB",
    "Ministry of Defence",
    "MoD",
    "ISRO",
    "DRDO",
    "NHRC",
    "UNESCO",
    "WHO",
    "BRICS"
  ];
  for (const src of knownSources) {
    const regex = new RegExp(`\\b${src}\\b`, "i");
    if (regex.test(content)) {
      sourceName = src;
      break;
    }
  }
  return { sourceName, sourceUrl };
}
function checkIsDefence(category, content) {
  if (/defence|military|naval|army|navy|air force|drdo|armed forces/i.test(category)) {
    return true;
  }
  const defenceKeywords = [
    /\b(?:exercise|warship|frigate|patrol vessel|corpat|simbex|garuda|varuna|malabar|yudh abhyas|ins |iaf|icgs)\b/i,
    /\b(?:air force|indian army|indian navy|coast guard|shaurya diwas|infantry|admm-plus)\b/i,
    /\b(?:indo-tibetan border police|itbp|sashastra seema bal|bsf|crpf|cisf|assam rifles)\b/i,
    /\b(?:integrated defence staff|hq ids|sullage barge|stealth frigate|combat marksmanship)\b/i
  ];
  return defenceKeywords.some((regex) => regex.test(content));
}
function generateTags(category, content, sourceName, isDefence) {
  const tags = [category];
  if (isDefence && !tags.includes("Defence")) tags.push("Defence");
  if (sourceName && !tags.includes(sourceName)) tags.push(sourceName);
  const exercises = content.match(/\b(?:GARUDA SHAKTI|SIMBEX(?:-20\d\d)?|ADMM-PLUS|SHAURYA DIWAS|NGOPV|TEPA)\b/gi);
  if (exercises) {
    exercises.forEach((e) => {
      const u = e.toUpperCase();
      if (!tags.includes(u)) tags.push(u);
    });
  }
  const vessels = content.match(/\b(?:INS\s+[A-Za-z]+|ICGS\s+[A-Za-z]+)\b/gi);
  if (vessels) {
    vessels.forEach((v) => {
      const u = v.toUpperCase();
      if (!tags.includes(u)) tags.push(u);
    });
  }
  return tags.slice(0, 5);
}
function classifyStory(content) {
  if (checkIsDefence("", content)) {
    return "Defence News";
  }
  const upper = content.toUpperCase();
  if (/\b(CRICKET|OLYMPIC|GAMES|CHAMPIONSHIP|TOURNAMENT|WTA|ATP|FIFA|BWF|MEDAL|TROPHY|HOCKEY|BADMINTON|CHESS|TENNIS|ATHLETE)\b/.test(upper)) {
    return "Sports";
  }
  if (/\b(ISRO|DRDO|NASA|SATELLITE|ROCKET|ASTRONOMY|QUANTUM|SUPERCOMPUTER|AI|ARTIFICIAL INTELLIGENCE|CYBER|TECH|GENOME|PATENT)\b/.test(upper)) {
    return "Science & Technology";
  }
  if (/\b(SUPREME COURT|HIGH COURT|CJI|BENCH|VERDICT|TRIBUNAL|CONSTITUTION|ARTICLE \d+|LEGAL|JUDICIARY|BAR COUNCIL|ADVOCATE)\b/.test(upper)) {
    return "Polity & Judiciary";
  }
  if (/\b(APPOINTED|APPOINTMENT|TOOK CHARGE|ASSUMED CHARGE|NEW CHIEF|ELECTED|SWEARING-IN|OATH OF OFFICE|SWORN IN|DG |DIRECTOR GENERAL)\b/.test(upper)) {
    return "Important Appointments";
  }
  if (/\b(BILATERAL|DIPLOMATIC|AMBASSADOR|HIGH COMMISSIONER|TREATY|ACCORD|SUMMIT|SCO|G20|BRICS|ASEAN|UN |UNFCCC|UNESCO|WORLD BANK|IMF)\b/.test(upper)) {
    return "International Relations";
  }
  if (/\b(RESERVE BANK|RBI|INFLATION|REPO RATE|GDP|CURRENT ACCOUNT|SEBI|EXPORT|IMPORT|TRADE DEFICIT|BUDGET)\b/.test(upper)) {
    return "Economy & Banking";
  }
  if (/\b(POLLUTION|AIR QUALITY|AQI|FOREST|TIGER RESERVE|WILDLIFE|BIODIVERSITY|CARBON|CLIMATE CHANGE|WETLAND|RAMSAR)\b/.test(upper)) {
    return "Environment & Ecology";
  }
  return "National Affairs";
}
function detectHeader(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 110) {
    return { isHeader: false, isExcluded: false, category: null };
  }
  const hasAsterisks = /^\*+[^*]+\*+$/u.test(trimmed) || trimmed.startsWith("*") && trimmed.endsWith("*");
  const hasMarkdown = /^#{1,4}\s+/.test(trimmed);
  const isShortNonSentence = trimmed.length <= 65 && !/[.!?]$/.test(trimmed);
  if (!hasAsterisks && !hasMarkdown && !isShortNonSentence) {
    return { isHeader: false, isExcluded: false, category: null };
  }
  const candidate = trimmed.replace(/^[\s*#_~=\-–—:;|•+[\](){}\u2022\u25E6\u25AA\p{Extended_Pictographic}]+/gu, "").replace(/[\s*#_~=\-–—:;|•+[\](){}\u2022\u25E6\u25AA\p{Extended_Pictographic}]+$/gu, "").trim();
  if (!candidate || candidate.length < 3) {
    return { isHeader: false, isExcluded: false, category: null };
  }
  if (isExcludedHeader(candidate)) {
    return { isHeader: true, isExcluded: true, category: null };
  }
  const resolved = resolveCategory(candidate);
  if (resolved) {
    return { isHeader: true, isExcluded: false, category: resolved };
  }
  if (hasAsterisks || hasMarkdown) {
    return { isHeader: true, isExcluded: true, category: null };
  }
  return { isHeader: false, isExcluded: false, category: null };
}
function parseDailyNewsPost(rawText, pubDate) {
  const dateStr = pubDate && /^\d{4}-\d{2}-\d{2}$/.test(pubDate) ? pubDate : getLocalTodayDate();
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      date: dateStr,
      hash: "",
      stories: [],
      categories: [],
      totalStories: 0,
      error: "Pasted text is empty. Please paste the daily news post."
    };
  }
  const normalizedForHash = rawText.replace(/\s+/g, " ").trim().toLowerCase();
  const hash = computeTextHash(normalizedForHash);
  const lines = rawText.split(/\r?\n/);
  const categories = [];
  const stories = [];
  const batchId = `batch-${dateStr.replace(/-/g, "")}-${hash.slice(0, 8)}`;
  let currentCategory = null;
  let inIgnoredSection = false;
  let currentStoryText = "";
  let currentStoryNum = 0;
  let previousLineWasBlank = false;
  function commitStory() {
    if (inIgnoredSection) {
      currentStoryText = "";
      return;
    }
    if (!currentStoryText.trim()) return;
    const raw = currentStoryText.trim();
    if ((raw.includes("linktr.ee/") || raw.toLowerCase().includes("join nishchay defence")) && raw.length < 250) {
      currentStoryText = "";
      return;
    }
    if (isPureTickerOrRates(raw)) {
      currentStoryText = "";
      return;
    }
    const effectiveCategory = currentCategory || classifyStory(raw);
    if (!categories.includes(effectiveCategory)) {
      categories.push(effectiveCategory);
    }
    const headline = extractHeadline(raw);
    const { sourceName, sourceUrl } = extractSource(raw);
    const isDefence = effectiveCategory === "Defence News" || checkIsDefence(effectiveCategory, raw);
    const tags = generateTags(effectiveCategory, raw, sourceName, isDefence);
    const categoryKey = effectiveCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const storyId = `nintel-${dateStr.replace(/-/g, "")}-${categoryKey.slice(0, 6)}-${(stories.length + 1).toString().padStart(2, "0")}`;
    stories.push({
      id: storyId,
      batchId,
      headline,
      content: raw,
      category: effectiveCategory,
      categoryKey,
      date: dateStr,
      itemNumber: currentStoryNum || stories.length + 1,
      sourceName,
      sourceUrl,
      tags,
      isDefence,
      isDeleted: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    currentStoryText = "";
  }
  const storyStartRegex = /^(?:(?:[\[(]?(\d+)[\]).:\-]\s*)|(?:[•\-\*\u2022\u25E6\u25AA—]\s+))(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      previousLineWasBlank = true;
      continue;
    }
    if (/^[-=~_]{3,}$/.test(line)) {
      previousLineWasBlank = true;
      continue;
    }
    const headerCheck = detectHeader(line);
    if (headerCheck.isHeader) {
      commitStory();
      if (headerCheck.isExcluded) {
        currentCategory = null;
        inIgnoredSection = true;
      } else if (headerCheck.category) {
        currentCategory = headerCheck.category;
        inIgnoredSection = false;
        if (!categories.includes(headerCheck.category)) {
          categories.push(headerCheck.category);
        }
      }
      previousLineWasBlank = false;
      continue;
    }
    const numMatch = line.match(storyStartRegex);
    if (numMatch) {
      commitStory();
      if (numMatch[1]) {
        currentStoryNum = parseInt(numMatch[1], 10);
      } else {
        currentStoryNum = stories.length + 1;
      }
      currentStoryText = numMatch[2] ? numMatch[2].trim() : "";
      previousLineWasBlank = false;
      continue;
    }
    if (previousLineWasBlank && currentStoryText.length > 90 && /^[A-Z"'\u2018\u201C]/.test(line)) {
      commitStory();
      currentStoryNum = stories.length + 1;
      currentStoryText = line;
      previousLineWasBlank = false;
      continue;
    }
    if (currentStoryText) {
      currentStoryText += "\n" + line;
    } else if (!inIgnoredSection) {
      currentStoryText = line;
    }
    previousLineWasBlank = false;
  }
  commitStory();
  if (stories.length === 0 && rawText.trim().length > 30) {
    const paragraphs = rawText.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const p = paragraphs[pIdx];
      if (p.length < 25) continue;
      if (p.includes("linktr.ee/") || isPureTickerOrRates(p)) continue;
      const cat = classifyStory(p);
      if (!categories.includes(cat)) categories.push(cat);
      const headline = extractHeadline(p);
      const isDefence = cat === "Defence News" || checkIsDefence(cat, p);
      const categoryKey = cat.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const storyId = `nintel-${dateStr.replace(/-/g, "")}-${categoryKey.slice(0, 6)}-${(stories.length + 1).toString().padStart(2, "0")}`;
      stories.push({
        id: storyId,
        batchId,
        headline,
        content: p,
        category: cat,
        categoryKey,
        date: dateStr,
        itemNumber: stories.length + 1,
        tags: generateTags(cat, p, void 0, isDefence),
        isDefence,
        isDeleted: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  if (stories.length === 0) {
    return {
      success: false,
      date: dateStr,
      hash,
      stories: [],
      categories: [],
      totalStories: 0,
      error: "Could not extract any stories. Ensure the text has news content or numbered updates."
    };
  }
  return {
    success: true,
    date: dateStr,
    hash,
    stories,
    categories,
    totalStories: stories.length
  };
}

// cloud-db.ts
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import fs from "fs";
import path from "path";
import os from "os";
var IS_VERCEL = Boolean(process.env.VERCEL);
var LOCAL_CACHE_DIR = IS_VERCEL ? path.join(os.tmpdir(), "nishchay_cloud_cache") : path.join(process.cwd(), "data");
function ensureCacheDir() {
  try {
    if (!fs.existsSync(LOCAL_CACHE_DIR)) {
      fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
    }
  } catch {
  }
}
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Google Cloud Service Account credentials are not configured.");
  }
  key = key.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim();
  if (!key.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY is malformed.");
  }
  return new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}
var docInstance = null;
var docLoadedAt = 0;
var DOC_TTL_MS = 6e4;
async function getDoc() {
  const now = Date.now();
  if (docInstance && now - docLoadedAt < DOC_TTL_MS) {
    return docInstance;
  }
  const sheetId = process.env.GOOGLE_SHEET_ID_CONTACT || "1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY";
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  docInstance = doc;
  docLoadedAt = now;
  return doc;
}
async function getOrCreateTab(tabTitle, headerValues) {
  const doc = await getDoc();
  let tab = doc.sheetsByTitle[tabTitle];
  if (!tab) {
    try {
      tab = await doc.addSheet({ title: tabTitle, headerValues });
    } catch {
      await doc.loadInfo();
      tab = doc.sheetsByTitle[tabTitle];
    }
  }
  return tab;
}
var memoryCaches = {};
var CACHE_TTL_MS = 3e4;
function readDiskBackup(collectionName) {
  ensureCacheDir();
  const filePath = path.join(LOCAL_CACHE_DIR, `${collectionName}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function writeDiskBackup(collectionName, items) {
  ensureCacheDir();
  const filePath = path.join(LOCAL_CACHE_DIR, `${collectionName}.json`);
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(items), "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
    }
  }
}
async function fetchCollection(tabName, headers) {
  const now = Date.now();
  const cached = memoryCaches[tabName];
  if (cached && now < cached.expiresAt) {
    return cached.items;
  }
  try {
    const tab = await getOrCreateTab(tabName, headers);
    const rows = await tab.getRows();
    const items = [];
    for (const r of rows) {
      const rawJson = r.get("json");
      if (rawJson) {
        try {
          items.push(JSON.parse(rawJson));
        } catch {
        }
      }
    }
    memoryCaches[tabName] = { items, expiresAt: now + CACHE_TTL_MS };
    writeDiskBackup(tabName, items);
    return items;
  } catch (err) {
    console.warn(`[CloudDB] Could not load ${tabName} from Cloud Sheet, falling back to disk backup:`, err);
    const backup = readDiskBackup(tabName);
    if (backup) {
      memoryCaches[tabName] = { items: backup, expiresAt: now + 5e3 };
      return backup;
    }
    return [];
  }
}
async function saveRecord(tabName, headers, record, rowFieldExtractors) {
  const tab = await getOrCreateTab(tabName, headers);
  const rows = await tab.getRows();
  const existing = rows.find((r) => r.get("id") === record.id);
  const extraFields = rowFieldExtractors ? rowFieldExtractors(record) : {};
  const rowData = {
    ...extraFields,
    id: record.id,
    json: JSON.stringify(record),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (existing) {
    for (const [k, v] of Object.entries(rowData)) {
      existing.set(k, String(v ?? ""));
    }
    await existing.save();
  } else {
    await tab.addRow(rowData);
  }
  delete memoryCaches[tabName];
}
async function saveBatchRecords(tabName, headers, records, rowFieldExtractors) {
  if (records.length === 0) return;
  const tab = await getOrCreateTab(tabName, headers);
  const rows = await tab.getRows();
  const rowMap = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const id = r.get("id");
    if (id) rowMap.set(id, r);
  }
  const toAdd = [];
  for (const rec of records) {
    const extraFields = rowFieldExtractors ? rowFieldExtractors(rec) : {};
    const rowData = {
      ...extraFields,
      id: rec.id,
      json: JSON.stringify(rec),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const existing = rowMap.get(rec.id);
    if (existing) {
      for (const [k, v] of Object.entries(rowData)) {
        existing.set(k, String(v ?? ""));
      }
      await existing.save();
    } else {
      toAdd.push(rowData);
    }
  }
  if (toAdd.length > 0) {
    await tab.addRows(toAdd);
  }
  delete memoryCaches[tabName];
}
async function deleteRecord(tabName, headers, id) {
  const tab = await getOrCreateTab(tabName, headers);
  const rows = await tab.getRows();
  const target = rows.find((r) => r.get("id") === id);
  if (!target) return false;
  await target.delete();
  delete memoryCaches[tabName];
  return true;
}
async function deleteRecordsMatching(tabName, headers, predicate) {
  const tab = await getOrCreateTab(tabName, headers);
  const rows = await tab.getRows();
  let deletedCount = 0;
  for (const r of rows) {
    if (predicate(r)) {
      await r.delete();
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    delete memoryCaches[tabName];
  }
  return deletedCount;
}

// n-intel-db.ts
var STORIES_TAB = "nintel_stories";
var STORIES_HEADERS = ["id", "date", "category", "isDeleted", "headline", "json", "updatedAt"];
var BATCHES_TAB = "nintel_batches";
var BATCHES_HEADERS = ["id", "date", "rawContentHash", "publishedAt", "json", "updatedAt"];
var AUDIT_TAB = "nintel_audit";
var AUDIT_HEADERS = ["id", "action", "storyId", "batchId", "adminEmail", "timestamp", "details", "json"];
async function loadStories() {
  return fetchCollection(STORIES_TAB, STORIES_HEADERS);
}
async function loadBatches() {
  return fetchCollection(BATCHES_TAB, BATCHES_HEADERS);
}
async function loadAudit() {
  return fetchCollection(AUDIT_TAB, AUDIT_HEADERS);
}
async function addAuditLog(action, adminEmail, details, storyId, batchId) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    storyId,
    batchId,
    adminEmail,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    details
  };
  await saveRecord(AUDIT_TAB, AUDIT_HEADERS, entry, (e) => ({
    action: e.action,
    storyId: e.storyId || "",
    batchId: e.batchId || "",
    adminEmail: e.adminEmail,
    timestamp: e.timestamp,
    details: e.details
  }));
}
async function getAllStories(options = {}) {
  let stories = await loadStories();
  if (!options.includeDeleted) {
    stories = stories.filter((s) => !s.isDeleted);
  }
  if (options.date) {
    stories = stories.filter((s) => s.date === options.date);
  }
  if (options.month) {
    stories = stories.filter((s) => s.date && s.date.startsWith(options.month));
  }
  if (options.category && options.category.toLowerCase() !== "all") {
    const catLower = options.category.toLowerCase();
    stories = stories.filter((s) => s.category && s.category.toLowerCase() === catLower || s.categoryKey === catLower);
  }
  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    stories = stories.filter(
      (s) => s.headline && s.headline.toLowerCase().includes(q) || s.content && s.content.toLowerCase().includes(q) || s.category && s.category.toLowerCase().includes(q) || s.tags && s.tags.some((t) => t.toLowerCase().includes(q)) || s.sourceName && s.sourceName.toLowerCase().includes(q)
    );
  }
  stories = [...stories].sort((a, b) => {
    if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
    const timeA = a.createdAt || "";
    const timeB = b.createdAt || "";
    if (timeA && timeB && timeA !== timeB) return timeB.localeCompare(timeA);
    return (b.itemNumber || 0) - (a.itemNumber || 0);
  });
  if (options.limit && options.limit > 0) {
    return stories.slice(0, options.limit);
  }
  return stories;
}
async function getStoryById(id) {
  const stories = await loadStories();
  return stories.find((s) => s.id === id) || null;
}
async function findDuplicateBatch(hash, date) {
  const batches = await loadBatches();
  return batches.find((b) => b.rawContentHash === hash && b.date === date) || null;
}
async function saveBatchAndStories(batch, newStories, adminEmail) {
  await saveRecord(BATCHES_TAB, BATCHES_HEADERS, batch, (b) => ({
    date: b.date,
    rawContentHash: b.rawContentHash,
    publishedAt: b.publishedAt
  }));
  await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, newStories, (s) => ({
    date: s.date,
    category: s.category,
    isDeleted: s.isDeleted ? "true" : "false",
    headline: s.headline.substring(0, 200)
  }));
  await addAuditLog(
    "PUBLISH",
    adminEmail,
    `Published ${newStories.length} stories across ${batch.categories.length} categories for ${batch.date}`,
    void 0,
    batch.id
  );
}
async function updateStory(id, updates, adminEmail) {
  const stories = await loadStories();
  const current = stories.find((s) => s.id === id);
  if (!current) return null;
  let categoryKey = current.categoryKey;
  if (typeof updates.category === "string" && updates.category.trim()) {
    categoryKey = updates.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  const updated = {
    ...current,
    headline: typeof updates.headline === "string" ? updates.headline.trim() : current.headline,
    content: typeof updates.content === "string" ? updates.content.trim() : current.content,
    category: typeof updates.category === "string" ? updates.category.trim() : current.category,
    categoryKey,
    sourceName: updates.sourceName !== void 0 ? updates.sourceName : current.sourceName,
    sourceUrl: updates.sourceUrl !== void 0 ? updates.sourceUrl : current.sourceUrl,
    isDefence: typeof updates.isDefence === "boolean" ? updates.isDefence : current.isDefence,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastEditedBy: adminEmail
  };
  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, (s) => ({
    date: s.date,
    category: s.category,
    isDeleted: s.isDeleted ? "true" : "false",
    headline: s.headline.substring(0, 200)
  }));
  await addAuditLog("EDIT", adminEmail, `Edited story [${id}]: updated (${Object.keys(updates).join(", ")})`, id);
  return updated;
}
async function deleteStory(id, adminEmail) {
  const stories = await loadStories();
  const current = stories.find((s) => s.id === id);
  if (!current) return false;
  const updated = {
    ...current,
    isDeleted: true,
    deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
    deletedBy: adminEmail,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, (s) => ({
    date: s.date,
    category: s.category,
    isDeleted: "true",
    headline: s.headline.substring(0, 200)
  }));
  await addAuditLog("DELETE", adminEmail, `Soft-deleted story [${id}]: "${current.headline}"`, id);
  return true;
}
async function restoreStory(id, adminEmail) {
  const stories = await loadStories();
  const current = stories.find((s) => s.id === id);
  if (!current) return false;
  const updated = {
    ...current,
    isDeleted: false,
    deletedAt: void 0,
    deletedBy: void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveRecord(STORIES_TAB, STORIES_HEADERS, updated, (s) => ({
    date: s.date,
    category: s.category,
    isDeleted: "false",
    headline: s.headline.substring(0, 200)
  }));
  await addAuditLog("RESTORE", adminEmail, `Restored story [${id}]: "${current.headline}"`, id);
  return true;
}
async function purgeStory(id, adminEmail) {
  const stories = await loadStories();
  const story = stories.find((s) => s.id === id);
  if (!story) return false;
  await deleteRecord(STORIES_TAB, STORIES_HEADERS, id);
  await addAuditLog("DELETE", adminEmail, `Permanently purged story [${id}]: "${story.headline}"`, id);
  return true;
}
async function purgeAllDeletedStories(adminEmail) {
  const purgedCount = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, (r) => {
    return r.get("isDeleted") === "true";
  });
  if (purgedCount > 0) {
    await addAuditLog("DELETE", adminEmail, `Emptied trash: permanently purged all ${purgedCount} deleted stories.`);
  }
  return purgedCount;
}
async function deleteStoriesByDate(date, adminEmail, permanent = false) {
  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, (r) => {
      return r.get("date") === date;
    });
    await addAuditLog("DELETE", adminEmail, `Permanently purged entire briefing for ${date} (${count} stories removed).`);
    return { count, date };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate = [];
    for (const s of stories) {
      if (s.date === date && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedBy: adminEmail,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, (s) => ({
        date: s.date,
        category: s.category,
        isDeleted: "true",
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog("DELETE", adminEmail, `Soft-deleted entire briefing for ${date} (${count} stories moved to trash).`);
    return { count, date };
  }
}
async function deleteStoriesByCategory(category, adminEmail, date, permanent = false) {
  const targetCategory = category.trim().toLowerCase();
  const matchesCategory = (r) => {
    const cat = (r.get("category") || "").trim().toLowerCase();
    if (cat !== targetCategory) return false;
    if (date && r.get("date") !== date) return false;
    return true;
  };
  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, matchesCategory);
    await addAuditLog("DELETE", adminEmail, `Permanently purged category "${category}"${date ? ` for date ${date}` : ""} (${count} stories removed).`);
    return { count, category, date };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate = [];
    for (const s of stories) {
      const cat = (s.category || "").trim().toLowerCase();
      if (cat === targetCategory && (!date || s.date === date) && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedBy: adminEmail,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, (s) => ({
        date: s.date,
        category: s.category,
        isDeleted: "true",
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog("DELETE", adminEmail, `Soft-deleted category "${category}"${date ? ` for date ${date}` : ""} (${count} stories moved to trash).`);
    return { count, category, date };
  }
}
async function deleteStoriesByIds(ids, adminEmail, permanent = false) {
  if (!Array.isArray(ids) || ids.length === 0) return { count: 0, ids: [] };
  const idMap = {};
  for (const id of ids) idMap[id] = true;
  if (permanent) {
    const count = await deleteRecordsMatching(STORIES_TAB, STORIES_HEADERS, (r) => Boolean(idMap[r.get("id")]));
    await addAuditLog("DELETE", adminEmail, `Permanently purged ${count} selected stories.`);
    return { count, ids };
  } else {
    const stories = await loadStories();
    let count = 0;
    const toUpdate = [];
    for (const s of stories) {
      if (idMap[s.id] && !s.isDeleted) {
        toUpdate.push({
          ...s,
          isDeleted: true,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedBy: adminEmail,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        count++;
      }
    }
    if (toUpdate.length > 0) {
      await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toUpdate, (s) => ({
        date: s.date,
        category: s.category,
        isDeleted: "true",
        headline: s.headline.substring(0, 200)
      }));
    }
    await addAuditLog("DELETE", adminEmail, `Soft-deleted ${count} selected stories.`);
    return { count, ids };
  }
}
async function getAuditLogs(limitCount = 100) {
  const logs = await loadAudit();
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limitCount);
}
async function getAvailableEditions() {
  const stories = await getAllStories({ includeDeleted: false });
  const map = {};
  for (const s of stories) {
    if (!s.date) continue;
    if (!map[s.date]) {
      map[s.date] = {
        date: s.date,
        storyCount: 0,
        categories: /* @__PURE__ */ new Set(),
        categoryCounts: {},
        defenceCount: 0,
        headlines: []
      };
    }
    map[s.date].storyCount++;
    if (s.category) {
      map[s.date].categories.add(s.category);
      map[s.date].categoryCounts[s.category] = (map[s.date].categoryCounts[s.category] || 0) + 1;
      if (s.isDefence || s.category.toLowerCase().includes("defence")) {
        map[s.date].defenceCount++;
      }
    }
    if (map[s.date].headlines.length < 3 && s.headline) {
      map[s.date].headlines.push(s.headline);
    }
  }
  return Object.values(map).map((e) => ({
    date: e.date,
    storyCount: e.storyCount,
    categories: Array.from(e.categories),
    highlights: e.headlines,
    defenceCount: e.defenceCount,
    categoryCounts: e.categoryCounts
  })).sort((a, b) => b.date.localeCompare(a.date));
}
async function seedSampleDataIfEmpty(samplePostText) {
  const existing = await loadStories();
  if (existing.length > 0) return;
  console.log("\u{1F331} Seeding initial N-INTEL sample edition into Cloud Database...");
  const parseResult = parseDailyNewsPost(samplePostText, "2026-10-28");
  if (parseResult.success && parseResult.stories.length > 0) {
    const batch = {
      id: `batch-20261028-seed`,
      date: "2026-10-28",
      rawContentHash: parseResult.hash,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      publishedBy: "system@nishchay.defence",
      storyCount: parseResult.totalStories,
      categories: parseResult.categories
    };
    await saveBatchAndStories(batch, parseResult.stories, "system@nishchay.defence");
    console.log(`\u2705 Seeded ${parseResult.totalStories} N-INTEL stories into Cloud Database.`);
  }
}
async function syncNIntelStories(incomingStories, incomingBatches) {
  if (!Array.isArray(incomingStories) || incomingStories.length === 0) {
    const all2 = await loadStories();
    return { count: 0, total: all2.length };
  }
  const existing = await loadStories();
  const existingMap = /* @__PURE__ */ new Map();
  for (const s of existing) existingMap.set(s.id, true);
  const toAdd = incomingStories.filter((s) => s && s.id && !existingMap.has(s.id));
  if (toAdd.length > 0) {
    await saveBatchRecords(STORIES_TAB, STORIES_HEADERS, toAdd, (s) => ({
      date: s.date,
      category: s.category,
      isDeleted: s.isDeleted ? "true" : "false",
      headline: s.headline.substring(0, 200)
    }));
  }
  const all = await loadStories();
  return { count: toAdd.length, total: all.length };
}

// articles-db.ts
var ARTICLES_TAB = "articles";
var ARTICLES_HEADERS = ["id", "slug", "title", "category", "publishDate", "authorName", "json", "updatedAt"];
function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}
function calculateReadingTime(text) {
  const words = (text || "").trim().split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 180));
  return `${minutes} min read`;
}
async function getAllArticles() {
  const articles = await fetchCollection(ARTICLES_TAB, ARTICLES_HEADERS);
  return [...articles].sort(
    (a, b) => new Date(b.publishDate || b.createdAt).getTime() - new Date(a.publishDate || a.createdAt).getTime()
  );
}
async function getArticleById(idOrSlug) {
  if (!idOrSlug) return null;
  const articles = await getAllArticles();
  const query = String(idOrSlug).trim().toLowerCase();
  return articles.find(
    (a) => a.id === idOrSlug || a.slug === idOrSlug || a.id.toLowerCase() === query || a.slug && a.slug.toLowerCase() === query
  ) || null;
}
async function createArticle(data) {
  const slug = slugify(data.title) + "-" + Date.now().toString().slice(-4);
  const id = `article-${slug}`;
  const now = /* @__PURE__ */ new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const publishDate = data.publishDate?.trim() || todayStr;
  const readingTime = calculateReadingTime(data.content);
  const newArticle = {
    id,
    slug,
    title: data.title.trim(),
    bannerImageUrl: data.bannerImageUrl.trim(),
    category: data.category?.trim() || "General",
    authorName: data.authorName.trim(),
    authorRole: data.authorRole?.trim() || "Editorial Contributor",
    authorAvatarUrl: data.authorAvatarUrl?.trim() || void 0,
    publishDate,
    readingTime,
    pullQuote: data.pullQuote?.trim() || void 0,
    content: data.content.trim(),
    tags: Array.isArray(data.tags) ? data.tags : typeof data.tags === "string" ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    sourceReference: data.sourceReference?.trim() || void 0,
    viewsCount: 1,
    pdfDownloadCount: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    authorEmail: data.authorEmail
  };
  await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, newArticle, (a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    publishDate: a.publishDate,
    authorName: a.authorName
  }));
  return newArticle;
}
async function updateArticle(id, updates) {
  const current = await getArticleById(id);
  if (!current) return null;
  const updated = {
    ...current,
    title: typeof updates.title === "string" ? updates.title.trim() : current.title,
    bannerImageUrl: typeof updates.bannerImageUrl === "string" ? updates.bannerImageUrl.trim() : current.bannerImageUrl,
    category: typeof updates.category === "string" ? updates.category.trim() : current.category,
    authorName: typeof updates.authorName === "string" ? updates.authorName.trim() : current.authorName,
    authorRole: typeof updates.authorRole === "string" ? updates.authorRole.trim() : current.authorRole,
    authorAvatarUrl: updates.authorAvatarUrl !== void 0 ? updates.authorAvatarUrl : current.authorAvatarUrl,
    publishDate: typeof updates.publishDate === "string" ? updates.publishDate.trim() : current.publishDate,
    pullQuote: updates.pullQuote !== void 0 ? updates.pullQuote : current.pullQuote,
    content: typeof updates.content === "string" ? updates.content.trim() : current.content,
    tags: Array.isArray(updates.tags) ? updates.tags : current.tags,
    sourceReference: updates.sourceReference !== void 0 ? updates.sourceReference : current.sourceReference,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (updates.content && typeof updates.content === "string") {
    updated.readingTime = calculateReadingTime(updates.content);
  }
  await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, updated, (a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    publishDate: a.publishDate,
    authorName: a.authorName
  }));
  return updated;
}
async function deleteArticle(id) {
  const current = await getArticleById(id);
  if (!current) return false;
  return deleteRecord(ARTICLES_TAB, ARTICLES_HEADERS, current.id);
}
async function incrementDownloadCount(id) {
  const art = await getArticleById(id);
  if (art) {
    art.pdfDownloadCount = (art.pdfDownloadCount || 0) + 1;
    await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, art, (a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      publishDate: a.publishDate,
      authorName: a.authorName
    }));
  }
}
async function syncArticles(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    const all2 = await getAllArticles();
    return { added: 0, updated: 0, total: all2.length };
  }
  const existing = await getAllArticles();
  const existingMap = /* @__PURE__ */ new Map();
  for (const a of existing) {
    existingMap.set(a.id, a);
    if (a.slug) existingMap.set(a.slug, a);
  }
  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    if (!item || !item.id || !item.title) continue;
    const match = existingMap.get(item.id) || (item.slug ? existingMap.get(item.slug) : void 0);
    if (!match) {
      await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, item, (a) => ({
        slug: a.slug,
        title: a.title,
        category: a.category,
        publishDate: a.publishDate,
        authorName: a.authorName
      }));
      added++;
    } else {
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const currTime = new Date(match.updatedAt || match.createdAt || 0).getTime();
      if (incomingTime > currTime) {
        await saveRecord(ARTICLES_TAB, ARTICLES_HEADERS, { ...match, ...item }, (a) => ({
          slug: a.slug,
          title: a.title,
          category: a.category,
          publishDate: a.publishDate,
          authorName: a.authorName
        }));
        updated++;
      }
    }
  }
  const all = await getAllArticles();
  return { added, updated, total: all.length };
}

// pyq-db.ts
var PYQ_TAB = "pyq_sessions";
var PYQ_HEADERS = ["id", "exam", "session", "year", "title", "json", "updatedAt"];
async function getAllPyqSessions() {
  const sessions = await fetchCollection(PYQ_TAB, PYQ_HEADERS);
  const dict = {};
  for (const s of sessions) {
    const key = s.sessionId || s.id;
    dict[key] = { ...s, id: key, sessionId: key };
  }
  return dict;
}
async function savePyqFileRecord(params) {
  const all = await getAllPyqSessions();
  const { sessionId, exam, session, year, title, subjectKey, fileType, url, driveFileId, fileName, fileSize } = params;
  let sessionRecord = all[sessionId] || {
    id: sessionId,
    sessionId,
    exam,
    session,
    year,
    title,
    subjects: {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!sessionRecord.subjects) sessionRecord.subjects = {};
  if (!sessionRecord.subjects[subjectKey]) sessionRecord.subjects[subjectKey] = {};
  const fileItem = {
    url,
    driveFileId,
    fileName,
    fileSize: fileSize || "PDF Document",
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (fileType === "paper") {
    sessionRecord.subjects[subjectKey].paper = fileItem;
  } else {
    sessionRecord.subjects[subjectKey].key = fileItem;
  }
  sessionRecord.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  sessionRecord.id = sessionId;
  sessionRecord.sessionId = sessionId;
  await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, (s) => ({
    exam: s.exam,
    session: s.session,
    year: s.year,
    title: s.title
  }));
  return sessionRecord;
}
async function deletePyqFileRecord(params) {
  const all = await getAllPyqSessions();
  const { sessionId, subjectKey, fileType } = params;
  const sessionRecord = all[sessionId];
  if (!sessionRecord || !sessionRecord.subjects || !sessionRecord.subjects[subjectKey]) {
    return sessionRecord || null;
  }
  if (fileType === "paper") {
    delete sessionRecord.subjects[subjectKey].paper;
  } else {
    delete sessionRecord.subjects[subjectKey].key;
  }
  sessionRecord.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveRecord(PYQ_TAB, PYQ_HEADERS, sessionRecord, (s) => ({
    exam: s.exam,
    session: s.session,
    year: s.year,
    title: s.title
  }));
  return sessionRecord;
}
async function syncPyqSessions(incomingSessions) {
  if (!incomingSessions || typeof incomingSessions !== "object") {
    return getAllPyqSessions();
  }
  const all = await getAllPyqSessions();
  for (const [sessionId, session] of Object.entries(incomingSessions)) {
    if (!session || !session.subjects) continue;
    const existing = all[sessionId];
    if (!existing) {
      await saveRecord(PYQ_TAB, PYQ_HEADERS, { ...session, id: sessionId, sessionId }, (s) => ({
        exam: s.exam,
        session: s.session,
        year: s.year,
        title: s.title
      }));
    } else {
      let updated = false;
      for (const key of ["maths", "gat", "english", "gs", "afcat"]) {
        const incSlot = session.subjects[key];
        if (!incSlot) continue;
        if (!existing.subjects[key]) {
          existing.subjects[key] = {};
          updated = true;
        }
        if (incSlot.paper && !existing.subjects[key].paper) {
          existing.subjects[key].paper = incSlot.paper;
          updated = true;
        }
        if (incSlot.key && !existing.subjects[key].key) {
          existing.subjects[key].key = incSlot.key;
          updated = true;
        }
      }
      if (updated) {
        existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await saveRecord(PYQ_TAB, PYQ_HEADERS, existing, (s) => ({
          exam: s.exam,
          session: s.session,
          year: s.year,
          title: s.title
        }));
      }
    }
  }
  return getAllPyqSessions();
}

// notes-db.ts
var NOTES_TAB = "subject_notes";
var NOTES_HEADERS = ["id", "subjectId", "subjectTitle", "title", "url", "json", "uploadedAt"];
async function getAllNotes() {
  const notes = await fetchCollection(NOTES_TAB, NOTES_HEADERS);
  return [...notes].sort(
    (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
  );
}
async function getNotesBySubject(subjectId) {
  const all = await getAllNotes();
  return all.filter((n) => n.subjectId.toLowerCase() === subjectId.toLowerCase());
}
async function saveNote(data) {
  const id = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newNote = {
    id,
    subjectId: data.subjectId.toLowerCase(),
    subjectTitle: data.subjectTitle,
    title: data.title.trim(),
    category: data.category?.trim() || void 0,
    url: data.url,
    driveFileId: data.driveFileId,
    fileName: data.fileName,
    fileSize: data.fileSize || "PDF Document",
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveRecord(NOTES_TAB, NOTES_HEADERS, newNote, (n) => ({
    subjectId: n.subjectId,
    subjectTitle: n.subjectTitle,
    title: n.title,
    url: n.url,
    uploadedAt: n.uploadedAt
  }));
  return newNote;
}
async function deleteNote(id) {
  return deleteRecord(NOTES_TAB, NOTES_HEADERS, id);
}
async function syncNotes(incomingNotes) {
  if (!Array.isArray(incomingNotes) || incomingNotes.length === 0) {
    return getAllNotes();
  }
  const existing = await getAllNotes();
  const existingMap = /* @__PURE__ */ new Map();
  for (const n of existing) existingMap.set(n.id, true);
  for (const note of incomingNotes) {
    if (note && note.id && !existingMap.has(note.id)) {
      await saveRecord(NOTES_TAB, NOTES_HEADERS, note, (n) => ({
        subjectId: n.subjectId,
        subjectTitle: n.subjectTitle,
        title: n.title,
        url: n.url,
        uploadedAt: n.uploadedAt
      }));
    }
  }
  return getAllNotes();
}

// n-intel-sample-data.ts
var SAMPLE_NINTEL_POST = `*TODAYS TOP NEWS* 
------------------------------------

https://linktr.ee/nishchay.defence

Join Nishchay Defence using the above link \u{1F446}\u{1F3FB}

1.  President Smt Droupadi Murmu paid floral tributes to former President Shri K.R. Narayanan on his birth anniversary at Rashtrapati Bhavan. Born on 27 October 1920 at Uzhavoor in Kerala, Shri Narayanan served as India\u2019s 10th President from 1997 to 2002.

2.  President Smt Droupadi Murmu has promulgated the Lakshadweep Tourism Trade (Registration, Safety and Facilitation) Regulation, 2026, making registration compulsory for lodging, water sports, tour guides, travel agents, digital booking platforms and tourism vessels in the UT, with strict safety norms and heavy penalties for damage to fragile marine ecosystems. Existing operators get six months to register; applications must be decided within 45 to 60 days, failing which they will be deemed accepted.

3.  PM Shri Narendra Modi inaugurated the Emerging Science, Technology and Innovation Conclave (ESTIC) 2026 at Bharat Mandapam, New Delhi. He said a Viksit Bharat will be built on strong foundations of scientific research and innovation, that India must lead the world in shaping the technologies of tomorrow and build self-reliance in critical technologies, and cautioned: \u201CAI can give quick answers, but it is essential to verify them.\u201D

4.  The Centre has introduced a \u2018Concessional Local Pass\u2019 on national highways from 1 November for non-commercial vehicle owners living within 20 km of a toll plaza. With a valid FASTag, the annual pass costs \u20B91,500 for plazas outside municipal limits and \u20B93,000 for those within; it is valid only at that one plaza and is non-transferable.

5.  DPIIT has launched the 6th edition of the National Startup Awards (NSA 6.0), with 20 sectoral categories (12 of them new), 3 special categories, a new Student Innovator Award and a \u20B925 lakh cash prize in eligible categories. Applications are open from 27 October to 20 November; 2026 marks ten years of Startup India.

6.  The Rural Development Ministry is holding a two-day regional workshop under the Pradhan Mantri Awaas Yojana\u2013Gramin (PMAY-G) in Lucknow (27\u201328 October), with about 150 officials from nine States, to speed up house completion and plan reforms for the scheme\u2019s next phase. UP Deputy CM Keshav Prasad Maurya and MoS Kamlesh Paswan handed over house keys to beneficiaries.

7.  The Viksit Bharat Buildathon 2025 has entered the Guinness World Records as the \u201CLargest Innovation Solution Competition\u201D, with 2,87,967 project submissions from across the country. The Education Ministry will felicitate 10 national-level winning teams in New Delhi today, PIB said.

8.  Indian Railways has opened online applications for 1,265 Station Master posts under CEN No. 08/2026; any graduate can apply until 25 November. RRB Mumbai has the most vacancies (177), followed by Jammu-Srinagar (122) and Chennai (119).

9.  Very severe cyclonic storm \u2018Arnab\u2019 began crossing the Andhra Pradesh\u2013Yanam coast in the early hours with winds of 125\u2013135 kmph gusting to 150 kmph. Reports placed the start of landfall near Yanam\u2013Kakinada and Narsapur; IMD said the exact landfall point will be confirmed once the process is over. A storm surge of 1.5\u20132.5 metres is expected over Kakinada and Yanam, and Great Danger Signal No. X is hoisted at Kakinada port.

10.  Agriculture and Farmers Welfare Minister Shivraj Singh Chouhan said that Sardar Vallabhbhai Patel\u2019s vision, determination and leadership laid the foundation for India\u2019s national unity and territorial integrity. He made these remarks while addressing the 67th Sardar Patel Memorial Lecture virtually at Akashvani Bhawan in New Delhi. 

11.  The Civil Aviation Ministry held its first fog preparedness meeting for the coming winter, chaired by Secretary Samir Kumar Sinha. IMD expects the fog season to run from 15 December 2026 to 15 February 2027; airports were told to keep ILS and RVR systems ready and airlines to roster low-visibility-qualified crew and inform passengers of delays in time.

12.  The NHRC issued an advisory on \u2018Women\u2019s Safety at Work and Public Spaces\u2019 to ten Union Ministries, the Railway Board chairperson and all Chief Secretaries, covering eight key areas, and sought action-taken reports within two months. It noted women\u2019s labour force participation of 34.6% in September 2026 against about 4.4 lakh crimes against women in the latest NCRB report.

13.  The Zoological Survey of India has described a new deep-sea electric ray, Tetronarce ramanamurthyi, named the Arabian Black Electric Ray, from the southeastern Arabian Sea \u2014 the first confirmed record of the genus in the northern Indian Ocean. The work, under the Deep Ocean Mission, is published in the journal Zootaxa.

14.  TRAI data show India had 1,367.93 million telephone subscribers at the end of September 2026, with overall tele-density at 95.52%. Broadband subscribers, including M2M cellular connections, stood at 1,107.68 million, and 16.77 million mobile number portability requests were received during the month.

15.  Under the Gyan Bharatam Mission, the Culture Ministry signed an MoU with the Biblioth\xE8que nationale de France in Paris for digitisation, digital access, technology exchange, conservation and research on Indic-origin manuscripts. It was signed by Culture Secretary Vivek Aggarwal and BnF President Gilles P\xE9cout.

16.  Over 99.32 lakh names have been removed from Karnataka\u2019s electoral rolls in the Special Intensive Revision, bringing the electorate down from 5.54 crore to 4.55 crore in the final roll. It has about 2.25 crore men, 2.29 crore women and 2,841 third-gender voters, including 6.83 lakh aged 18\u201319.

17.  Telangana has officially declared drought in 365 of its 621 mandals (58.7%) across 31 districts \u2014 111 severe and 254 moderate \u2014 for the kharif season; only Hyderabad and Peddapalli districts were spared.

18.  Punjab and Haryana Bar Council elects 23-year-old lawyer Asmi unopposed, youngest ever State Bar Council member.  She has created history by becoming the youngest-ever member of a State Bar Council in the country and the first member from Generation Z to be elected to any State Bar Council. 

19.  Vande Bharat Sleeper train: Two new Vande Bharat sleeper trains will connect major cities in India and enhance overnight travel options. The Mumbai-Bengaluru service is set to launch on November 1, while the Delhi-Varanasi service is likely to start on October 31. Both services aim to significantly reduce travel times compared to existing options. Passengers should check the final schedules and train numbers before making travel plans.

20.  A network outage of more than an hour at Mumbai\u2019s Chhatrapati Shivaji Maharaj International Airport on Tuesday evening delayed 327 flights, forcing staff to switch to manual check-in. Operator MIAL said essential services continued.
------------------------------------
        *NEW APPOINTMENT* 
------------------------------------
1.  Sashastra Seema Bal Director General Sanjay Singhal, a 1993-batch UP-cadre IPS officer, has been given additional charge of DG, Indo-Tibetan Border Police (ITBP) from 31 October, when incumbent Shatrujeet Singh Kapoor retires, until a regular appointment is made. Singhal has headed the SSB since 1 September 2025 and earlier served in the ITBP as DIG and IG (2008\u20132015).

2.  Jammu and Kashmir LG Manoj Sinha administered the oath to four National Conference MLAs \u2014 Ali Mohammad Sagar (Khanyar), Shameema Firdous (Habba Kadal), Mir Saifullah (Trehgam) and Altaf Ahmad Wani alias Kaloo (Pahalgam) \u2014 at Lok Bhavan, Srinagar, in CM Omar Abdullah\u2019s first Cabinet expansion. The Cabinet now has its maximum strength of nine; Independent MLA Satish Sharma was dropped.

3.  Anup Bagchi took charge as Managing Director and CEO of HDFC Bank, India\u2019s largest private sector lender, on 27 October, succeeding Sashidhar Jagdishan, whose term ended on 26 October. An ICICI Group veteran who last headed ICICI Prudential Life Insurance, he is the first outsider to lead the bank in its over three-decade history.
------------------------------------
        *LEGAL REPORT* 
------------------------------------
1.  The Supreme Court gave petitioners 10 days to file rejoinders to the Election Commission\u2019s affidavit defending the Special Intensive Revision (SIR) of electoral rolls. The Bench of CJI Surya Kant and Justices Joymalya Bagchi and V. Mohana also asked the EC to respond to TMC MP Dola Sen\u2019s plea alleging changes to Form 6 in Bihar without the court\u2019s approval.

2.  The Supreme Court issued notice to Lok Sabha LoP Rahul Gandhi and others on a plea alleging that he pushed a pregnant journalist during the 12 October march to the apex court. The plea was mentioned before a Bench of CJI Surya Kant and Justice Joymalya Bagchi.

3.  The Supreme Court held that there is no bar under the UAPA on granting bail to a foreign national if the accused\u2019s initial entry into India was legal. A Bench of Justices Aravind Kumar and Vipul M. Pancholi upheld a Madras High Court order restoring bail to Sri Lankan national Mohmad Rifas, noting that the NIA had shown no material that his entry was illegal.

4.  Hearing the Digital News Publishers Association\u2019s challenge to the Digital Personal Data Protection Act and Rules, the Supreme Court issued notice to the Law and IT Ministries but refused an interim stay, saying a balance must be struck between press freedom and individual rights. DNPA argued newsrooms would shut if journalists needed prior consent; the case will be heard on 17 November.

5.  A Supreme Court Bench of Justices Vikram Nath and Sandeep Mehta slammed the Rajasthan government over illegal mining and pollution in the Jojari-Bandi-Luni river system and said it may order a CBI investigation. \u201CMaking 20 lakh people live in hell can\u2019t be compared with your economic viability,\u201D the Bench said, listing the case for 27 November.

6.  Mumbai Police have invoked the stringent Maharashtra Control of Organised Crime Act (MCOCA) in the 18 October firing on actor Tiger Shroff\u2019s car in Juhu. The Crime Branch has arrested 11 people allegedly linked to the Lawrence Bishnoi gang; Anil Pandit has been named as a wanted accused.

7.  Thirteen of the 17 undertrial prisoners who overpowered guards and escaped from the Thekkampatti sub-jail near Andipatti in Tamil Nadu\u2019s Theni district on Monday night have been recaptured, and nine prison staff have been suspended. DMK chief M.K. Stalin attacked the TVK government over the jailbreak.

------ *MISHAPS*----------

1.  In Panipat, Haryana \u2014 Worker Charred to Death in Yarn Factory Fire
A 21-year-old worker from Bihar, Rishu, was killed and another, Dhaneshwar, suffered 50% burns when a fire broke out around 3:40 am on Tuesday at the CRG Cotex yarn factory in the Shiv Nagar industrial area. A short circuit is suspected; narrow lanes hampered fire tenders.

2.  In Mohali, Punjab \u2014 Refuelling From Bottle Turns Fatal:  Pawan Singh (28) of Balongi died at PGI Chandigarh, ten days after his car caught fire while he was pouring petrol into it from a bottle with a lit cigarette in hand. Police urged people never to refuel from bottles or smoke near fuel.
------------------------------------
    *DEFENCE News* 
------------------------------------
1.  Defence Minister Rajnath Singh arrived in Cebu, Philippines, for the 13th ASEAN Defence Ministers\u2019 Meeting-Plus (ADMM-Plus), where he will hold bilateral meetings, reiterating India\u2019s commitment to ASEAN centrality. Earlier, he saluted the Army\u2019s infantrymen on Shaurya Diwas (Infantry Day).

2.  The 11th edition of the India-Indonesia Joint Special Forces Exercise GARUDA SHAKTI began at Banyuwangi, Indonesia, and will run till 6 November. Troops of the Parachute Regiment (Special Forces) are training with Indonesian Special Forces in jungle operations, air assault, mountaineering and combat marksmanship.

3.  Yard 1283 \u2018Srishti\u2019, a Next Generation Offshore Patrol Vessel (NGOPV) for the Navy, was launched at Goa Shipyard Limited in the presence of Vishvajit Sahay, Secretary (Defence Finance). NGOPVs are being built at GSL and GRSE for surveillance, search and rescue, offshore-asset protection, HADR and anti-piracy tasks.

4.  The 33rd Singapore-India Maritime Bilateral Exercise (SIMBEX-2026), hosted by the Navy at Visakhapatnam, concluded on 26 October. INS Nilgiri, INS Kamorta, P-8I and Dornier aircraft and MH-60R helicopters exercised with Singapore\u2019s stealth frigate RSS Supreme in anti-submarine, anti-air and anti-surface drills in the Bay of Bengal.

5.  The Navy\u2019s First Training Squadron \u2014 INS Tir, INS Sujata and ICGS Sarathi \u2014 arrived at Colombo, Sri Lanka, for a port call that includes cross-training visits and a Passage Exercise (PASSEX) with the Sri Lanka Navy.

6.  Bengaluru-based AI start-up Sarvam has signed an umbrella MoU with Headquarters Integrated Defence Staff (HQ IDS) under the Defence Ministry for artificial intelligence projects across the Army, Navy, Air Force and tri-service organisations. The value of the pact has not been disclosed.

7.  The first 300-tonne Sullage Barge (Yard 142) for the Navy was launched, and keels were laid for Yards 144 and 148, at MSME shipyard Suryadipta Projects, Thane. The indigenously designed barges will help naval platforms comply with MARPOL pollution rules.
------------------------------------
\u2708 *INTERNATIONAL NEWS* 
------------------------------------
1.  President Droupadi Murmu received Hereditary Prince Alois and Hereditary Princess Sophie of Liechtenstein at Rashtrapati Bhavan and hosted a banquet in their honour. She said the India-EFTA TEPA commitment to facilitate $100 billion of investment and 1 million direct jobs in India over 15 years gives a robust foundation for cooperation.

2.  PM Narendra Modi met Hereditary Prince Alois of Liechtenstein; the two leaders reviewed progress under the India-EFTA Trade and Economic Partnership Agreement (TEPA), which has completed its first year, and discussed ways to boost investment and economic cooperation.

3.  Vice-President C.P. Radhakrishnan met a Russian parliamentary delegation led by State Duma Chairman Vyacheslav Volodin in New Delhi and expressed confidence that India and Russia will reach their target of $100 billion in annual trade by 2030. He also hosted a luncheon for BRICS presiding officers at Parliament.

4.  The 12th BRICS Parliamentary Forum concluded in New Delhi with a unanimously adopted Joint Declaration voicing deep concern over the escalation in West Asia, urging protection of civilians and civilian infrastructure, condemning unilateral coercive measures and backing reform of the UN, including the Security Council.

5.  Commerce Minister Piyush Goyal said in The Hague that India\u2019s FTA talks with Chile are nearing conclusion and negotiations with the Southern African Customs Union (SACU) have begun. India-China trade rose about 29% to $91.76 billion in April\u2013September, making China India\u2019s largest trading partner in the first half of 2026-27.

6.  Environment Minister Bhupender Yadav reached Yerevan, Armenia, for the high-level segment of COP17 of the UN Convention on Biological Diversity \u2014 the first global review of progress under the Kunming-Montreal Global Biodiversity Framework, which aims to halt and reverse biodiversity loss by 2030. He will highlight India\u2019s conservation achievements at bilateral and multilateral meetings.

7.  India has invited Pakistan\u2019s Federal Minister for National Heritage and Culture, Aurangzeb Khan Khichi, to the inaugural SCO Civilisational Dialogue Forum in New Delhi from 20 to 22 November; Islamabad is yet to decide. The forum was proposed by PM Modi at the SCO summit in Tianjin in September 2025.
------------------------------------
\u{1F30E} *WORLD NEWS* \u{1F30D} 
------------------------------------
1.  Exit polls after Israel\u2019s Knesset election showed no clear winner: Gadi Eisenkot\u2019s opposition bloc was projected at 52\u201353 seats and PM Benjamin Netanyahu\u2019s bloc at 50, both short of the 61 needed, with Arab-led parties at a record 17\u201318. Netanyahu\u2019s Likud (24\u201325 seats) is projected as the largest party, ahead of Eisenkot\u2019s Yashar (21\u201323). Turnout was the highest since at least 1973; final results are expected by 30 October.

2.  US First Lady Melania Trump announced that the Russia-Ukraine ceasefire she brokered for the occupied Ukrainian city of Oleshky took effect at 4 am Moscow time on 27 October, two days ahead of schedule, and has been expanded within the Kherson region to give humanitarian convoys safe passage. About 1,700\u20132,000 mostly elderly residents remain in the city; Russian strikes continued elsewhere in Ukraine.

3.  Ethiopia\u2019s Orthodox Tewahedo Church said at least 60 Orthodox Christians were killed in two attacks in the Arsi Zone of Oromia region \u2014 14 in Merti district on 20 October and 46 in Shirka district on 24 October. The regional government blamed the Oromo Liberation Army (OLA), which could not be reached for comment.

4.  A UNFCCC synthesis of 127 new national climate plans (NDCs) found that global greenhouse gas emissions will fall only 6% below 2019 levels by 2035 if current pledges are implemented \u2014 far off track from what is needed to limit warming.

5.  Bangladesh\u2019s dengue death toll this year has reached 400, with 11 deaths in a single day \u2014 the highest daily toll of 2026 \u2014 and total cases at 1,28,237. Deaths of children with confirmed or suspected measles have risen to 1,240.
------------------------------------
\u{1F6A3}\u{1F6B4}\u{1F3C7}\u{1F3CA} *SPORTS*
------------------------------------
1.  Abhishek Sharma smashed 113 off 38 balls, with a 35-ball century, as India chased 199 in just 13.2 overs to beat New Zealand by six wickets in the third T20I at Wellington and take an unbeatable 3-0 lead in the five-match series. He and Vaibhav Sooryavanshi (45) put on 133 for the first wicket, including a record 118 in the powerplay; Daryl Mitchell had made 89 not out in NZ\u2019s 198/3.

2.  India began the men\u2019s Asian Champions Trophy hockey with a 13-0 win over Bangladesh in Jalandhar, with Mandeep Singh scoring a hat-trick. Midfielder Nilakanta Sharma announced he will retire from international hockey after the tournament; India play China on 29 October.

3.  Kajal Dhochak (76 kg) and Neelam Sirohi (50 kg) became the first two Indian women to reach the finals at the same World Wrestling Championships. Kajal came back from 1-7 down to beat Kyrgyzstan\u2019s Aiperi Medet Kyzy 10-7 and will face Ukraine\u2019s Anastasiya Alpyeyeva, while Neelam beat Kazakhstan\u2019s Zeinep Bayanova 7-3 to set up a final against Japan\u2019s Yui Susaki.

4.  Aditya won India\u2019s first gold of the World Under-19 Boxing Championships in Montenegro, beating Russia\u2019s Islam Magomedov 4-1 in the 55 kg final. Harshika (65 kg) and Prachi Tokas (+80 kg) won bronze medals.

5.  England captain Harry Kane won the 2026 men\u2019s Ballon d\u2019Or \u2014 the first Englishman since Michael Owen in 2001 \u2014 after scoring 73 goals for Bayern Munich, while Spain\u2019s Alexia Putellas won the women\u2019s award for the third time.

6.  India\u2019s men stormed into the semi-finals of the inaugural Commonwealth Kabaddi Championship in Ahmedabad with a 48-20 win over Tanzania, led by Neeraj Narwal\u2019s 12 points. They face Sri Lanka in their last group match on 29 October.`;

// server.ts
dotenv.config();
var app = express();
var PORT = 3e3;
app.set("trust proxy", 1);
app.use((req, res, next) => {
  const matchedPath = req.headers["x-matched-path"];
  if (matchedPath) {
    req.url = matchedPath;
  } else {
    const realUrl = req.originalUrl || req.url;
    if (realUrl && (req.url === "/api" || req.url === "/api/index" || req.url.startsWith("/api?"))) {
      req.url = realUrl;
    }
  }
  next();
});
app.disable("x-powered-by");
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
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
      }
    },
    // Essential for Firebase signInWithPopup so the authentication popup can communicate with the opener window
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "sameorigin" }
  })
);
var ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "https://nishchaydefence.in",
  "https://www.nishchaydefence.in",
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked request from origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Original-Name"]
  })
);
app.use(express.raw({ type: "application/pdf", limit: "10mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((err, req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      success: false,
      error: 'The uploaded file payload is too large for direct processing. Please choose a file under 35 MB or use the "Paste PDF / Drive Link" tab.'
    });
  }
  if (err && err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Malformed JSON payload received."
    });
  }
  next(err);
});
var globalApiLimiter = rateLimit({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  max: 300,
  // 300 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: "Too many requests from this network. Please slow down." }
});
app.use("/api", globalApiLimiter);
var contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 5,
  // 5 submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: "Submission limit reached. Please wait before submitting another message." }
});
var downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  max: 50,
  // 50 increments per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: "Download limit exceeded." }
});
var publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, error: "Publishing rate limit exceeded." }
});
var IS_VERCEL2 = Boolean(process.env.VERCEL);
var UPLOADS_DIR = IS_VERCEL2 ? path2.join(os2.tmpdir(), "nishchay_uploads") : path2.join(process.cwd(), "public", "uploads");
try {
  if (!fs2.existsSync(UPLOADS_DIR)) {
    fs2.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (fsErr) {
  console.warn("Could not initialize uploads directory:", fsErr);
}
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    dotfiles: "ignore",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  })
);
try {
  if (!admin.apps.length) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "nishchay-defence";
    const serviceEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
    const serviceKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim() : void 0;
    if (serviceEmail && serviceKey && serviceKey.includes("BEGIN PRIVATE KEY")) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: serviceEmail,
          privateKey: serviceKey
        }),
        projectId
      });
      console.log("\u2705 Firebase Admin initialized with Service Account for:", projectId);
    } else {
      admin.initializeApp({ projectId });
      console.log("\u2705 Firebase Admin initialized with Project ID (public cert token verification):", projectId);
    }
  }
} catch (error) {
  console.error("\u274C Firebase Admin initialization error:", error.message);
}
var ADMIN_EMAILS = [
  "diyawalunj@gmail.com",
  "vedantranjeetjadhav@gmail.com",
  "abhijeetgaikwad1904@gmail.com",
  "muthalrishikesh2006@gmail.com",
  "adityasahane076@gmail.com"
];
function isValidUrlOrPath(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:image/")) {
    return true;
  }
  if (trimmed.startsWith("/uploads/") && !trimmed.includes("..")) {
    return true;
  }
  if (trimmed.startsWith("/api/uploads/") && !trimmed.includes("..")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function sanitizeSheetCell(val) {
  if (val === null || val === void 0) return "";
  let str = String(val).trim();
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}
var authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn(`[SECURITY WARN] Missing or malformed Authorization header from IP: ${clientIp} for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Authentication required with a valid Bearer token."
    });
  }
  const token = authHeader.split("Bearer ")[1].trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Empty token provided."
    });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email?.trim().toLowerCase();
    if (!email) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Token contains no verified email address."
      });
    }
    const isEmailAdmin = ADMIN_EMAILS.some((e) => e.toLowerCase() === email);
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
  } catch (error) {
    console.error(`[SECURITY ERROR] Token verification failed from IP: ${clientIp}:`, error.code || error.message);
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Authentication token is invalid, expired, or revoked."
    });
  }
};
app.use((req, res, next) => {
  if (req.url.startsWith("/api")) {
    console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});
function getSheetAuth() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error("Missing Google Service Account credentials");
  }
  const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim();
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY is malformed");
  }
  return new JWT2({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}
async function getSheet(sheetId, tabName, defaultHeaders) {
  const auth = getSheetAuth();
  const doc = new GoogleSpreadsheet2(sheetId, auth);
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[tabName];
  if (!sheet && tabName === "contactform") {
    const commonNames = ["contactform", "responses", "Sheet1", "Sheet 1", "Form Responses 1", "contact"];
    for (const name of commonNames) {
      if (doc.sheetsByTitle[name]) {
        sheet = doc.sheetsByTitle[name];
        console.log(`\u2139\uFE0F Found existing tab: "${name}" instead of "${tabName}"`);
        break;
      }
    }
    if (!sheet && doc.sheetCount > 0) {
      sheet = doc.sheetsByIndex[0];
      console.log(`\u2139\uFE0F Defaulting to first sheet tab: "${sheet.title}"`);
    }
  }
  if (!sheet) {
    sheet = await doc.addSheet({ title: tabName, headerValues: defaultHeaders });
    console.log(`\u2705 Created new sheet tab: "${tabName}"`);
  } else {
    try {
      await sheet.loadHeaderRow();
      console.log(`\u2139\uFE0F Loaded header row for tab: "${sheet.title}" (${sheet.headerValues.join(", ")})`);
    } catch (error) {
      console.warn(`\u26A0\uFE0F Could not load headers for "${sheet.title}", setting defaults...`);
      await sheet.setHeaderRow(defaultHeaders);
    }
  }
  return sheet;
}
async function saveToGoogleSheet(data) {
  const sheetId = process.env.GOOGLE_SHEET_ID_CONTACT || "1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY";
  if (!sheetId) {
    console.error("\u274C [contact] Missing Sheet ID in environment variables");
    throw new Error("Technical Error: Sheet ID for contact is not configured.");
  }
  console.log(`[contact] Using Sheet ID: ${sheetId.substring(0, 5)}...${sheetId.substring(sheetId.length - 4)}`);
  const tabName = "contactform";
  const headers = ["Date", "Full Name", "Email", "Message"];
  try {
    const sheet = await getSheet(sheetId, tabName, headers);
    const now = (/* @__PURE__ */ new Date()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    let rowData = {};
    const mappings = [
      { key: "Date", value: now },
      { key: "Full Name", value: data.fullName || data.name || "(No Name)", aliases: ["name", "full name", "fullname", "full_name", "names"] },
      { key: "Email", value: data.email || data.emailAddress || "(No Email)", aliases: ["email", "email address", "email_address", "emailaddress", "emails"] },
      { key: "Message", value: data.message || data.msg || data.body || data.question || "(No Message)", aliases: ["message", "question", "msg", "body", "messages", "queries", "query"] }
    ];
    console.log("\u2139\uFE0F [contact] Mapping data:", JSON.stringify(data));
    mappings.forEach((m) => {
      const sanitizedVal = sanitizeSheetCell(m.value);
      const match = sheet.headerValues.find(
        (h) => h.toLowerCase().trim() === m.key.toLowerCase() || m.aliases && m.aliases.includes(h.toLowerCase().trim())
      );
      if (match) {
        rowData[match] = sanitizedVal;
      } else {
        rowData[m.key] = sanitizedVal;
      }
    });
    await sheet.addRow(rowData);
    console.log("\u2705 [contact] Row added successfully to contact form sheet");
  } catch (error) {
    console.error("\u274C [contact] Google Sheet Error:", error.message);
    if (error.message.includes("403") || error.message.includes("permission")) {
      throw new Error(`Permission Denied: Service Account has insufficient permissions.`);
    }
    if (error.message.includes("404")) {
      throw new Error(`Sheet Not Found: Ensure the Sheet ID is correct and the tab exists.`);
    }
    throw error;
  }
}
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    services: {
      sheetsConfigured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      firebaseConfigured: !!admin.apps.length
    }
  });
});
app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { fullName, name, email, emailAddress, message, msg, question } = req.body || {};
    const contactName = (fullName || name || "").trim();
    const contactEmail = (email || emailAddress || "").trim().toLowerCase();
    const contactMessage = (message || msg || question || "").trim();
    if (!contactName || contactName.length < 2 || contactName.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid full name (between 2 and 100 characters)."
      });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!contactEmail || !emailRegex.test(contactEmail) || contactEmail.length > 150) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address."
      });
    }
    if (!contactMessage || contactMessage.length < 5 || contactMessage.length > 3e3) {
      return res.status(400).json({
        success: false,
        error: "Message must be between 5 and 3000 characters."
      });
    }
    await saveToGoogleSheet({
      fullName: contactName,
      email: contactEmail,
      message: contactMessage
    });
    res.json({ success: true, message: "Your message has been received successfully." });
  } catch (error) {
    console.error("\u274C Contact submission error:", error.message);
    res.status(500).json({
      success: false,
      error: "An error occurred while submitting your message. Please try again later."
    });
  }
});
app.get("/api/n-intel/stories", async (req, res) => {
  try {
    const { date, month, category, search, includeDeleted } = req.query;
    const stories = await getAllStories({
      date,
      month,
      category,
      search,
      includeDeleted: includeDeleted === "true"
    });
    res.json({ success: true, stories });
  } catch (error) {
    console.error("Error fetching N-INTEL stories:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.param("id", (req, res, next, id) => {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ success: false, error: "Invalid identifier parameter format." });
  }
  next();
});
app.get("/api/n-intel/stories/:id", async (req, res) => {
  try {
    const story = await getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    res.json({ success: true, story });
  } catch (error) {
    console.error("Error fetching story:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/n-intel/editions", async (req, res) => {
  try {
    const editions = await getAvailableEditions();
    res.json({ success: true, editions });
  } catch (error) {
    console.error("Error fetching editions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/articles", async (req, res) => {
  try {
    const articles = await getAllArticles();
    res.json({ success: true, articles });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/articles/:id", async (req, res) => {
  try {
    const article = await getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found." });
    }
    res.json({ success: true, article });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/uploads/:filename", (req, res) => {
  try {
    const safeName = path2.basename(req.params.filename);
    const filePath = path2.join(UPLOADS_DIR, safeName);
    if (fs2.existsSync(filePath)) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(filePath);
    } else {
      res.status(404).json({ success: false, error: "File not found." });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: "Error reading file." });
  }
});
app.post("/api/articles/sync", async (req, res) => {
  try {
    const { articles } = req.body;
    if (!Array.isArray(articles)) {
      return res.status(400).json({ success: false, error: "Articles array required." });
    }
    const result = await syncArticles(articles);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error syncing articles:", error);
    res.status(500).json({ success: false, error: "Failed to sync articles." });
  }
});
app.post("/api/articles/:id/download", downloadLimiter, async (req, res) => {
  try {
    await incrementDownloadCount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to record download count." });
  }
});
app.post("/api/articles/upload-banner", publishLimiter, authenticate, (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, error: "No image data provided." });
    }
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(imageBase64, "base64");
    }
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: "Image size exceeds maximum limit of 5MB." });
    }
    let ext = "";
    if (buffer.length >= 8 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
      ext = "png";
    } else if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
      ext = "jpg";
    } else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      ext = "webp";
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid file signature. Only verified PNG, JPEG, and WebP images are permitted."
      });
    }
    try {
      if (!fs2.existsSync(UPLOADS_DIR)) {
        fs2.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const safeRandomToken = crypto.randomBytes(16).toString("hex");
      const safeName = `banner-${Date.now()}-${safeRandomToken}.${ext}`;
      const filePath = path2.join(UPLOADS_DIR, safeName);
      fs2.writeFileSync(filePath, buffer, { flag: "wx" });
      const publicUrl = `/api/uploads/${safeName}`;
      res.json({ success: true, url: publicUrl, localUrl: `/uploads/${safeName}` });
    } catch (writeErr) {
      console.error("Error writing banner image:", writeErr);
      res.status(500).json({ success: false, error: "Failed to save banner image to server storage." });
    }
  } catch (err) {
    console.error("Error uploading banner image:", err);
    res.status(500).json({ success: false, error: "Failed to process image upload." });
  }
});
app.post("/api/articles", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
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
    if (!title || typeof title !== "string" || !title.trim() || title.length > 300) {
      return res.status(400).json({ success: false, error: "Article headline is required (max 300 characters)." });
    }
    if (!bannerImageUrl || !isValidUrlOrPath(bannerImageUrl)) {
      return res.status(400).json({ success: false, error: "A valid banner image URL or uploaded file is required." });
    }
    if (authorAvatarUrl && !isValidUrlOrPath(authorAvatarUrl)) {
      return res.status(400).json({ success: false, error: "Author avatar URL must be a valid HTTP/HTTPS or uploaded image URL." });
    }
    if (!authorName || typeof authorName !== "string" || !authorName.trim() || authorName.length > 100) {
      return res.status(400).json({ success: false, error: "Author name is required (max 100 characters)." });
    }
    if (!content || typeof content !== "string" || content.trim().length < 20 || content.length > 3e5) {
      return res.status(400).json({ success: false, error: "Article content must be between 20 and 300,000 characters." });
    }
    const newArticle = await createArticle({
      title: title.trim(),
      bannerImageUrl: bannerImageUrl.trim(),
      category: typeof category === "string" && category.trim() ? category.trim() : "International Relations",
      authorName: authorName.trim(),
      authorRole: typeof authorRole === "string" && authorRole.trim() ? authorRole.trim() : "Editorial Contributor",
      authorAvatarUrl: authorAvatarUrl ? authorAvatarUrl.trim() : void 0,
      publishDate: publishDate || void 0,
      pullQuote: typeof pullQuote === "string" ? pullQuote.trim() : void 0,
      content: content.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : void 0,
      sourceReference: typeof sourceReference === "string" ? sourceReference.trim() : void 0,
      authorEmail: req.user?.email
    });
    res.status(201).json({ success: true, article: newArticle });
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ success: false, error: "Failed to create article." });
  }
});
app.put("/api/articles/:id", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const { bannerImageUrl, authorAvatarUrl, title, authorName, content } = req.body;
    if (bannerImageUrl !== void 0 && !isValidUrlOrPath(bannerImageUrl)) {
      return res.status(400).json({ success: false, error: "Invalid banner image URL provided." });
    }
    if (authorAvatarUrl !== void 0 && authorAvatarUrl && !isValidUrlOrPath(authorAvatarUrl)) {
      return res.status(400).json({ success: false, error: "Invalid author avatar URL provided." });
    }
    if (title !== void 0 && (typeof title !== "string" || !title.trim() || title.length > 300)) {
      return res.status(400).json({ success: false, error: "Article title must be between 1 and 300 characters." });
    }
    if (authorName !== void 0 && (typeof authorName !== "string" || !authorName.trim() || authorName.length > 100)) {
      return res.status(400).json({ success: false, error: "Author name must be between 1 and 100 characters." });
    }
    if (content !== void 0 && (typeof content !== "string" || content.trim().length < 20 || content.length > 3e5)) {
      return res.status(400).json({ success: false, error: "Content must be between 20 and 300,000 characters." });
    }
    const updated = await updateArticle(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Article not found." });
    }
    res.json({ success: true, article: updated });
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).json({ success: false, error: "Failed to update article." });
  }
});
app.delete("/api/articles/:id", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const success = await deleteArticle(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: "Article not found." });
    }
    res.json({ success: true, message: "Article deleted successfully." });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ success: false, error: "Failed to delete article." });
  }
});
app.post("/api/n-intel/publish", publishLimiter, authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const { rawText, date } = req.body;
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ success: false, error: "Pasted news text is required." });
    }
    if (rawText.length > 5e5) {
      return res.status(400).json({ success: false, error: "Pasted news text exceeds 500,000 characters limit." });
    }
    const pubDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalTodayDate();
    const parseResult = parseDailyNewsPost(rawText, pubDate);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error || "Failed to parse news text." });
    }
    const duplicate = await findDuplicateBatch(parseResult.hash, pubDate);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Duplicate post detected! This exact news bulletin was already published on ${duplicate.publishedAt} for date ${pubDate}. Duplicate submission was prevented.`
      });
    }
    const batch = {
      id: `batch-${pubDate.replace(/-/g, "")}-${parseResult.hash.slice(0, 8)}`,
      date: pubDate,
      rawContentHash: parseResult.hash,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      publishedBy: req.user.email || "Admin",
      storyCount: parseResult.totalStories,
      categories: parseResult.categories
    };
    await saveBatchAndStories(batch, parseResult.stories, req.user.email || "Admin");
    console.log(`\u2705 [N-INTEL] Published ${parseResult.totalStories} stories for ${pubDate} by ${req.user.email}`);
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
  } catch (error) {
    console.error("Error publishing N-INTEL batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/n-intel/sync", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const { stories, batches } = req.body;
    if (!Array.isArray(stories)) {
      return res.status(400).json({ success: false, error: "Invalid stories array." });
    }
    const result = await syncNIntelStories(stories, batches);
    const editions = await getAvailableEditions();
    console.log(`\u2705 [N-INTEL] Synced ${result.count} stories from client by ${req.user.email}. Store total: ${result.total}`);
    res.json({
      success: true,
      message: `Synced ${result.count} stories successfully. Total in storage: ${result.total}.`,
      editions
    });
  } catch (err) {
    console.error("Error syncing N-INTEL stories:", err);
    res.status(500).json({ success: false, error: "Failed to sync N-INTEL stories." });
  }
});
var handleStoryUpdate = async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const updated = await updateStory(req.params.id, req.body, req.user.email || "Admin");
    if (!updated) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    res.json({ success: true, story: updated });
  } catch (error) {
    console.error("Error updating story:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
app.patch("/api/n-intel/stories/:id", authenticate, handleStoryUpdate);
app.put("/api/n-intel/stories/:id", authenticate, handleStoryUpdate);
app.delete("/api/n-intel/stories/:id", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const isPermanent = req.query.permanent === "true";
    const adminEmail = req.user.email || "Admin";
    if (isPermanent) {
      const success2 = await purgeStory(req.params.id, adminEmail);
      if (!success2) {
        return res.status(404).json({ success: false, error: "Story not found" });
      }
      return res.json({ success: true, message: "Story permanently purged from database.", permanent: true });
    }
    const success = await deleteStory(req.params.id, adminEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    res.json({ success: true, message: "Story removed from public feed.", permanent: false });
  } catch (error) {
    console.error("Error deleting story:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/n-intel/stories/bulk-delete", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const { type, date, category, ids, permanent } = req.body;
    const adminEmail = req.user.email || "Admin";
    const isPermanent = Boolean(permanent);
    if (type === "date" || date && !category && !ids) {
      if (!date) {
        return res.status(400).json({ success: false, error: "Target date is required for date-wise deletion." });
      }
      const result = await deleteStoriesByDate(date, adminEmail, isPermanent);
      return res.json({
        success: true,
        type: "date",
        count: result.count,
        date,
        permanent: isPermanent,
        message: `${result.count} stories for ${date} ${isPermanent ? "permanently purged" : "moved to trash"}.`
      });
    }
    if (type === "category" || category) {
      if (!category) {
        return res.status(400).json({ success: false, error: "Target category is required for category-wise deletion." });
      }
      const result = await deleteStoriesByCategory(category, adminEmail, date, isPermanent);
      return res.json({
        success: true,
        type: "category",
        count: result.count,
        category,
        date,
        permanent: isPermanent,
        message: `${result.count} stories in category "${category}"${date ? ` for date ${date}` : ""} ${isPermanent ? "permanently purged" : "moved to trash"}.`
      });
    }
    if (type === "ids" || Array.isArray(ids)) {
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "Story IDs array is required." });
      }
      const result = await deleteStoriesByIds(ids, adminEmail, isPermanent);
      return res.json({
        success: true,
        type: "ids",
        count: result.count,
        ids: result.ids,
        permanent: isPermanent,
        message: `${result.count} selected stories ${isPermanent ? "permanently purged" : "moved to trash"}.`
      });
    }
    return res.status(400).json({ success: false, error: "Invalid deletion criteria. Provide date, category, or story IDs." });
  } catch (error) {
    console.error("Error during bulk deletion:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.delete("/api/n-intel/editions/:date", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const isPermanent = req.query.permanent === "true";
    const adminEmail = req.user.email || "Admin";
    const result = await deleteStoriesByDate(req.params.date, adminEmail, isPermanent);
    res.json({
      success: true,
      count: result.count,
      date: req.params.date,
      permanent: isPermanent,
      message: `Successfully deleted ${result.count} stories for date ${req.params.date}.`
    });
  } catch (error) {
    console.error("Error deleting edition by date:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/n-intel/stories/:id/restore", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const adminEmail = req.user.email || "Admin";
    const success = await restoreStory(req.params.id, adminEmail);
    if (!success) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }
    res.json({ success: true, message: "Story restored to public feed." });
  } catch (error) {
    console.error("Error restoring story:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.delete("/api/n-intel/trash/empty", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const adminEmail = req.user.email || "Admin";
    const purgedCount = await purgeAllDeletedStories(adminEmail);
    res.json({
      success: true,
      message: `Trash emptied successfully. ${purgedCount} stories permanently erased.`,
      purgedCount
    });
  } catch (error) {
    console.error("Error emptying trash:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/n-intel/audit", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Admin privileges required." });
  }
  try {
    const logs = await getAuditLogs();
    res.json({ success: true, logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/pyq", async (req, res) => {
  try {
    const sessions = await getAllPyqSessions();
    res.json({ success: true, sessions });
  } catch (err) {
    console.error("Error retrieving PYQ sessions:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to load PYQ papers" });
  }
});
app.post("/api/pyq/link", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
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
      return res.status(400).json({ success: false, error: "Missing required parameters." });
    }
    if (!isValidUrlOrPath(url)) {
      return res.status(400).json({ success: false, error: "Invalid URL. Only valid HTTP/HTTPS URLs are accepted." });
    }
    const sessionRecord = await savePyqFileRecord({
      sessionId,
      exam: exam || (sessionId.startsWith("nda") ? "NDA" : sessionId.startsWith("afcat") ? "AFCAT" : "CDS"),
      session: session || "I",
      year: Number(year) || 2026,
      title: title || sessionId,
      subjectKey,
      fileType,
      url,
      fileName: fileName || `${title || sessionId} ${subjectKey} ${fileType}`,
      fileSize: fileSize || "Drive Link"
    });
    res.json({ success: true, session: sessionRecord });
  } catch (err) {
    console.error("Error linking PYQ URL:", err);
    res.status(500).json({ success: false, error: "Failed to save link." });
  }
});
app.post("/api/pyq/delete", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
  }
  try {
    const { sessionId, subjectKey, fileType } = req.body;
    if (!sessionId || !subjectKey || !fileType) {
      return res.status(400).json({ success: false, error: "Missing required parameters." });
    }
    const sessionRecord = await deletePyqFileRecord({ sessionId, subjectKey, fileType });
    res.json({ success: true, session: sessionRecord });
  } catch (err) {
    console.error("Error deleting PYQ file:", err);
    res.status(500).json({ success: false, error: "Failed to delete file." });
  }
});
app.post("/api/pyq/sync", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
  }
  try {
    const { sessions } = req.body;
    if (!sessions || typeof sessions !== "object") {
      return res.status(400).json({ success: false, error: "Invalid sessions payload." });
    }
    const updated = await syncPyqSessions(sessions);
    res.json({ success: true, sessions: updated });
  } catch (err) {
    console.error("Error syncing PYQ sessions:", err);
    res.status(500).json({ success: false, error: "Failed to sync PYQ sessions." });
  }
});
app.get("/api/notes", async (req, res) => {
  try {
    const { subject } = req.query;
    if (typeof subject === "string" && subject.trim()) {
      const notes2 = await getNotesBySubject(subject.trim());
      return res.json({ success: true, notes: notes2 });
    }
    const notes = await getAllNotes();
    res.json({ success: true, notes });
  } catch (err) {
    console.error("Error fetching subject notes:", err);
    res.status(500).json({ success: false, error: "Failed to retrieve notes." });
  }
});
app.post("/api/notes/link", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
  }
  try {
    const { subjectId, subjectTitle, title, category, url, fileSize } = req.body;
    if (!subjectId || !subjectTitle || !title || !url) {
      return res.status(400).json({ success: false, error: "Missing required parameters." });
    }
    const note = await saveNote({
      subjectId,
      subjectTitle,
      title,
      category,
      url: url.trim(),
      fileName: title.trim(),
      fileSize: fileSize || "Online Document"
    });
    res.json({ success: true, note });
  } catch (err) {
    console.error("Error linking subject note:", err);
    res.status(500).json({ success: false, error: "Failed to save note link." });
  }
});
app.post("/api/notes/delete", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
  }
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "Missing note ID." });
    }
    const success = await deleteNote(id);
    res.json({ success });
  } catch (err) {
    console.error("Error deleting subject note:", err);
    res.status(500).json({ success: false, error: "Failed to delete note." });
  }
});
app.post("/api/notes/sync", authenticate, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: "Access denied: Administrator privileges required." });
  }
  try {
    const { notes } = req.body;
    if (!Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: "Invalid notes array." });
    }
    const updated = await syncNotes(notes);
    res.json({ success: true, notes: updated });
  } catch (err) {
    console.error("Error syncing notes:", err);
    res.status(500).json({ success: false, error: "Failed to sync notes." });
  }
});
app.use((err, req, res, next) => {
  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  const status = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "An unexpected internal error occurred. Please try again later." : err.message || "Internal server error"
  });
});
async function setupServer() {
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID_CONTACT
  } = process.env;
  console.log("--- Environment Variable Check ---");
  console.log("GOOGLE_SERVICE_ACCOUNT_EMAIL:", GOOGLE_SERVICE_ACCOUNT_EMAIL ? "\u2705 Present" : "\u274C Missing");
  console.log("GOOGLE_PRIVATE_KEY:", GOOGLE_PRIVATE_KEY ? "\u2705 Present" : "\u274C Missing");
  console.log("GOOGLE_SHEET_ID_CONTACT:", GOOGLE_SHEET_ID_CONTACT || "1gGWQxXAuKCpt99m6efSBwaDUqLFJn_7f-WnESPOnmQY" ? "\u2705 Present" : "\u274C Missing");
  console.log("GOOGLE_DRIVE_FOLDER_ID:", process.env.GOOGLE_DRIVE_FOLDER_ID ? "\u2705 Present (Google Drive Uploads Active)" : "\u26A0\uFE0F Not Set (Using Local Storage fallback)");
  console.log("---------------------------------");
  if (!process.env.VERCEL) {
    try {
      await seedSampleDataIfEmpty(SAMPLE_NINTEL_POST);
    } catch (err) {
      console.warn("\u26A0\uFE0F Could not seed sample N-INTEL data:", err);
    }
  }
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path2.join(process.cwd(), "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    }
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`\u{1F680} Server running on http://localhost:${PORT}`);
    });
  }
}
if (!process.env.VERCEL) {
  setupServer();
}
var config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};
var server_default = app;
export {
  config,
  server_default as default
};
