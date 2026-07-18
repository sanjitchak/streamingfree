import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'catalog-data.js');
const NOW = new Date().toISOString();
const USER_AGENT = 'FreelyCatalogBot/2.0 (+https://github.com/sanjitchak/streamingfree)';
const CATEGORY_TARGET = 100;
const MAX_DAILY_CHECKS = 75;
const MAX_MAL_LOOKUPS = Number(process.env.MAX_MAL_LOOKUPS || 100);
const RATING_RECHECK_DAYS = 30;

const SOURCES = [
  {
    id: 'muse-asia', name: 'Muse Asia', type: 'muse-playlists',
    url: 'https://www.youtube.com/@MuseAsia/playlists',
    channelId: 'UCGbshtvS9t-8CW11W7TooQg', indexLimit: 300,
    platform: 'Muse Asia', focus: 'Animation'
  },
  {
    id: 'kofa', name: 'Korean Film Archive', type: 'kofa-channel',
    url: 'https://www.youtube.com/@KoreanFilm/videos',
    channelId: 'UCvH6u_Qzn5RQdz9W198umDw', indexLimit: 400,
    platform: 'Korean Film Archive', focus: 'Korean'
  },
  {
    id: 'kbs-world', name: 'KBS World TV', type: 'kbs-playlists',
    url: 'https://www.youtube.com/@kbsworldtv/playlists',
    channelId: 'UC5BMQOsAB8hKUyHu9KI6yig', indexLimit: 500,
    platform: 'KBS World', focus: 'Korean'
  },
  {
    id: 'nhk-world', name: 'NHK WORLD-JAPAN', type: 'nhk-channel',
    url: 'https://www.youtube.com/@NHKWORLDJAPAN/videos',
    channelId: 'UCSPEjw8F2nQDtmUKPFNF7_A', indexLimit: 900,
    platform: 'NHK WORLD-JAPAN', focus: 'Japanese'
  },
  {
    id: 'jff', name: 'JFF Theater', type: 'jff',
    url: 'https://www.jff.jpf.go.jp/',
    platform: 'JFF Theater', focus: 'Japanese'
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readJsonAssignment(source) {
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('catalog-data.js is not valid');
  return JSON.parse(source.slice(start, end + 1));
}

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = '') {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slugify(value = '') {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 88) || 'title';
}

function comparableTitle(value = '') {
  return value.toLowerCase()
    .replace(/\b(season|part|cour)\s*\d+\b/g, '')
    .replace(/\b(2nd|3rd|4th|5th)\s+season\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleFromSlug(slug) {
  return slug.replace(/-part-?(\d+)/g, ' — Part $1').replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase()).replace(/\b100\b/, '100th');
}

function cardWords(title) {
  const words = title.toUpperCase().split(/\s+/).slice(0, 5);
  if (words.length > 2) words.splice(Math.ceil(words.length / 2), 0, '\n');
  return words.join(' ').replace(' \n ', '\n').slice(0, 46);
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
  return /\b(preview|trailer|teaser|promo|highlight|clip|opening|ending|character pv|anime highlight|shorts?)\b/i.test(title);
}

function canonicalAnimeTitle(title) {
  return title.replace(/^\s*[【《].*?[】》]\s*/u, '')
    .replace(/^\s*\(limited time\)\s*/i, '')
    .replace(/^\s*[【(]?full series[】)]?\s*/i, '')
    .replace(/\s*[-–—:]?\s*(episode|ep\.?|#)\s*\d+.*$/i, '')
    .replace(/\s*[-–—:]?\s*(season|s)\s*\d+\s*(episode|e)\s*\d+.*$/i, '')
    .replace(/\s*\[(english|eng)[^\]]*\].*$/i, '')
    .replace(/\s+/g, ' ').trim();
}

function parseKofaTitle(title) {
  if (!title.includes('/')) return null;
  const english = title.split('/').slice(1).join('/').trim();
  if (!/[A-Za-z]{4}/.test(english)) return null;
  return english.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
}

function timestampToIso(timestamp) {
  if (!timestamp) return null;
  const date = new Date(Number(timestamp) * 1000);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function bestThumbnail(entry) {
  const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  return thumbnails.at(-1)?.url || thumbnails[0]?.url || entry.thumbnail || '';
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match => {
    const block = match[1];
    const pick = pattern => decodeEntities((block.match(pattern) || [])[1] || '');
    return {
      videoId: pick(/<yt:videoId>([^<]+)<\/yt:videoId>/),
      title: pick(/<title>([\s\S]*?)<\/title>/),
      publishedAt: pick(/<published>([^<]+)<\/published>/),
      image: pick(/<media:thumbnail[^>]+url="([^"]+)"/)
    };
  }).filter(entry => entry.videoId && entry.title);
}

async function fetchResponse(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'en' },
    signal: AbortSignal.timeout(options.timeout || 30_000)
  });
}

