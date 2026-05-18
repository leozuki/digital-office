const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
  constructor(apiKey, model) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.name  = `gemini:${this.model}`;
  }

  async generate(systemPrompt, userPrompt, options = {}) {
    const MAX_RETRIES = 4;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const model = this.genAI.getGenerativeModel({
          model:             this.model,
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 8192,
            temperature:     options.temperature || 0.7,
          },
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const msg    = err.message || '';
        const is429  = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
        const is5xx  = msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('Internal Server Error') || msg.includes('Bad Gateway') || msg.includes('Service Unavailable');
        const retryMs = msg.match(/retry.*?(\d+)s/i)?.[1];

        if ((is429 || is5xx) && attempt < MAX_RETRIES - 1) {
          const retrySeconds = retryMs ? Math.min(parseInt(retryMs), 60) : Math.min((2 ** attempt) * 5, 60);
          const waitMs = retrySeconds * 1000 + 500;
          const reason = is429 ? '429 Rate Limit' : '5xx Server Error';
          console.warn(`[Gemini] ${reason} — waiting ${retrySeconds}s before retry ${attempt + 1}/${MAX_RETRIES}…`);
          await new Promise((r) => setTimeout(r, waitMs));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }
}

module.exports = GeminiProvider;
