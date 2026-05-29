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
 * Create a provider instance from a runner string.
 * Falls back gracefully if an API key is missing.
 */
function createProvider(runnerStr) {
  const { provider, model } = parseRunner(runnerStr);

  try {
    switch (provider) {
      case 'anthropic':
        return new AnthropicProvider(process.env.ANTHROPIC_API_KEY, model);
      case 'gemini':
        return new GeminiProvider(process.env.GEMINI_API_KEY, model);
      case 'ollama':
        return new OllamaProvider(process.env.OLLAMA_BASE_URL, model);
      default:
        throw new Error(`Unknown provider: "${provider}"`);
    }
  } catch (err) {
    // Auto-fallback: if anthropic fails, try gemini, then ollama
    console.warn(`[Provider] ${err.message} — attempting fallback…`);
    if (provider !== 'gemini' && process.env.GEMINI_API_KEY) {
      return new GeminiProvider(process.env.GEMINI_API_KEY);
    }
    if (provider !== 'ollama') {
      return new OllamaProvider();
    }
    throw err;
  }
}

const AGENT_RUNNERS = {
  planner:  process.env.PLANNER_RUNNER  || 'anthropic:claude-3-5-sonnet-20241022',
  manager:  process.env.MANAGER_RUNNER  || 'gemini:gemini-3.5-flash',
  worker:   process.env.WORKER_RUNNER   || 'gemini:gemini-3.5-flash',
  reviewer: process.env.REVIEWER_RUNNER || 'anthropic:claude-3-5-sonnet-20241022',
};

module.exports = {
  getProvider: (agentType) => createProvider(AGENT_RUNNERS[agentType] || AGENT_RUNNERS.worker),
  createProvider,
  parseRunner,
  AGENT_RUNNERS,
};
