import crypto from 'crypto';
import type { NIntelStory, NIntelCategory } from './types';
import { getLocalTodayDate } from './n-intel-whatsapp';
export { getLocalTodayDate };
import { NINTEL_CORE_CATEGORIES } from './types';

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

/**
 * Resolves an incoming section header:
 * - Maps to recognized defence/exam categories
 * - Disallows all irrelevant categories, market quotes, financial rate cards, etc.
 * - Returns null if the header is not a valid exam-relevant category.
 */
export function resolveCategory(header: string): string | null {
  // Strip emojis, asterisks, dashes, underlines, equal signs
  const cleaned = header
    .replace(/[✈🌎🌍🏆🚣🚴🏇🏊🎖️🇮🇳🤝🛡️🚀⚡💡🔍📌\*\-=~_#]+/gu, ' ')
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
  if (upper.includes("DEFENCE") || upper.includes("DEFENSE") || upper.includes("MILITARY") || upper.includes("ARMED FORCES") || upper.includes("ARMY") || upper.includes("NAVY") || upper.includes("AIR FORCE")) {
    return "Defence News";
  }

  if (upper.includes("APPOINTMENT") || upper.includes("RESIGNATION") || upper.includes("NEW CHIEF") || upper.includes("ELECTED")) {
    return "Important Appointments";
  }

  if (upper.includes("LEGAL") || upper.includes("JUDICIARY") || upper.includes("POLITY") || upper.includes("COURT") || upper.includes("CONSTITUTION") || upper.includes("LAW")) {
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
    upper.includes("NATIONAL") ||
    upper.includes("INDIA NEWS") ||
    upper.includes("BHARAT") ||
    upper.includes("CABINET") ||
    upper.includes("PARLIAMENT")
  ) {
    return "National Affairs";
  }

  // Sports category
  if (upper.includes("SPORT") || upper.includes("CRICKET") || upper.includes("OLYMPIC") || upper.includes("GAMES") || upper.includes("CHAMPIONSHIP") || upper.includes("TOURNAMENT")) {
    return "Sports";
  }

  if (upper.includes("SCIENCE") || upper.includes("TECH") || upper.includes("SPACE") || upper.includes("ISRO") || upper.includes("DRDO") || upper.includes("INNOVATION")) {
    return "Science & Technology";
  }

  if (upper.includes("ECONOM") || upper.includes("BANKING") || upper.includes("FINANCE") || upper.includes("RBI") || upper.includes("BUDGET") || upper.includes("COMMERCE") || upper.includes("TRADE")) {
    return "Economy & Banking";
  }

  if (upper.includes("ENVIRONMENT") || upper.includes("ECOLOGY") || upper.includes("CLIMATE") || upper.includes("FOREST") || upper.includes("WILDLIFE")) {
    return "Environment & Ecology";
  }

  if (upper.includes("AWARD") || upper.includes("HONOUR") || upper.includes("HONOR") || upper.includes("PRIZE") || upper.includes("MEDAL")) {
    return "Awards & Honours";
  }

  if (upper.includes("SUMMIT") || upper.includes("CONFERENCE") || upper.includes("CONCLAVE") || upper.includes("MEETING")) {
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

  // Generate SHA-256 hash of normalized text to prevent accidental duplicates
  const normalizedForHash = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalizedForHash).digest('hex');

  const lines = rawText.split(/\r?\n/);
  const categories: string[] = [];
  const stories: NIntelStory[] = [];
  const batchId = `batch-${dateStr.replace(/-/g, '')}-${hash.slice(0, 8)}`;

  let currentCategory: NIntelCategory | null = null;
  let inIgnoredSection = false;
  let currentStoryText = "";
  let currentStoryNum = 0;

  // Regex to detect section headers:
  // Examples:
  // *TODAYS TOP NEWS*
  // *NEW APPOINTMENT*
  // ------ *MISHAPS*----------
  // *DEFENCE News*
  // ✈ *INTERNATIONAL NEWS*
  // 🌎 *WORLD NEWS* 🌍
  // 🚣🚴🏇🏊 *SPORTS*
  // Or any lines starting and ending with * and containing letters
  const headerRegex = /^(?:[-=\s*~_]*)(?:[^\w\s*]*\s*)?\*+([A-Za-z0-9\s&',.\-–—/()]+)\*+(?:[-=\s*~_]*)(?:[^\w\s*]*\s*)$/u;

  function commitStory() {
    // If not in an allowed category, ignore completely!
    if (inIgnoredSection || !currentCategory) {
      currentStoryText = "";
      return;
    }

    if (!currentStoryText.trim()) return;
    const raw = currentStoryText.trim();

    // Skip promotional community / linktree snippets
    if ((raw.includes('linktr.ee/') || raw.toLowerCase().includes('join nishchay defence')) && raw.length < 200) {
      currentStoryText = "";
      return;
    }

    // Skip financial ticker, exchange rate tables, and commodity price quotes
    if (isPureTickerOrRates(raw)) {
      currentStoryText = "";
      return;
    }

    const headline = extractHeadline(raw);
    const { sourceName, sourceUrl } = extractSource(raw);
    const isDefence = currentCategory === 'Defence News' || checkIsDefence(currentCategory, raw);
    const tags = generateTags(currentCategory, raw, sourceName, isDefence);
    const categoryKey = currentCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const storyId = `nintel-${dateStr.replace(/-/g, '')}-${categoryKey.slice(0, 6)}-${(stories.length + 1).toString().padStart(2, '0')}`;

    stories.push({
      id: storyId,
      batchId,
      headline,
      content: raw,
      category: currentCategory,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Ignore horizontal separator lines like --------------------
    if (/^[-=~_]{3,}$/.test(line)) continue;

    // Check if line is a header
    const hMatch = line.match(headerRegex);
    const starMatch = line.match(/^\*+([A-Za-z0-9\s&',.\-–—/()]+)\*+$/);

    if (hMatch || starMatch) {
      commitStory();
      const rawHeader = (hMatch ? hMatch[1] : starMatch![1]);
      const mapped = resolveCategory(rawHeader);

      if (mapped) {
        currentCategory = mapped;
        inIgnoredSection = false;
        if (!categories.includes(mapped)) {
          categories.push(mapped);
        }
      } else {
        // Ignored non-exam category (e.g. MISHAPS, ENTERTAINMENT, etc.)
        currentCategory = null;
        inIgnoredSection = true;
      }
      continue;
    }

    // Check if line starts a numbered story e.g. "1.  ", "14. "
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      commitStory();
      currentStoryNum = parseInt(numMatch[1], 10);
      // If no header had been encountered yet and we are not in an ignored section, default to National Affairs
      if (!currentCategory && !inIgnoredSection) {
        currentCategory = "National Affairs";
        if (!categories.includes("National Affairs")) {
          categories.push("National Affairs");
        }
      }
      currentStoryText = numMatch[2].trim();
    } else {
      // Continuation line
      if (currentStoryText) {
        currentStoryText += "\n" + line;
      } else if (!inIgnoredSection && currentCategory) {
        currentStoryText = line;
      }
    }
  }

  commitStory();

  if (stories.length === 0) {
    return {
      success: false,
      date: dateStr,
      hash,
      stories: [],
      categories: [],
      totalStories: 0,
      error: 'Could not extract any stories. Ensure the text has section headings and numbered news items.'
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
