import type { NIntelStory, NIntelCategory } from './types';
import { getLocalTodayDate } from './n-intel-whatsapp';
export { getLocalTodayDate };
import { NINTEL_CORE_CATEGORIES } from './types';

/**
 * Fast deterministic string hash that runs in both browser and server environments
 */
function computeTextHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 2166136261);
  }
  return Math.abs(h1).toString(16).padStart(8, '0') + Math.abs(h2).toString(16).padStart(8, '0');
}

export interface ParseResult {
  success: boolean;
  date: string;
  hash: string;
  stories: NIntelStory[];
  categories: string[];
  totalStories: number;
  error?: string;
}

/**
 * Categories and keywords explicitly excluded because they are not relevant for defence aspirants
 * (e.g. currency/rates, stock indices, bullion rates, fuel prices, mishaps/accidents, entertainment, ads)
 */
const EXCLUDED_CATEGORY_KEYWORDS = [
  // Mishaps / Accidents / Local Crime
  'MISHAP',
  'MISHAPS',
  'ACCIDENT',
  'ACCIDENTS',
  'CRIME',
  'CRIMES',
  'TRAGEDY',
  // Entertainment / Gossip
  'ENTERTAINMENT',
  'BOLLYWOOD',
  'CELEBRITY',
  'GOSSIP',
  'CINEMA',
  'MOVIES',
  'HOROSCOPE',
  'ASTROLOGY',
  'VIRAL',
  'ODD NEWS',
  // Financial Tickers, Currencies, Stock Indices, Bullion & Fuel Rates
  'INDIAN RUPEE',
  'RUPEE VALUE',
  'RUPEE',
  'BSE SENSEX',
  'SENSEX',
  'BSE',
  'NIFTY',
  'NSE',
  'RATES IN FINANCIAL CAPITAL',
  'RATES IN',
  'FINANCIAL CAPITAL MUMBAI',
  'FINANCIAL CAPITAL',
  'MUMBAI RATES',
  'GOLD RATE',
  'SILVER RATE',
  'BULLION',
  'FOREX',
  'CURRENCY',
  'CURRENCIES',
  'EXCHANGE RATE',
  'EXCHANGE RATES',
  'COMMODITY',
  'COMMODITIES',
  'FUEL PRICES',
  'PETROL',
  'DIESEL',
  'MARKET UPDATE',
  'MARKET WATCH',
  'STOCK MARKET',
  'SHARE MARKET',
  'WEATHER',
  'TEMPERATURE',
  'AQI',
  'AIR QUALITY',
  // Promotional / Community
  'PROMOTION',
  'LINKTREE',
  'SPONSORED',
  'ADVERTISEMENT',
  'JOIN NISHCHAY',
  'SUBSCRIBE',
  'COMMUNITY LINK'
];

/**
 * Validated core and extended exam categories for N-INTEL.
 * Only these verified categories may be listed on the platform.
 */
export const VALID_NINTEL_CATEGORIES = [
  'Defence News',
  'National Affairs',
  'International Relations',
  'Important Appointments',
  'Polity & Judiciary',
  'World News',
  'Sports',
  'Science & Technology',
  'Economy & Banking',
  'Environment & Ecology',
  'Awards & Honours',
  'Summits & Conferences',
  'Government Schemes',
] as const;

