import fs from 'fs';
import path from 'path';

export interface Article {
  id: string;
  slug: string;
  title: string;
  bannerImageUrl: string; // Compulsory field
  category: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string;
  publishDate: string;
  readingTime: string;
  pullQuote?: string;
  content: string;
  tags: string[];
  sourceReference?: string;
  viewsCount?: number;
  pdfDownloadCount?: number;
  createdAt: string;
  updatedAt?: string;
  authorEmail?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let articlesCache: Article[] | null = null;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function calculateReadingTime(text: string): string {
  const words = (text || '').trim().split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 180));
  return `${minutes} min read`;
}

function loadArticles(): Article[] {
  if (articlesCache) return articlesCache;
  ensureDataDir();

  if (!fs.existsSync(ARTICLES_FILE)) {
    // Seed initial dataset with the sample editorial from the user's brief
    const initialArticles: Article[] = [
      {
        id: 'article-tied-by-geography-divided-by-politics',
        slug: 'tied-by-geography-divided-by-politics',
        title: 'Tied by geography, divided by politics',
        bannerImageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
        category: 'International Relations',
        authorName: 'Mohammed Ayoob',
        authorRole: 'University Distinguished Professor Emeritus of International Relations, Michigan State University, and author of "The Liberation War" (1972)',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        publishDate: '2026-10-30',
        readingTime: '7 min read',
        pullQuote: 'India and Bangladesh must overcome mistrust and pursue pragmatic neighbourhood cooperation.',
        tags: ['International Relations', 'India-Bangladesh', 'Foreign Policy', '1971 Liberation War', 'Defence Studies'],
        sourceReference: 'Strategic Analysis & Editorial Study',
        viewsCount: 142,
        pdfDownloadCount: 29,
        createdAt: new Date().toISOString(),
        content: `With speculation rife that Bangladesh's recently elected Prime Minister Tarique Rahman (and also Bangladesh Nationalist Party [BNP] Chairman) will be visiting New Delhi in November or December, it is time to assess the state of India-Bangladesh relations and analyse the roots of the problems between the two countries.

The seeds of their current tension lie in the ==liberation war of 1971== itself. From the very beginning, the attitude of Bangladesh's elites toward India has wavered between gratitude and resentment — gratitude for India's crucial role in the liberation of their country and resentment against the fact that India had to play the role of liberator — a role they should have performed themselves.

### An ambivalence
Nations cherish narratives in which they are the principal authors of their own liberation. Bangladesh is no exception. The contribution of the Mukti Bahini notwithstanding, the decisive military blow against Pakistan was delivered by India. What was initially the source of immense gratitude with the passage of time became a source of grave discomfort.

Moreover, from the very beginning Dhaka was worried that India's policy towards Bangladesh would be mediated through a Hindu-majority West Bengal next door which has strong cultural and linguistic affinities with Bangladesh that could threaten the development of Bangladesh's independent identity. ^^The open borders in the immediate aftermath of the liberation war also revived memories of the socio-economic dominance of the Hindu bhadralok in pre-Partition Bengal.^^

This was compounded by the fact that ==Bangladesh was virtually surrounded by India, sharing a border of more than 4,000 kilometres.== Its principal rivers flowed through or originated in India. Its economic and strategic room for manoeuvre appeared constrained by geography. Consequently, the fear of Indian domination became an important component of Bangladeshi nationalism.

The honeymoon between Dhaka and New Delhi was indeed short. Sheikh Mujib and Indira Gandhi shared a great deal of goodwill. But the governments that succeeded Mujib deliberately distanced Bangladesh from India. Under Ziaur Rahman, ==Bangladeshi nationalism was redefined in overtly Islamic terms in contradistinction to the linguistic nationalism that had provided the ideological foundation of the liberation movement.==

### Dhaka's foreign policy
This had important foreign policy consequences. ==Dhaka sought closer relations with Pakistan, China, and the United States to counterbalance India.== What New Delhi often interpreted as gratuitous anti-Indianism was, from Dhaka's perspective, an assertion of strategic autonomy by a much weaker state living in the shadow of an overwhelmingly powerful neighbour.

This pattern became deeply embedded in Bangladesh's domestic politics. ==The Awami League remained identified with the secular and Bengali-nationalist legacy of 1971 and generally favoured close relations with India.== The BNP and its allies were much more suspicious of New Delhi. <u>India consequently ceased to be merely a foreign policy issue; attitudes towards India became part of the contest over Bangladesh's national identity.</u>

### The road ahead
The election of Mr. Rahman and the return of the BNP to power in February 2026 have opened a new chapter. Both New Delhi and Dhaka have compelling reasons to avoid permanent alienation, and functional engagement has resumed. But substantial mutual suspicion continues to bedevil bilateral relations.

==The lesson that New Delhi should draw from the turbulent history of the relationship is that India cannot expect gratitude for 1971 to constitute the permanent foundation of Bangladeshi foreign policy. Gratitude is a transient sentiment; national interest especially when linked to issues of national identity is enduring.==

Dhaka, for its part, cannot wish away geography. No relationship with Beijing, Islamabad or Washington can substitute for a workable relationship with the country that surrounds Bangladesh on three sides, shares its major river systems and is indispensable to its regional connectivity.

^^India must learn to exercise its preponderant power with restraint and sensitivity and abjure demanding reciprocity for any magnanimity it shows towards its smaller neighbour especially on the sharing of river waters. Bangladesh must recognise that strategic autonomy need not be defined through knee-jerk opposition to India.^^ Only then can the two countries finally move beyond the burdens of the past while preserving its most important legacy: the recognition that their security and stability are inextricably intertwined.`
      }
    ];

    saveArticles(initialArticles);
    articlesCache = initialArticles;
    return articlesCache;
  }

  try {
    const raw = fs.readFileSync(ARTICLES_FILE, 'utf-8');
    articlesCache = JSON.parse(raw);
    return articlesCache || [];
  } catch (e) {
    console.error('Error reading articles file:', e);
    return [];
  }
}