async function fetchText(url, options = {}) {
  const response = await fetchResponse(url, options);
  return { response, text: await response.text() };
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

async function ytDlpEntries(source) {
  const { stdout } = await execFileAsync('yt-dlp', [
    '--flat-playlist', '--playlist-end', String(source.indexLimit),
    '--dump-single-json', '--no-warnings', source.url
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const data = JSON.parse(stdout);
  return Array.isArray(data.entries) ? data.entries.filter(Boolean) : [];
}

function youtubeId(url) {
  try { return new URL(url).searchParams.get('v'); } catch { return null; }
}

function englishCaptionStatus(html) {
  const match = html.match(/"captionTracks":\[([\s\S]*?)\],"audioTracks"/);
  if (!match) return 'unknown';
  return /"languageCode":"en(?:-|"|\\)/.test(match[1]) || /"simpleText":"English(?: \([^)]*\))?"/.test(match[1])
    ? 'present' : 'absent';
}

async function verifyYoutube(item) {
  const checked = { ...item, lastCheckedAt: NOW, checkError: null };
  try {
    if (item.url.includes('/playlist?')) {
      const response = await fetchResponse(item.url);
      if (response.ok) return { ...checked, availability: 'available', unavailableReason: null };
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
    if (titleAccess) return { ...checked, availability: 'available', access: titleAccess, accessEvidence: 'official-title', accessVerifiedAt: NOW, unavailableReason: null };

    if (['curated-hardsub', 'official-english-channel', 'official-playlist-title'].includes(item.accessEvidence)) {
      return { ...checked, availability: 'available', accessVerifiedAt: NOW, unavailableReason: null };
    }

    const watch = await fetchText(`https://www.youtube.com/watch?v=${id}&hl=en`);
    const captionStatus = watch.response.ok ? englishCaptionStatus(watch.text) : 'unknown';
    if (captionStatus === 'present') {
      return { ...checked, availability: 'available', access: 'EN SUB', accessEvidence: 'english-caption-track', accessVerifiedAt: NOW, unavailableReason: null };
    }
    if (captionStatus === 'unknown') return { ...item, lastCheckedAt: NOW, checkError: 'caption-metadata-unavailable' };
    return { ...checked, availability: 'unavailable', unavailableReason: 'english-sub-or-dub-not-found', availabilityEvidence: 'caption-list-without-english' };
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
    if (response.status === 404) return { ...item, availability: 'unavailable', lastCheckedAt: NOW, unavailableReason: 'title-page-not-found', checkError: null };
    if (!response.ok) return { ...item, checkError: `jff-http-${response.status}` };
    const image = (text.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1] || item.image;
    if (!jffHasEnglishSubtitles(text)) return { ...item, image, availability: 'unavailable', lastCheckedAt: NOW, unavailableReason: 'english-subtitles-not-listed', checkError: null };
    return {
      ...item, image, access: 'EN SUB', requiresAccount: true,
      accessEvidence: 'official-page', availability: 'available',
      lastCheckedAt: NOW, accessVerifiedAt: NOW,
      unavailableReason: null, checkError: null
    };
  } catch (error) {
    return { ...item, checkError: error.message };
  }
}

function baseItem({ id, title, source, url, image, access, publishedAt, type, genre, runtime }) {
  return {
    id, title,
    year: publishedAt ? String(new Date(publishedAt).getUTCFullYear()) : 'Current',
    type, focus: source.focus, genre, platform: source.platform, runtime,
    tag: 'Auto-discovered', art: gradientFor(id), image,
    words: cardWords(title), url, access, availability: 'available',
    curated: false, autoDiscovered: true, sourceId: source.id, sourceKey: id,
    publishedAt, discoveredAt: NOW, lastCheckedAt: NOW,
    accessVerifiedAt: access ? NOW : null, checkError: null, unavailableReason: null
  };
}

function findExisting(items, source, key, title) {
  return items.find(item => item.sourceKey === key)
    || items.find(item => item.sourceId === source.id && comparableTitle(item.title) === comparableTitle(title));
}

async function discoverYoutubeFeed(source, existingItems) {
  const { response, text } = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`);
  if (!response.ok) throw new Error(`feed-http-${response.status}`);
  const entries = parseFeed(text);
  const candidates = [];
  for (const entry of entries) {
    const access = accessFromTitle(entry.title);
    const title = source.id === 'kofa' ? parseKofaTitle(entry.title) : canonicalAnimeTitle(entry.title);
    if (!title || (source.id === 'muse-asia' && (!access || isPromo(entry.title)))) continue;
    const key = `${source.id}:${slugify(title)}`;
    const current = findExisting(existingItems, source, key, title);
    const item = {
      ...(current || baseItem({ id: key, title, source, url: `https://www.youtube.com/watch?v=${entry.videoId}`, image: entry.image, access, publishedAt: entry.publishedAt, type: source.id === 'kofa' ? 'Movie' : 'Series', genre: source.id === 'kofa' ? 'Classics' : 'Animation', runtime: source.id === 'kofa' ? 110 : 24 })),
      sourceKey: key, title, url: `https://www.youtube.com/watch?v=${entry.videoId}`,
      image: entry.image, access: access || current?.access || null,
      publishedAt: entry.publishedAt, words: cardWords(title)
    };
    candidates.push(source.id === 'kofa' ? await verifyYoutube(item) : item);
  }
  return { candidates: candidates.filter(item => item.access && item.availability === 'available'), feedCount: entries.length, method: 'rss-fallback' };
}

async function discoverMusePlaylists(source, existingItems) {
  let entries;
  try { entries = await ytDlpEntries(source); }
  catch { return discoverYoutubeFeed(source, existingItems); }
  const candidates = [];
  const seen = new Set();
  for (const entry of entries) {
    const access = accessFromTitle(entry.title || '');
    if (!access || isPromo(entry.title || '')) continue;
    const title = canonicalAnimeTitle(entry.title || '');
    if (!title) continue;
    const key = `${source.id}:${slugify(title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = findExisting(existingItems, source, key, title);
    if (current?.curated) continue;
    const item = current || baseItem({ id: key, title, source, url: `https://www.youtube.com/playlist?list=${entry.id}`, image: bestThumbnail(entry), access, publishedAt: timestampToIso(entry.timestamp), type: 'Series', genre: 'Animation', runtime: 24 });
    candidates.push({
      ...item, sourceKey: key, title, words: cardWords(title),
      url: `https://www.youtube.com/playlist?list=${entry.id}`,
      image: bestThumbnail(entry) || item.image, access,
      accessEvidence: 'official-playlist-title', availability: 'available',
      accessVerifiedAt: NOW, lastCheckedAt: NOW, unavailableReason: null, checkError: null
    });
    if (candidates.length >= 150) break;
  }
  return { candidates, feedCount: entries.length, method: 'full-playlist-index' };
}

async function discoverKofaChannel(source, existingItems) {
  let entries;
  try { entries = await ytDlpEntries(source); }
  catch { return discoverYoutubeFeed(source, existingItems); }
  const prepared = [];
  const seen = new Set();
  for (const entry of entries) {
    const title = parseKofaTitle(entry.title || '');
    if (!title || Number(entry.duration || 0) < 2400) continue;
    const key = `${source.id}:${slugify(title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = findExisting(existingItems, source, key, title);
    prepared.push({
      ...(current || baseItem({ id: key, title, source, url: `https://www.youtube.com/watch?v=${entry.id}`, image: bestThumbnail(entry), access: null, publishedAt: timestampToIso(entry.timestamp), type: 'Movie', genre: 'Korean classic', runtime: Math.round(Number(entry.duration) / 60) })),
      sourceKey: key, title, words: cardWords(title),
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      image: bestThumbnail(entry) || current?.image,
      runtime: Math.round(Number(entry.duration) / 60),
      publishedAt: timestampToIso(entry.timestamp) || current?.publishedAt
    });
    if (prepared.length >= 150) break;
  }
  const checked = await mapLimit(prepared, 6, item => verifyYoutube(item));
  return { candidates: checked.filter(item => item.availability === 'available' && item.access), feedCount: entries.length, method: 'full-channel-index' };
}