export function isExcludedHeader(text: string): boolean {
  const cleaned = text
    .replace(/[^\p{L}\p{N}\s&/()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!cleaned) return false;
  return EXCLUDED_CATEGORY_KEYWORDS.some(kw => cleaned === kw || cleaned.includes(kw));
}

/**
 * Resolves an incoming section header:
 * - Maps to recognized defence/exam categories
 * - Disallows all irrelevant categories, market quotes, financial rate cards, etc.
 * - Returns null if the header is not a valid exam-relevant category.
 */
export function resolveCategory(header: string): string | null {
  // Strip emojis, non-letter characters, asterisks, dashes, underlines, equal signs
  const cleaned = header
    .replace(/[^\p{L}\p{N}\s&/()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3) return null;

  const upper = cleaned.toUpperCase();

  // 1. Check exclusion keywords first (rates, sensex, rupee, mishaps, entertainment, etc.)
  for (const ex of EXCLUDED_CATEGORY_KEYWORDS) {
    if (upper === ex || upper.includes(ex)) {
      return null; // Excluded from aspirant briefing
    }
  }

  // 2. Normalize standard core exam categories
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

  if (
    (upper.includes("TOP") && upper.includes("NEWS")) ||
    upper.includes("TODAY") ||
    upper.includes("NATIONAL") ||
    upper.includes("INDIA NEWS") ||
    upper.includes("BHARAT") ||
    upper.includes("CABINET") ||
    upper.includes("PARLIAMENT") ||
    upper.includes("HEADLINE")
  ) {
    return "National Affairs";
  }

  // Sports category
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

  // Strictly disallow any arbitrary / irrelevant category creation
  return null;
}

/**
 * Detects whether a text snippet is purely financial ticker/market numbers, currency exchange rates, or commodity price quotes
 */
function isPureTickerOrRates(text: string): boolean {
  const upper = text.toUpperCase();

  // 1. Currency rates snippet (GBP, USD, Euro, CAD, Dirham, Approx)
  const currencyHits = (upper.match(/\b(GBP|USD|CAD|DIRHAM|RUPIYA|NGULTRUM|TAKA|EURO|YEN|YUAN|CURRENCY)\b/g) || []).length;
  if (currencyHits >= 2 || (currencyHits >= 1 && upper.includes('APPROX'))) {
    return true;
  }

  // 2. Stock market ticker index change (e.g. "73,246.03 -352.64 (0.48%)🔻" or "22,698.85 -50.90 (0.22%)")
  if (/^\s*[\d,.]+\s+[+-]?[\d,.]+\s+\([+-]?[\d,.]+%?\)\s*[🔻🔺▲▼]?\s*$/m.test(text.trim())) {
    return true;
  }

  // 3. Bullion rates (e.g. "*GOLD* : ₹ 14,395" / "*SILVER* : ₹ 2,20,000")
  if ((upper.includes('GOLD') && upper.includes('SILVER') && (text.includes('₹') || upper.includes('KRT') || upper.includes('KG'))) && text.length < 250) {
    return true;
  }

  // 4. Standalone fuel / commodity price list without editorial sentences
  if ((upper.includes('PETROL') || upper.includes('DIESEL')) && text.includes('₹') && text.length < 150) {
    return true;
  }

  return false;
}

/**
 * Extracts a concise, accurate headline from story text without truncating meaningful titles
 */
function extractHeadline(raw: string): string {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return "Untitled News Story";

  const firstLine = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();

  // 1. Explicit dash or colon title (e.g. "In Panipat, Haryana — Worker Charred to Death...")
  const sepMatch = firstLine.match(/^(.+?)(?:\s+[—–]\s+|\s*:\s+)(.+)$/);
  if (sepMatch && sepMatch[1].length > 8 && sepMatch[1].length < 130) {
    return sepMatch[1].trim();
  }

  // 2. If first line is a distinct short title line with no terminal period and there are more lines
  if (lines.length > 1 && firstLine.length > 10 && firstLine.length < 110 && !firstLine.endsWith('.')) {
    return firstLine;
  }

  // 3. Sentence boundary detection protecting common honorifics and abbreviations
  const protectedText = firstLine
    .replace(/\b(Shri|Smt|Dr|Mr|Mrs|Ms|Prof|Gen|Lt|Maj|Col|Capt|Adm|Air|CEN|No|vs|v)\./gi, '$1__DOT__')
    .replace(/\b([A-Z])\.([A-Z])\./g, '$1__DOT__$2__DOT__')
    .replace(/\b([A-Z])\.\s/g, '$1__DOT__ ');

  const sMatch = protectedText.match(/^([^.!?\n]+[.!?]?)/);
  let headline = sMatch ? sMatch[1] : firstLine;
  headline = headline.replace(/__DOT__/g, '.').replace(/^\d+[\.\)]\s*/, '').trim();

  // If sentence is too long, find word break near 120 chars
  if (headline.length > 135) {
    const cut = headline.slice(0, 125).lastIndexOf(' ');
    headline = (cut > 50 ? headline.slice(0, cut) : headline.slice(0, 122)) + '...';
  }

  return headline || "Daily News Update";
}

/**
 * Scans text for official agency or publication sources
 */
function extractSource(content: string): { sourceName?: string; sourceUrl?: string } {
  let sourceUrl: string | undefined;
  const urlMatch = content.match(/https?:\/\/[^\s\)\],;]+/i);
  if (urlMatch) {
    // Exclude community promotional links
    if (!urlMatch[0].includes('linktr.ee') && !urlMatch[0].includes('chat.whatsapp')) {
      sourceUrl = urlMatch[0];
    }
  }

  let sourceName: string | undefined;
  const knownSources = [
    'PIB', 'Press Information Bureau', 'IMD', 'India Meteorological Department',
    'Supreme Court', 'High Court', 'ZSI', 'Zoological Survey of India',
    'TRAI', 'NCRB', 'UNFCCC', 'Zootaxa', 'Bar Council', 'DPIIT', 'RRB',
    'Ministry of Defence', 'MoD', 'ISRO', 'DRDO', 'NHRC', 'UNESCO', 'WHO', 'BRICS'
  ];

  for (const src of knownSources) {
    const regex = new RegExp(`\\b${src}\\b`, 'i');
    if (regex.test(content)) {
      sourceName = src;
      break;
    }
  }

  return { sourceName, sourceUrl };
}