function saveArticles(articles: Article[]): void {
  ensureDataDir();
  articlesCache = articles;
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf-8');
}

export function getAllArticles(): Article[] {
  const articles = loadArticles();
  return [...articles].sort((a, b) => new Date(b.publishDate || b.createdAt).getTime() - new Date(a.publishDate || a.createdAt).getTime());
}

export function getArticleById(idOrSlug: string): Article | null {
  const articles = loadArticles();
  return articles.find(a => a.id === idOrSlug || a.slug === idOrSlug) || null;
}

export function createArticle(data: {
  title: string;
  bannerImageUrl: string;
  category: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl?: string;
  publishDate?: string;
  pullQuote?: string;
  content: string;
  tags?: string[];
  sourceReference?: string;
  authorEmail?: string;
}): Article {
  const articles = loadArticles();
  const slug = slugify(data.title) + '-' + Date.now().toString().slice(-4);
  const id = `article-${slug}`;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const publishDate = data.publishDate?.trim() || todayStr;
  const readingTime = calculateReadingTime(data.content);

  const newArticle: Article = {
    id,
    slug,
    title: data.title.trim(),
    bannerImageUrl: data.bannerImageUrl.trim(),
    category: data.category?.trim() || 'General',
    authorName: data.authorName.trim(),
    authorRole: data.authorRole?.trim() || 'Editorial Contributor',
    authorAvatarUrl: data.authorAvatarUrl?.trim() || undefined,
    publishDate,
    readingTime,
    pullQuote: data.pullQuote?.trim() || undefined,
    content: data.content.trim(),
    tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? (data.tags as string).split(',').map(t => t.trim()).filter(Boolean) : []),
    sourceReference: data.sourceReference?.trim() || undefined,
    viewsCount: 1,
    pdfDownloadCount: 0,
    createdAt: new Date().toISOString(),
    authorEmail: data.authorEmail
  };

  articles.unshift(newArticle);
  saveArticles(articles);
  return newArticle;
}

export function updateArticle(id: string, updates: Partial<Article>): Article | null {
  const articles = loadArticles();
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) return null;

  const current = articles[index];
  const updated: Article = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (updates.content) {
    updated.readingTime = calculateReadingTime(updates.content);
  }

  articles[index] = updated;
  saveArticles(articles);
  return updated;
}

export function deleteArticle(id: string): boolean {
  const articles = loadArticles();
  const filtered = articles.filter(a => a.id !== id);
  if (filtered.length === articles.length) return false;
  saveArticles(filtered);
  return true;
}

export function incrementDownloadCount(id: string): void {
  const articles = loadArticles();
  const art = articles.find(a => a.id === id || a.slug === id);
  if (art) {
    art.pdfDownloadCount = (art.pdfDownloadCount || 0) + 1;
    saveArticles(articles);
  }
}