function kbsEnglishTitle(title = '') {
  const parts = title.split('|').map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return title.trim();
  return parts.sort((a, b) => (b.match(/[A-Za-z]/g)?.length || 0) - (a.match(/[A-Za-z]/g)?.length || 0))[0];
}

function isKbsProgramPlaylist(title = '') {
  if (isPromo(title)) return false;
  return !/\b(music bank|k-?pop|concert|festival|awards?|stage|comeback|ost|lyrics?|compilation|playlist|1hr|loop|interview|countdown|world cup|athletics|apec|shorts?)\b/i.test(title)
    && !/[🎤🎵🎶]/u.test(title);
}

async function discoverKbsPlaylists(source, existingItems) {
  let entries;
  try { entries = await ytDlpEntries(source); }
  catch { return discoverYoutubeFeed(source, existingItems); }
  const candidates = [];
  const seen = new Set();
  for (const entry of entries) {
    const rawTitle = String(entry.title || '').trim();
    if (!rawTitle || !/[A-Za-z]{4}/.test(rawTitle) || !isKbsProgramPlaylist(rawTitle)) continue;
    const title = kbsEnglishTitle(rawTitle).replace(/\s+/g, ' ').trim();
    if (!title || title.length < 4) continue;
    const key = `${source.id}:${slugify(title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = findExisting(existingItems, source, key, title);
    const item = current || baseItem({ id: key, title, source, url: `https://www.youtube.com/playlist?list=${entry.id}`, image: bestThumbnail(entry), access: 'EN SUB', publishedAt: timestampToIso(entry.timestamp), type: 'Series', genre: 'Korean TV', runtime: 60 });
    candidates.push({
      ...item, sourceKey: key, title, words: cardWords(title),
      url: `https://www.youtube.com/playlist?list=${entry.id}`,
      image: bestThumbnail(entry) || item.image, access: 'EN SUB',
      accessEvidence: 'official-english-channel', availability: 'available',
      accessVerifiedAt: NOW, lastCheckedAt: NOW,
      publishedAt: timestampToIso(entry.timestamp) || item.publishedAt,
      unavailableReason: null, checkError: null
    });
    if (candidates.length >= 150) break;
  }
  return { candidates, feedCount: entries.length, method: 'full-playlist-index' };
}