/**
 * Determines whether this news item is defence-related
 */
function checkIsDefence(category: string, content: string): boolean {
  if (/defence|military|naval|army|navy|air force|drdo|armed forces/i.test(category)) {
    return true;
  }
  const defenceKeywords = [
    /\b(?:exercise|warship|frigate|patrol vessel|corpat|simbex|garuda|varuna|malabar|yudh abhyas|ins |iaf|icgs)\b/i,
    /\b(?:air force|indian army|indian navy|coast guard|shaurya diwas|infantry|admm-plus)\b/i,
    /\b(?:indo-tibetan border police|itbp|sashastra seema bal|bsf|crpf|cisf|assam rifles)\b/i,
    /\b(?:integrated defence staff|hq ids|sullage barge|stealth frigate|combat marksmanship)\b/i
  ];
  return defenceKeywords.some(regex => regex.test(content));
}

/**
 * Extracts relevant keyword tags
 */
function generateTags(category: string, content: string, sourceName?: string, isDefence?: boolean): string[] {
  const tags: string[] = [category];
  if (isDefence && !tags.includes('Defence')) tags.push('Defence');
  if (sourceName && !tags.includes(sourceName)) tags.push(sourceName);

  // Common military/exam tags
  const exercises = content.match(/\b(?:GARUDA SHAKTI|SIMBEX(?:-20\d\d)?|ADMM-PLUS|SHAURYA DIWAS|NGOPV|TEPA)\b/gi);
  if (exercises) {
    exercises.forEach(e => {
      const u = e.toUpperCase();
      if (!tags.includes(u)) tags.push(u);
    });
  }

  // Vessel / Unit tags
  const vessels = content.match(/\b(?:INS\s+[A-Za-z]+|ICGS\s+[A-Za-z]+)\b/gi);
  if (vessels) {
    vessels.forEach(v => {
      const u = v.toUpperCase();
      if (!tags.includes(u)) tags.push(u);
    });
  }

  return tags.slice(0, 5);
}

/**
 * Automatically classifies a news item into an exam-relevant category based on content keywords
 */
