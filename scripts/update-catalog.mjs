import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'catalog-data.js');
const NOW = new Date().toISOString();
const USER_AGENT = 'FreelyCatalogBot/1.0 (+https://github.com/sanjitchak/streamingfree)';
const MAX_JFF_TITLES = 30;

const SOURCES = [
  {
    id: 'muse-asia',
    name: 'Muse Asia',
    type: 'youtube',
    channelId: 'UCGbshtvS9t-8CW11W7TooQg',
    platform: 'Muse Asia',
    focus: 'Animation'
  },
  {
    id: 'kofa',
    name: 'Korean Film Archive',
    type: 'youtube',
    channelId: 'UCvH6u_Qzn5RQdz9W198umDw',
    platform: 'Korean Film Archive',
    focus: 'Korean'
  },
  {
    id: 'jff',
    name: 'JFF Theater',
    type: 'jff',
    url: 'https://www.jff.jpf.go.jp/',
    platform: 'JFF Theater',
    focus: 'Japanese'
  }
];

const GRADIENTS = [
  'linear-gradient(145deg,#183957,#a7648a)',
  'linear-gradient(145deg,#253d32,#d18d58)',
  'linear-gradient(145deg,#3d253f,#7d79bd)',
  'linear-gradient(145deg,#172b3a,#c45b58)',
  'linear-gradient(145deg,#3b3022,#5d92a7)',
  'linear-gradient(145deg,#29223f,#c77c55)'
];

