/**
 * DocReader — extracts text from image files using Gemini Vision API.
 * Supports JPG, PNG, WEBP, GIF.
 */
const fs   = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const VISION_MODEL   = 'gemini-1.5-flash'; // good vision + fast

// Simple in-memory cache: folderPath → { ts, text }
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function extractTextFromImage(genAI, imagePath) {
  const ext     = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeMap = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
                    webp:'image/webp', gif:'image/gif', bmp:'image/bmp' };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  const imageData   = await fs.readFile(imagePath);
  const base64Data  = imageData.toString('base64');

  const model = genAI.getGenerativeModel({ model: VISION_MODEL });
  const result = await model.generateContent([
    {
      inlineData: { data: base64Data, mimeType },
    },
    `Extract ALL text from this image. Return plain text only, no markdown formatting. 
     If the image contains tables, convert them to simple key:value format.
     If you see no text, describe what you see briefly.`,
  ]);

  return result.response.text().trim();
}

/**
 * Read all images from a folder and extract their text.
 * Returns a combined string of all extracted content.
 */
async function readDocumentsFromFolder(folderPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set — cannot read image documents');

  // Check cache
  const cached = cache.get(folderPath);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[DocReader] Using cached content for ${folderPath}`);
    return cached.text;
  }

  const exists = await fs.pathExists(folderPath);
  if (!exists) throw new Error(`Folder not found: ${folderPath}`);

  const entries = await fs.readdir(folderPath);
  const images  = entries
    .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
    .sort()
    .slice(0, 20); // max 20 images to avoid quota issues

  if (images.length === 0) throw new Error(`No image files found in ${folderPath}`);

  console.log(`[DocReader] Reading ${images.length} images from ${folderPath}…`);
  const genAI = new GoogleGenerativeAI(apiKey);

  const extractedTexts = [];
  for (let i = 0; i < images.length; i++) {
    const imgPath = path.join(folderPath, images[i]);
    try {
      console.log(`[DocReader] Processing image ${i + 1}/${images.length}: ${images[i]}`);
      const text = await extractTextFromImage(genAI, imgPath);
      if (text) {
        extractedTexts.push(`--- Page ${i + 1} (${images[i]}) ---\n${text}`);
      }
      // Small delay to avoid rate limiting
      if (i < images.length - 1) await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`[DocReader] Failed to extract from ${images[i]}: ${err.message}`);
      extractedTexts.push(`--- Page ${i + 1} (${images[i]}) --- [EXTRACTION FAILED: ${err.message}]`);
    }
  }

  const combined = extractedTexts.join('\n\n');

  // Update cache
  cache.set(folderPath, { ts: Date.now(), text: combined });
  console.log(`[DocReader] ✅ Extracted ${extractedTexts.length} documents (${combined.length} chars)`);

  return combined;
}

/**
 * Get file list from folder (for display purposes)
 */
async function listDocuments(folderPath) {
  const exists = await fs.pathExists(folderPath);
  if (!exists) return [];

  const entries = await fs.readdir(folderPath);
  return entries
    .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
    .map(f => ({
      name: f,
      path: path.join(folderPath, f),
      ext:  path.extname(f).toLowerCase(),
    }));
}

/** Clear cache for a folder */
function clearCache(folderPath) {
  if (folderPath) cache.delete(folderPath);
  else cache.clear();
}

module.exports = { readDocumentsFromFolder, listDocuments, clearCache };
