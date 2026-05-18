/**
 * Suno Automation — uses Playwright to open Suno.ai and create a song
 * Returns the song URL or null if automation fails
 */
const path = require('path');

let playwright;
try { playwright = require('playwright'); } catch { playwright = null; }

const SUNO_URL = 'https://suno.com/create';

/**
 * Create a song on Suno.ai using browser automation
 * @param {string} lyrics - Formatted Vietnamese lyrics with [Verse], [Chorus], etc.
 * @param {string} stylePrompt - Style prompt for Suno
 * @param {string} title - Song title
 * @param {function} onProgress - Callback for progress updates
 * @returns {object} { success, songUrl, screenshotPath, error }
 */
async function createSunoSong(lyrics, stylePrompt, title, onProgress = () => {}) {
  if (!playwright) {
    return {
      success: false,
      error: 'Playwright not installed. Run: npm install playwright && npx playwright install chromium',
      manualSteps: buildManualSteps(lyrics, stylePrompt),
    };
  }

  const { chromium } = playwright;
  let browser;

  try {
    onProgress('Launching browser...');
    browser = await chromium.launch({
      headless: true, // Headless để chạy được trên Linux server / Docker
      slowMo: 200,
      args: [
        '--no-sandbox',            // Cần thiết trong Docker/Linux
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Tránh crash trên memory thấp
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    onProgress('Navigating to Suno.ai...');
    await page.goto(SUNO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if logged in (look for Create button or login prompt)
    const isLoggedIn = await page.$('[data-testid="create-button"], button:has-text("Create"), .create-btn');
    if (!isLoggedIn) {
      onProgress('Waiting for user to log in to Suno...');
      // Wait up to 60s for user to log in
      await page.waitForSelector('[data-testid="create-button"], button:has-text("Create"), .create-song', {
        timeout: 60000,
      }).catch(() => {});
    }

    onProgress('Filling in song details...');

    // Try to find and click "Custom Mode" or similar toggle
    const customModeBtn = await page.$('button:has-text("Custom"), [data-testid="custom-mode"]');
    if (customModeBtn) {
      await customModeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Fill lyrics textarea
    const lyricsSelectors = [
      'textarea[placeholder*="lyrics" i]',
      'textarea[placeholder*="Lyrics" i]',
      'textarea[data-testid="lyrics-input"]',
      '.lyrics-input textarea',
      'textarea:first-of-type',
    ];

    let lyricsField = null;
    for (const sel of lyricsSelectors) {
      lyricsField = await page.$(sel);
      if (lyricsField) break;
    }

    if (lyricsField) {
      await lyricsField.click();
      await lyricsField.selectAll?.();
      await page.keyboard.press('Control+a');
      await lyricsField.fill(lyrics.slice(0, 2900)); // Suno limit
      onProgress('Lyrics filled ✓');
    } else {
      onProgress('⚠️ Could not find lyrics field — may need manual input');
    }

    // Fill style prompt
    const styleSelectors = [
      'input[placeholder*="style" i]',
      'input[placeholder*="Style" i]',
      'input[data-testid="style-input"]',
      '.style-input input',
    ];
    let styleField = null;
    for (const sel of styleSelectors) {
      styleField = await page.$(sel);
      if (styleField) break;
    }
    if (styleField) {
      await styleField.fill(stylePrompt.slice(0, 200));
      onProgress('Style prompt filled ✓');
    }

    // Fill title
    const titleSelectors = [
      'input[placeholder*="title" i]',
      'input[placeholder*="Title" i]',
      'input[data-testid="title-input"]',
    ];
    let titleField = null;
    for (const sel of titleSelectors) {
      titleField = await page.$(sel);
      if (titleField) break;
    }
    if (titleField) {
      await titleField.fill(title.slice(0, 80));
    }

    // Screenshot before creating
    const screenshotPath = path.join(__dirname, '..', 'data', 'music-cover', `suno_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    onProgress(`Screenshot saved: ${screenshotPath}`);

    // Click Create button
    const createSelectors = [
      'button:has-text("Create")',
      'button[data-testid="create-button"]',
      'button[type="submit"]',
      '.create-btn',
    ];
    let createBtn = null;
    for (const sel of createSelectors) {
      createBtn = await page.$(sel);
      if (createBtn) break;
    }

    if (createBtn) {
      await createBtn.click();
      onProgress('Create button clicked — waiting for song generation...');
      // Wait for song to be created (up to 3 minutes)
      await page.waitForTimeout(5000);
    } else {
      onProgress('⚠️ Could not find Create button — please click manually');
    }

    // Wait for song URL
    await page.waitForTimeout(10000);
    const songUrl = page.url();

    return {
      success: true,
      songUrl,
      screenshotPath,
      manualSteps: buildManualSteps(lyrics, stylePrompt),
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      manualSteps: buildManualSteps(lyrics, stylePrompt),
    };
  } finally {
    // Đóng browser sau khi xong (headless mode không cần giữ mở)
    await browser?.close();
  }
}

function buildManualSteps(lyrics, stylePrompt) {
  return {
    url: SUNO_URL,
    steps: [
      '1. Mở https://suno.com và đăng nhập',
      '2. Click "Create" → chọn "Custom Mode"',
      '3. Dán lời bài hát (lyrics) vào ô "Lyrics"',
      '4. Điền Style Prompt vào ô "Style of Music"',
      '5. Nhập tiêu đề bài hát',
      '6. Click "Create" để tạo nhạc',
    ],
    lyrics:      lyrics.slice(0, 3000),
    stylePrompt: stylePrompt.slice(0, 200),
  };
}

module.exports = { createSunoSong };
