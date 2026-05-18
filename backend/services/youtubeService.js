/**
 * YouTube Service — extract metadata + lyrics from a YouTube URL
 * Uses YouTube oEmbed (no API key) + Gemini to extract/transcribe lyrics
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

/**
 * Extract YouTube video ID from various URL formats
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Get basic video metadata via YouTube oEmbed (no API key needed)
 */
async function getVideoMeta(videoId) {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const res = await axios.get(oembedUrl, { timeout: 10000 });
    return {
      id:       videoId,
      title:    res.data.title     || 'Unknown Title',
      author:   res.data.author_name || 'Unknown Artist',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      watchUrl:  `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    // Fallback: parse from page
    return {
      id:        videoId,
      title:     'Unknown',
      author:    'Unknown',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      watchUrl:  `https://www.youtube.com/watch?v=${videoId}`,
    };
  }
}

/**
 * Get captions/subtitles via a free API (timedtext)
 * Returns subtitle text or null
 */
async function getSubtitles(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });
    const html = res.data;

    // Extract timedtext URL from player config
    const match = html.match(/"captionTracks":\[(\{[^[\]]*"kind":"asr"[^[\]]*\}|\{[^[\]]*\})/);
    if (!match) return null;

    const baseUrlMatch = html.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
    if (!baseUrlMatch) return null;

    const captionUrl = baseUrlMatch[1].replace(/\\u0026/g, '&');
    const captRes = await axios.get(captionUrl + '&fmt=json3', { timeout: 10000 });
    const events = captRes.data?.events || [];
    const text = events
      .filter(e => e.segs)
      .map(e => e.segs.map(s => s.utf8).join(''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Main extraction function — returns {meta, rawLyrics}
 */
async function extractFromYouTube(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('Invalid YouTube URL — could not extract video ID');

  const [meta, subtitles] = await Promise.all([
    getVideoMeta(videoId),
    getSubtitles(videoId),
  ]);

  return { meta, rawLyrics: subtitles, videoId };
}

module.exports = { extractFromYouTube, extractVideoId };