export function classifyStory(content: string): NIntelCategory {
  if (checkIsDefence('', content)) {
    return 'Defence News';
  }
  const upper = content.toUpperCase();
  if (/\b(CRICKET|OLYMPIC|GAMES|CHAMPIONSHIP|TOURNAMENT|WTA|ATP|FIFA|BWF|MEDAL|TROPHY|HOCKEY|BADMINTON|CHESS|TENNIS|ATHLETE)\b/.test(upper)) {
    return 'Sports';
  }
  if (/\b(ISRO|DRDO|NASA|SATELLITE|ROCKET|ASTRONOMY|QUANTUM|SUPERCOMPUTER|AI|ARTIFICIAL INTELLIGENCE|CYBER|TECH|GENOME|PATENT)\b/.test(upper)) {
    return 'Science & Technology';
  }
  if (/\b(SUPREME COURT|HIGH COURT|CJI|BENCH|VERDICT|TRIBUNAL|CONSTITUTION|ARTICLE \d+|LEGAL|JUDICIARY|BAR COUNCIL|ADVOCATE)\b/.test(upper)) {
    return 'Polity & Judiciary';
  }
  if (/\b(APPOINTED|APPOINTMENT|TOOK CHARGE|ASSUMED CHARGE|NEW CHIEF|ELECTED|SWEARING-IN|OATH OF OFFICE|SWORN IN|DG |DIRECTOR GENERAL)\b/.test(upper)) {
    return 'Important Appointments';
  }
  if (/\b(BILATERAL|DIPLOMATIC|AMBASSADOR|HIGH COMMISSIONER|TREATY|ACCORD|SUMMIT|SCO|G20|BRICS|ASEAN|UN |UNFCCC|UNESCO|WORLD BANK|IMF)\b/.test(upper)) {
    return 'International Relations';
  }
  if (/\b(RESERVE BANK|RBI|INFLATION|REPO RATE|GDP|CURRENT ACCOUNT|SEBI|EXPORT|IMPORT|TRADE DEFICIT|BUDGET)\b/.test(upper)) {
    return 'Economy & Banking';
  }
  if (/\b(POLLUTION|AIR QUALITY|AQI|FOREST|TIGER RESERVE|WILDLIFE|BIODIVERSITY|CARBON|CLIMATE CHANGE|WETLAND|RAMSAR)\b/.test(upper)) {
    return 'Environment & Ecology';
  }
  return 'National Affairs';
}

/**
 * Detects whether a line represents a section header (e.g. *DEFENCE NEWS*, *TODAYS TOP NEWS*, ## Sports, etc.)
 */