function nhkSeriesName(title) {
  const pieces = title.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  return pieces.length > 1 ? pieces.at(-1) : title;
}

async function discoverNhkChannel(source, existingItems) {
  let entries;
  try { entries = await ytDlpEntries(source); }
  catch { return discoverYoutubeFeed(source, existingItems); }
  const candidates = [];
  const seriesCounts = new Map();
  for (const entry of entries) {
    const title = String(entry.title || '').trim();
    const duration = Number(entry.duration || 0);
    if (!title || duration < 600 || duration > 7200 || !/[A-Za-z]{4}/.test(title) || isPromo(title) || /\b(newsline|newsroom tokyo|nhk news)\b/i.test(title)) continue;
    const series = comparableTitle(nhkSeriesName(title));
    const count = seriesCounts.get(series) || 0;
    if (count >= 3) continue;
    seriesCounts.set(series, count + 1);
    const key = `${source.id}:${entry.id}`;
    const current = existingItems.find(item => item.sourceKey === key || item.url?.endsWith(`=${entry.id}`));
    const publishedAt = timestampToIso(entry.timestamp);
    const item = current || baseItem({ id: key, title, source, url: `https://www.youtube.com/watch?v=${entry.id}`, image: bestThumbnail(entry), access: 'EN AUDIO', publishedAt, type: 'Episode', genre: 'Japan documentary', runtime: Math.round(duration / 60) });
    candidates.push({
      ...item, sourceKey: key, title, words: cardWords(title),
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      image: bestThumbnail(entry) || item.image, runtime: Math.round(duration / 60),
      access: 'EN AUDIO', accessEvidence: 'official-english-channel',
      availability: 'available', accessVerifiedAt: NOW, lastCheckedAt: NOW,
      publishedAt: publishedAt || item.publishedAt, unavailableReason: null, checkError: null
    });
    if (candidates.length >= 120) break;
  }
  return { candidates, feedCount: entries.length, method: 'full-channel-index' };
}

