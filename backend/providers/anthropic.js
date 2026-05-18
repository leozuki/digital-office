const Anthropic = require('@anthropic-ai/sdk');

class AnthropicProvider {
  constructor(apiKey, model) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey });
    this.model  = model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.name   = `anthropic:${this.model}`;
  }

  async generate(systemPrompt, userPrompt, options = {}) {
    const response = await this.client.messages.create({
      model:      this.model,
      max_tokens: options.maxTokens || 8192,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return response.content[0].text;
  }
}

module.exports = AnthropicProvider;