function detectHeader(line: string): { isHeader: boolean; isExcluded: boolean; category: NIntelCategory | null } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 110) {
    return { isHeader: false, isExcluded: false, category: null };
  }

  // Check if line looks like a header:
  // 1. Surrounded or prefixed by asterisks (*...* or **...**)
  // 2. Starts with markdown header (# or ##)
  // 3. Or short line (<= 65 chars) without sentence-ending punctuation (.!?)
  const hasAsterisks = /^\*+[^*]+\*+$/u.test(trimmed) || (trimmed.startsWith('*') && trimmed.endsWith('*'));
  const hasMarkdown = /^#{1,4}\s+/.test(trimmed);
  const isShortNonSentence = trimmed.length <= 65 && !/[.!?]$/.test(trimmed);

  if (!hasAsterisks && !hasMarkdown && !isShortNonSentence) {
    return { isHeader: false, isExcluded: false, category: null };
  }

  // Clean candidate of non-word edges, emojis, and symbols
  const candidate = trimmed
    .replace(/^[\s*#_~=\-–—:;|•+[\](){}\u2022\u25E6\u25AA\p{Extended_Pictographic}]+/gu, '')
    .replace(/[\s*#_~=\-–—:;|•+[\](){}\u2022\u25E6\u25AA\p{Extended_Pictographic}]+$/gu, '')
    .trim();

  if (!candidate || candidate.length < 3) {
    return { isHeader: false, isExcluded: false, category: null };
  }

  // Check if explicitly excluded (e.g. MISHAPS, WEATHER, BULLION, etc.)
  if (isExcludedHeader(candidate)) {
    return { isHeader: true, isExcluded: true, category: null };
  }

  // Check if maps to a recognized category
  const resolved = resolveCategory(candidate);
  if (resolved) {
    return { isHeader: true, isExcluded: false, category: resolved as NIntelCategory };
  }

  // If line was explicitly enclosed in asterisks or markdown, treat as unknown non-exam header
  if (hasAsterisks || hasMarkdown) {
    return { isHeader: true, isExcluded: true, category: null };
  }

  return { isHeader: false, isExcluded: false, category: null };
}

function resolveEditionSectionCategory(section: string): NIntelCategory | null {
  const normalized = section.toUpperCase();
  if (/HISTORY|HERITAGE|CULTURE/.test(normalized)) return 'National Affairs';
  return resolveCategory(section);
}

/** Parse the structured Defence Aspirants Daily edition while leaving the older WhatsApp format supported. */
function parseStructuredEdition(rawText: string, date: string, hash: string): ParseResult {
  const categories: string[] = [];
  const stories: NIntelStory[] = [];
  const batchId = `batch-${date.replace(/-/g, '')}-${hash.slice(0, 8)}`;
  const lines = rawText.split(/\r?\n/);
  let currentCategory: NIntelCategory | null = null;
  let currentHeadline = '';
  let currentStoryNumber = 0;
  let storyLines: string[] = [];

  const saveStory = () => {
    if (!currentHeadline || storyLines.length === 0) return;
    const content = storyLines.join('\n').trim();
    if (!content) return;

    const category = currentCategory || classifyStory(`${currentHeadline}\n${content}`);
    if (!categories.includes(category)) categories.push(category);
    const { sourceName, sourceUrl } = extractSource(content);
    const isDefence = category === 'Defence News' || checkIsDefence(category, `${currentHeadline}\n${content}`);
    const categoryKey = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const now = new Date().toISOString();

    stories.push({
      id: `nintel-${date.replace(/-/g, '')}-${categoryKey.slice(0, 6)}-${String(stories.length + 1).padStart(2, '0')}`,
      batchId,
      headline: currentHeadline,
      content,
      category,
      categoryKey,
      date,
      itemNumber: currentStoryNumber || stories.length + 1,
      sourceName,
      sourceUrl,
      tags: generateTags(category, `${currentHeadline}\n${content}`, sourceName, isDefence),
      isDefence,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentHeadline && storyLines.length > 0 && storyLines[storyLines.length - 1] !== '') {
        storyLines.push('');
      }
      continue;
    }

    if (/^QUICK REVISION\b/i.test(line) || /^END OF (?:SAMPLE )?EDITION\b/i.test(line)) {
      saveStory();
      currentHeadline = '';
      storyLines = [];
      break;
    }

    if (/^[-=~_]{3,}$/.test(line)) continue;

    const sectionMatch = line.match(/^\d+\.\s+(.+)$/);
    if (sectionMatch && sectionMatch[1] === sectionMatch[1].toLocaleUpperCase()) {
      saveStory();
      currentHeadline = '';
      storyLines = [];
      currentCategory = resolveEditionSectionCategory(sectionMatch[1]);
      continue;
    }

    const storyMatch = line.match(/^(\d+)\.(\d+)\s+(.+)$/);
    if (storyMatch) {
      saveStory();
      currentHeadline = storyMatch[3].trim();
      currentStoryNumber = stories.length + 1;
      storyLines = [];
      continue;
    }

    if (currentHeadline) storyLines.push(line);
  }

  saveStory();

  return {
    success: stories.length > 0,
    date,
    hash,
    stories,
    categories,
    totalStories: stories.length,
    ...(stories.length === 0 ? { error: 'Could not find any numbered stories. Each story title should start with a number like 1.1.' } : {})
  };
}

/**
 * Main parser entrypoint
 */
export function parseDailyNewsPost(rawText: string, pubDate?: string): ParseResult {
  const dateStr = pubDate && /^\d{4}-\d{2}-\d{2}$/.test(pubDate)
    ? pubDate
    : getLocalTodayDate();

  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      date: dateStr,
      hash: '',
      stories: [],
      categories: [],
      totalStories: 0,
      error: 'Pasted text is empty. Please paste the daily news post.'
    };
  }

  // Generate deterministic hash of normalized text to prevent accidental duplicates
  const normalizedForHash = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
  const hash = computeTextHash(normalizedForHash);

  if (/^\s*THE DEFENCE ASPIRANTS DAILY\b/im.test(rawText) && /^\s*\d+\.\d+\s+\S/m.test(rawText)) {
    return parseStructuredEdition(rawText, dateStr, hash);
  }

  const lines = rawText.split(/\r?\n/);
  const categories: string[] = [];
  const stories: NIntelStory[] = [];
  const batchId = `batch-${dateStr.replace(/-/g, '')}-${hash.slice(0, 8)}`;

  let currentCategory: NIntelCategory | null = null;
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

    // Skip promotional community / linktree snippets
    if ((raw.includes('linktr.ee/') || raw.toLowerCase().includes('join nishchay defence')) && raw.length < 250) {
      currentStoryText = "";
      return;
    }

    // Skip financial ticker, exchange rate tables, and commodity price quotes
    if (isPureTickerOrRates(raw)) {
      currentStoryText = "";
      return;
    }

    // If no explicit header was active, auto-classify based on content!
    const effectiveCategory = currentCategory || classifyStory(raw);
    if (!categories.includes(effectiveCategory)) {
      categories.push(effectiveCategory);
    }

    const headline = extractHeadline(raw);
    const { sourceName, sourceUrl } = extractSource(raw);
    const isDefence = effectiveCategory === 'Defence News' || checkIsDefence(effectiveCategory, raw);
    const tags = generateTags(effectiveCategory, raw, sourceName, isDefence);
    const categoryKey = effectiveCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const storyId = `nintel-${dateStr.replace(/-/g, '')}-${categoryKey.slice(0, 6)}-${(stories.length + 1).toString().padStart(2, '0')}`;

    stories.push({
      id: storyId,
      batchId,
      headline,
      content: raw,
      category: effectiveCategory,
      categoryKey,
      date: dateStr,
      itemNumber: currentStoryNum || (stories.length + 1),
      sourceName,
      sourceUrl,
      tags,
      isDefence,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    currentStoryText = "";
  }

  // Regex to detect story starter prefixes:
  // "1. ", "1) ", "(1) ", "[1] ", "1 - ", "1: ", "• ", "- ", "* "
  const storyStartRegex = /^(?:(?:[\[(]?(\d+)[\]).:\-]\s*)|(?:[•\-\*\u2022\u25E6\u25AA—]\s+))(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      previousLineWasBlank = true;
      continue;
    }

    // Ignore horizontal separator lines like --------------------
    if (/^[-=~_]{3,}$/.test(line)) {
      previousLineWasBlank = true;
      continue;
    }

    // 1. Check if line is a section header
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

    // 2. Check if line starts a new story (numbered or bulleted)
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

    // 3. Check for paragraph-separated stories (if preceded by blank line and starts with capital letter)
    if (previousLineWasBlank && currentStoryText.length > 90 && /^[A-Z"'\u2018\u201C]/.test(line)) {
      commitStory();
      currentStoryNum = stories.length + 1;
      currentStoryText = line;
      previousLineWasBlank = false;
      continue;
    }

    // 4. Continuation line
    if (currentStoryText) {
      currentStoryText += "\n" + line;
    } else if (!inIgnoredSection) {
      currentStoryText = line;
    }
    previousLineWasBlank = false;
  }

  commitStory();

  // Fail-safe: If no stories were extracted through line parsing, attempt paragraph fallback
  if (stories.length === 0 && rawText.trim().length > 30) {
    const paragraphs = rawText.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const p = paragraphs[pIdx];
      if (p.length < 25) continue;
      if (p.includes('linktr.ee/') || isPureTickerOrRates(p)) continue;

      const cat = classifyStory(p);
      if (!categories.includes(cat)) categories.push(cat);

      const headline = extractHeadline(p);
      const isDefence = cat === 'Defence News' || checkIsDefence(cat, p);
      const categoryKey = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const storyId = `nintel-${dateStr.replace(/-/g, '')}-${categoryKey.slice(0, 6)}-${(stories.length + 1).toString().padStart(2, '0')}`;

      stories.push({
        id: storyId,
        batchId,
        headline,
        content: p,
        category: cat,
        categoryKey,
        date: dateStr,
        itemNumber: stories.length + 1,
        tags: generateTags(cat, p, undefined, isDefence),
        isDefence,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
      error: 'Could not extract any stories. Ensure the text has news content or numbered updates.'
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
