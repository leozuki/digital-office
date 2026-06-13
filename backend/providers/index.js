require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs   = require('fs-extra');

// Load keys from keys.json if exists to override .env
const KEYS_FILE = path.join(__dirname, '..', 'config', 'keys.json');
try {
  if (fs.existsSync(KEYS_FILE)) {
    const dynamicKeys = fs.readJsonSync(KEYS_FILE);
    Object.entries(dynamicKeys).forEach(([k, v]) => { if (v) process.env[k] = v; });
  }
} catch (err) { console.warn('[Provider] Failed to load keys.json:', err.message); }

const AnthropicProvider = require('./anthropic');
const GeminiProvider    = require('./gemini');
const OllamaProvider    = require('./ollama');

/**
 * Parse a runner string like "anthropic:claude-3-5-sonnet-20241022" into { provider, model }
 */
function parseRunner(runnerStr) {
  const [provider, ...modelParts] = (runnerStr || '').split(':');
  return { provider: provider.toLowerCase(), model: modelParts.join(':') || undefined };
}

/**
 * Kiểm tra key có hợp lệ (không phải placeholder)
 */
function isValidKey(key) {
  return key && typeof key === 'string' && !key.includes('your_') && key.length > 10;
}

/**
 * Create a provider instance from a runner string.
 * Falls back gracefully if an API key is missing.
 */
function createProvider(runnerStr) {
  const { provider, model } = parseRunner(runnerStr);

  try {
    switch (provider) {
      case 'anthropic':
        if (!isValidKey(process.env.ANTHROPIC_API_KEY)) {
          throw new Error('ANTHROPIC_API_KEY không hợp lệ hoặc là placeholder');
        }
        return new AnthropicProvider(process.env.ANTHROPIC_API_KEY, model);
      case 'gemini':
        if (!isValidKey(process.env.GEMINI_API_KEY)) {
          throw new Error('GEMINI_API_KEY không hợp lệ hoặc là placeholder');
        }
        return new GeminiProvider(process.env.GEMINI_API_KEY, model);
      case 'ollama':
        return new OllamaProvider(process.env.OLLAMA_BASE_URL, model);
      default:
        throw new Error(`Unknown provider: "${provider}"`);
    }
  } catch (err) {
    // Auto-fallback: nếu provider chính thất bại, thử các provider khác có key hợp lệ
    console.warn(`[Provider] ${err.message} — attempting fallback…`);
    if (provider !== 'gemini' && isValidKey(process.env.GEMINI_API_KEY)) {
      return new GeminiProvider(process.env.GEMINI_API_KEY);
    }
    if (provider !== 'anthropic' && isValidKey(process.env.ANTHROPIC_API_KEY)) {
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    }
    if (provider !== 'ollama' && process.env.OLLAMA_BASE_URL) {
      return new OllamaProvider();
    }
    throw new Error(`Không tìm thấy provider hợp lệ. Vui lòng set GEMINI_API_KEY, ANTHROPIC_API_KEY hoặc OLLAMA_BASE_URL.`);
  }
}

const AGENT_RUNNERS = {
  planner:  process.env.PLANNER_RUNNER  || 'anthropic:claude-3-5-sonnet-20241022',
  manager:  process.env.MANAGER_RUNNER  || 'gemini:gemini-1.5-flash',
  worker:   process.env.WORKER_RUNNER   || 'gemini:gemini-1.5-flash',
  reviewer: process.env.REVIEWER_RUNNER || 'anthropic:claude-3-5-sonnet-20241022',
};

module.exports = {
  getProvider: (agentType) => createProvider(AGENT_RUNNERS[agentType] || AGENT_RUNNERS.worker),
  createProvider,
  parseRunner,
  AGENT_RUNNERS,
};