function readJsonAssignment(source) {
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('catalog-data.js is not valid');
  return JSON.parse(source.slice(start, end + 1));
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function stripHtml(value = '') {
  return decodeXml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slugify(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'title';
}

function titleFromSlug(slug) {
  return slug
    .replace(/-part-?(\d+)/g, ' — Part $1')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .replace(/\b100\b/, '100th');
}

function cardWords(title) {
  const words = title.toUpperCase().split(/\s+/).slice(0, 5);
  if (words.length > 2) words.splice(Math.ceil(words.length / 2), 0, '\n');
  return words.join(' ').replace(' \n ', '\n').slice(0, 42);
}

function gradientFor(value) {
  const hash = [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

function accessFromTitle(title = '') {
  if (/english\s*(dub|dubbed)|\beng\s*dub\b/i.test(title)) return 'EN DUB';
  if (/english\s*(sub|subtitle)|\beng\s*sub\b/i.test(title)) return 'EN SUB';
  return null;
}

function isPromo(title = '') {
  return /\b(preview|trailer|teaser|highlight|clip|opening|ending|character pv|anime highlight)\b/i.test(title);
}

function canonicalAnimeTitle(title) {
  return title
    .replace(/^\s*[【《].*?[】》]\s*/u, '')
    .replace(/^\s*\(limited time\)\s*/i, '')
    .replace(/\s*[-–—:]?\s*(episode|ep\.?|#)\s*\d+.*$/i, '')
    .replace(/\s*[-–—:]?\s*(season|s)\s*\d+\s*(episode|e)\s*\d+.*$/i, '')
    .replace(/\s*\[(english|eng)[^\]]*\].*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseKofaTitle(title) {
  if (!/^\s*\[4K\]/i.test(title) || !title.includes('/')) return null;
  const english = title.split('/').slice(1).join('/').trim();
  return english.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match => {
    const block = match[1];
    const pick = pattern => decodeXml((block.match(pattern) || [])[1] || '');
    return {
      videoId: pick(/<yt:videoId>([^<]+)<\/yt:videoId>/),
      title: pick(/<title>([\s\S]*?)<\/title>/),
      publishedAt: pick(/<published>([^<]+)<\/published>/),
      image: pick(/<media:thumbnail[^>]+url="([^"]+)"/)
    };
  }).filter(entry => entry.videoId && entry.title);
}

async function fetchResponse(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'en' },
    signal: AbortSignal.timeout(options.timeout || 25_000)
  });
  return response;
}

async function fetchText(url, options = {}) {
  const response = await fetchResponse(url, options);
  return { response, text: await response.text() };
}

function youtubeId(url) {
  try { return new URL(url).searchParams.get('v'); } catch { return null; }
}

function englishCaptionStatus(html) {
  const match = html.match(/"captionTracks":\[([\s\S]*?)\],"audioTracks"/);
  if (!match) return 'unknown';
  const block = match[1];
  return /"languageCode":"en(?:-|"|\\)/.test(block) || /"simpleText":"English(?: \([^)]*\))?"/.test(block)
    ? 'present'
    : 'absent';
}

async function verifyYoutube(item) {
  const checked = { ...item, lastCheckedAt: NOW, checkError: null };
  try {
    if (item.url.includes('/playlist?')) {
      const response = await fetchResponse(item.url);
      if (response.ok) return { ...checked, availability: 'available' };
      if (response.status === 404) return { ...checked, availability: 'unavailable', unavailableReason: 'playlist-not-found' };
      return { ...item, checkError: `playlist-http-${response.status}` };
    }

    const id = youtubeId(item.url);
    if (!id) return { ...checked, availability: 'unavailable', unavailableReason: 'invalid-youtube-url' };
    const oembed = await fetchResponse(`https://www.youtube.com/oembed?url=${encodeURIComponent(item.url)}&format=json`);
    if (oembed.status === 404 || oembed.status === 400) {
      return { ...checked, availability: 'unavailable', unavailableReason: 'video-not-found' };
    }
    if (!oembed.ok) return { ...item, checkError: `oembed-http-${oembed.status}` };

    const metadata = await oembed.json();
    const titleAccess = accessFromTitle(metadata.title || '');
    if (titleAccess) {
      return {
        ...checked,
        availability: 'available',
        access: titleAccess,
        accessEvidence: 'official-title',
        accessVerifiedAt: NOW,
        unavailableReason: null
      };
    }

    if (item.accessEvidence === 'curated-hardsub') {
      return { ...checked, availability: 'available', accessVerifiedAt: NOW, unavailableReason: null };
    }

    const watch = await fetchText(`https://www.youtube.com/watch?v=${id}&hl=en`);
    const captionStatus = watch.response.ok ? englishCaptionStatus(watch.text) : 'unknown';
    if (captionStatus === 'present') {
      return {
        ...checked,
        availability: 'available',
        access: 'EN SUB',
        accessEvidence: 'english-caption-track',
        accessVerifiedAt: NOW,
        unavailableReason: null
      };
    }

    if (captionStatus === 'unknown') {
      return {
        ...item,
        lastCheckedAt: NOW,
        checkError: 'caption-metadata-unavailable'
      };
    }

    return {
      ...checked,
      availability: 'unavailable',
      unavailableReason: 'english-sub-or-dub-not-found',
      availabilityEvidence: 'caption-list-without-english'
    };
  } catch (error) {
    return { ...item, checkError: error.message };
  }
}

function jffHasEnglishSubtitles(html) {
  return /detail_info__title">字幕<\/p>[\s\S]{0,1800}?data-stt-ignore>English<\/span>/.test(html);
}

async function verifyJff(item) {
  try {
    const { response, text } = await fetchText(item.url);
    if (response.status === 404) {
      return { ...item, availability: 'unavailable', lastCheckedAt: NOW, unavailableReason: 'title-page-not-found', checkError: null };
    }
    if (!response.ok) return { ...item, checkError: `jff-http-${response.status}` };
    const image = (text.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1] || item.image;
    if (!jffHasEnglishSubtitles(text)) {
      return { ...item, image, availability: 'unavailable', lastCheckedAt: NOW, unavailableReason: 'english-subtitles-not-listed', checkError: null };
    }
    return {
      ...item,
      image,
      access: 'EN SUB',
      accessEvidence: 'official-page',
      availability: 'available',
      lastCheckedAt: NOW,
      accessVerifiedAt: NOW,
      unavailableReason: null,
      checkError: null
    };
  } catch (error) {
    return { ...item, checkError: error.message };
  }
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function baseItem({ id, title, source, url, image, access, publishedAt, type, genre, runtime }) {
  return {
    id,
    title,
    year: publishedAt ? String(new Date(publishedAt).getUTCFullYear()) : 'Current',
    type,
    focus: source.focus,
    genre,
    platform: source.platform,
    runtime,
    tag: 'Auto-discovered',
    art: gradientFor(id),
    image,
    words: cardWords(title),
    url,
    access,
    availability: 'available',
    curated: false,
    autoDiscovered: true,
    sourceId: source.id,
    sourceKey: id,
    publishedAt,
    discoveredAt: NOW,
    lastCheckedAt: NOW,
    accessVerifiedAt: NOW,
    checkError: null,
    unavailableReason: null
  };
}

async function discoverYoutube(source, existingItems) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  const { response, text } = await fetchText(feedUrl);
  if (!response.ok) throw new Error(`feed-http-${response.status}`);
  const entries = parseFeed(text);
  const candidates = [];
  const seenKeys = new Set();

  for (const entry of entries) {
    let title;
    let access = accessFromTitle(entry.title);
    if (source.id === 'muse-asia') {
      if (!access || isPromo(entry.title)) continue;
      title = canonicalAnimeTitle(entry.title);
      if (!title) continue;
    } else {
      title = parseKofaTitle(entry.title);
      if (!title) continue;
    }

    const key = `${source.id}:${slugify(title)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const current = existingItems.find(item => item.sourceKey === key);
    const item = {
      ...(current || baseItem({
        id: key,
        title,
        source,
        url: `https://www.youtube.com/watch?v=${entry.videoId}`,
        image: entry.image || `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
        access,
        publishedAt: entry.publishedAt,
        type: source.id === 'kofa' ? 'Movie' : 'Series',
        genre: source.id === 'kofa' ? 'Classics' : 'Animation',
        runtime: source.id === 'kofa' ? 110 : 24
      })),
      title,
      url: `https://www.youtube.com/watch?v=${entry.videoId}`,
      image: entry.image || `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
      publishedAt: entry.publishedAt,
      year: String(new Date(entry.publishedAt).getUTCFullYear()),
      words: cardWords(title),
      access: access || current?.access || null,
      availability: 'available',
      lastCheckedAt: NOW,
      accessVerifiedAt: access ? NOW : current?.accessVerifiedAt,
      accessEvidence: access ? 'official-title' : current?.accessEvidence,
      checkError: null,
      unavailableReason: null
    };

    if (source.id === 'kofa') {
      const verified = await verifyYoutube(item);
      if (verified.availability !== 'available' || !verified.access) continue;
      candidates.push(verified);
    } else {
      candidates.push(item);
    }
  }

  return { candidates, feedCount: entries.length };
}

function parseJffCards(html) {
  const cards = [];
  for (const match of html.matchAll(/<li class="splide__slide">([\s\S]*?)<\/li>/g)) {
    const block = match[1];
    const href = (block.match(/href="(\/movie\/[^"?#]+\/?)"/) || [])[1];
    if (!href || href === '/movie/') continue;
    const image = (block.match(/<img\s+src="([^"]+)"/) || [])[1] || '';
    cards.push({ href, image });
  }
  return [...new Map(cards.map(card => [card.href, card])).values()].slice(0, MAX_JFF_TITLES);
}

async function discoverJff(source, existingItems) {
  const { response, text } = await fetchText(source.url);
  if (!response.ok) throw new Error(`jff-home-http-${response.status}`);
  const cards = parseJffCards(text);
  const candidates = [];

  for (const card of cards) {
    const url = new URL(card.href, source.url).href;
    const current = existingItems.find(item => item.url === url);
    const slug = card.href.split('/').filter(Boolean).pop();
    const title = current?.title || titleFromSlug(slug);
    const key = current?.sourceKey || `${source.id}:${slug}`;
    const item = current || baseItem({
      id: key,
      title,
      source,
      url,
      image: card.image,
      access: null,
      publishedAt: null,
      type: 'Movie',
      genre: 'Japanese cinema',
      runtime: 110
    });
    const verified = await verifyJff({ ...item, image: card.image || item.image });
    if (verified.availability === 'available' && verified.access) candidates.push(verified);
  }

  return { candidates, feedCount: cards.length };
}

function mergeItems(items, candidates) {
  const merged = [...items];
  for (const candidate of candidates) {
    const index = merged.findIndex(item => item.sourceKey === candidate.sourceKey || item.url === candidate.url);
    if (index >= 0) merged[index] = { ...merged[index], ...candidate };
    else merged.push(candidate);
  }
  return merged;
}

async function main() {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8');
  const catalog = readJsonAssignment(raw);
  let items = await mapLimit(catalog.items || [], 4, item => {
    if (item.sourceId === 'jff') return verifyJff(item);
    if (item.url?.includes('youtube.com/')) return verifyYoutube(item);
    return Promise.resolve(item);
  });

  const sourceRuns = [];
  for (const source of SOURCES) {
    try {
      const result = source.type === 'youtube'
        ? await discoverYoutube(source, items)
        : await discoverJff(source, items);
      items = mergeItems(items, result.candidates);
      sourceRuns.push({
        id: source.id,
        name: source.name,
        ok: true,
        fetchedAt: NOW,
        feedItems: result.feedCount,
        eligibleItems: result.candidates.length
      });
    } catch (error) {
      sourceRuns.push({ id: source.id, name: source.name, ok: false, fetchedAt: NOW, error: error.message });
    }
  }

  items.sort((a, b) => {
    if (Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
    return String(b.publishedAt || b.discoveredAt || '').localeCompare(String(a.publishedAt || a.discoveredAt || ''));
  });

  const nextCatalog = {
    schemaVersion: 1,
    lastUpdated: NOW,
    sources: sourceRuns,
    summary: {
      total: items.length,
      available: items.filter(item => item.availability === 'available' && item.access).length,
      unavailable: items.filter(item => item.availability === 'unavailable').length,
      autoDiscovered: items.filter(item => item.autoDiscovered).length
    },
    items
  };

  await fs.writeFile(CATALOG_FILE, `window.FREELY_CATALOG = ${JSON.stringify(nextCatalog, null, 2)};\n`);
  console.log(`Catalog updated: ${nextCatalog.summary.available} available, ${nextCatalog.summary.autoDiscovered} auto-discovered.`);
  for (const run of sourceRuns) {
    console.log(`${run.ok ? 'OK' : 'WARN'} ${run.name}: ${run.ok ? `${run.eligibleItems}/${run.feedItems} eligible` : run.error}`);
  }
}

await main();