function parseJffCards(html) {
  const cards = [];
  for (const match of html.matchAll(/<li class="splide__slide">([\s\S]*?)<\/li>/g)) {
    const block = match[1];
    const href = (block.match(/href="(\/movie\/[^"?#]+\/?)"/) || [])[1];
    if (!href || href === '/movie/') continue;
    cards.push({ href, image: (block.match(/<img\s+src="([^"]+)"/) || [])[1] || '' });
  }
  return [...new Map(cards.map(card => [card.href, card])).values()].slice(0, 30);
}

async function discoverJff(source, existingItems) {
  const { response, text } = await fetchText(source.url);
  if (!response.ok) throw new Error(`jff-home-http-${response.status}`);
  const cards = parseJffCards(text);
  const candidates = await mapLimit(cards, 4, async card => {
    const url = new URL(card.href, source.url).href;
    const current = existingItems.find(item => item.url === url);
    const slug = card.href.split('/').filter(Boolean).pop();
    const title = current?.title || titleFromSlug(slug);
    const key = current?.sourceKey || `${source.id}:${slug}`;
    const item = current || baseItem({ id: key, title, source, url, image: card.image, access: null, publishedAt: null, type: 'Movie', genre: 'Japanese cinema', runtime: 110 });
    return verifyJff({ ...item, sourceKey: key, requiresAccount: true, image: card.image || item.image });
  });
  return { candidates: candidates.filter(item => item.availability === 'available' && item.access), feedCount: cards.length, method: 'official-site' };
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

function itemRecency(item) {
  return String(item.publishedAt || item.discoveredAt || '');
}

function markVisibleCategories(items) {
  const next = items.map(item => ({ ...item, catalogVisible: false }));
  for (const focus of ['Animation', 'Korean', 'Japanese']) {
    const eligible = next.filter(item => item.focus === focus && item.availability === 'available' && item.access)
      .sort((a, b) => {
        if (Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
        return itemRecency(b).localeCompare(itemRecency(a));
      });
    const seenTitles = new Set();
    let visible = 0;
    for (const item of eligible) {
      const key = comparableTitle(item.title);
      if (!key || seenTitles.has(key)) continue;
      seenTitles.add(key);
      item.catalogVisible = true;
      if (++visible >= CATEGORY_TARGET) break;
    }
  }
  return next;
}

function ratingSimilarity(query, candidate) {
  const left = comparableTitle(query);
  const right = comparableTitle(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.88;
  const a = new Set(left.split(' '));
  const b = new Set(right.split(' '));
  const overlap = [...a].filter(token => b.has(token)).length;
  return overlap / Math.max(a.size, b.size);
}

function parseMalResults(html) {
  const results = [];
  for (const rowMatch of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = rowMatch[1];
    const id = (row.match(/data-l-content-id="(\d+)"/) || [])[1];
    const title = stripHtml((row.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || '');
    if (!id || !title) continue;
    const cells = [...row.matchAll(/<td class="borderClass ac bgColor[01]"[^>]*>([\s\S]*?)<\/td>/g)].map(match => stripHtml(match[1]));
    const score = Number(cells.at(-1));
    if (!Number.isFinite(score) || score <= 0 || score > 10) continue;
    results.push({ id, title, score, url: `https://myanimelist.net/anime/${id}` });
  }
  return results;
}

async function findMalRating(title) {
  const query = title.replace(/\bseason\s*\d+.*$/i, '').trim();
  const { response, text } = await fetchText(`https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`, { timeout: 35_000 });
  if (response.status === 429 || response.status === 403) throw new Error(`mal-rate-limited-${response.status}`);
  if (!response.ok) return null;
  const ranked = parseMalResults(text).map(result => ({ ...result, match: ratingSimilarity(title, result.title) }))
    .sort((a, b) => b.match - a.match);
  return ranked[0]?.match >= 0.55 ? ranked[0] : null;
}

function ratingDue(item) {
  if (item.rating?.source === 'MAL') {
    return Date.now() - new Date(item.rating.checkedAt || 0).valueOf() > RATING_RECHECK_DAYS * 86_400_000;
  }
  if (!item.ratingCheckedAt) return true;
  return Date.now() - new Date(item.ratingCheckedAt).valueOf() > RATING_RECHECK_DAYS * 86_400_000;
}

async function enrichMalRatings(items) {
  const candidates = items.filter(item => item.focus === 'Animation' && item.catalogVisible && ratingDue(item)).slice(0, MAX_MAL_LOOKUPS);
  let matched = 0;
  for (const item of candidates) {
    try {
      const result = await findMalRating(item.title);
      item.ratingCheckedAt = NOW;
      if (result) {
        item.rating = { source: 'MAL', value: result.score, url: result.url, externalId: result.id, checkedAt: NOW };
        matched++;
      }
    } catch (error) {
      console.warn(`MAL lookup paused: ${error.message}`);
      break;
    }
    await sleep(750);
  }
  return { attempted: candidates.length, matched };
}

async function discoverSource(source, items) {
  if (source.type === 'muse-playlists') return discoverMusePlaylists(source, items);
  if (source.type === 'kofa-channel') return discoverKofaChannel(source, items);
  if (source.type === 'kbs-playlists') return discoverKbsPlaylists(source, items);
  if (source.type === 'nhk-channel') return discoverNhkChannel(source, items);
  return discoverJff(source, items);
}

async function main() {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8');
  const catalog = readJsonAssignment(raw);
  let items = catalog.items || [];

  const rolling = items.filter(item => item.url?.includes('youtube.com/'))
    .sort((a, b) => String(a.lastCheckedAt || '').localeCompare(String(b.lastCheckedAt || '')))
    .slice(0, MAX_DAILY_CHECKS);
  const rollingIds = new Set(rolling.map(item => item.id));
  const checked = await mapLimit(rolling, 6, item => verifyYoutube(item));
  const checkedById = new Map(checked.map(item => [item.id, item]));
  items = items.map(item => rollingIds.has(item.id) ? checkedById.get(item.id) : item);

  const sourceRuns = [];
  for (const source of SOURCES) {
    try {
      const result = await discoverSource(source, items);
      items = mergeItems(items, result.candidates);
      sourceRuns.push({ id: source.id, name: source.name, ok: true, method: result.method, fetchedAt: NOW, feedItems: result.feedCount, eligibleItems: result.candidates.length });
    } catch (error) {
      sourceRuns.push({ id: source.id, name: source.name, ok: false, fetchedAt: NOW, error: error.message });
    }
  }

  items = markVisibleCategories(items);
  const ratingRun = await enrichMalRatings(items);
  items.sort((a, b) => {
    if (Boolean(a.catalogVisible) !== Boolean(b.catalogVisible)) return a.catalogVisible ? -1 : 1;
    if (Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
    return itemRecency(b).localeCompare(itemRecency(a));
  });

  const visibleItems = items.filter(item => item.catalogVisible);
  const categoryCounts = Object.fromEntries(['Animation', 'Korean', 'Japanese'].map(focus => [focus, visibleItems.filter(item => item.focus === focus).length]));
  const nextCatalog = {
    schemaVersion: 2,
    lastUpdated: NOW,
    sources: sourceRuns,
    ratingRun,
    summary: {
      total: items.length,
      available: items.filter(item => item.availability === 'available' && item.access).length,
      visible: visibleItems.length,
      categories: categoryCounts,
      unavailable: items.filter(item => item.availability === 'unavailable').length,
      autoDiscovered: items.filter(item => item.autoDiscovered).length,
      rated: items.filter(item => item.rating?.value).length
    },
    items
  };

  await fs.writeFile(CATALOG_FILE, `window.FREELY_CATALOG = ${JSON.stringify(nextCatalog, null, 2)};\n`);
  console.log(`Catalog updated: ${visibleItems.length} visible (${Object.entries(categoryCounts).map(([key, value]) => `${key} ${value}`).join(', ')}), ${nextCatalog.summary.rated} rated.`);
  for (const run of sourceRuns) console.log(`${run.ok ? 'OK' : 'WARN'} ${run.name}: ${run.ok ? `${run.eligibleItems}/${run.feedItems} eligible via ${run.method}` : run.error}`);
  console.log(`MAL ratings: ${ratingRun.matched}/${ratingRun.attempted} matched this run.`);
}

await main();
