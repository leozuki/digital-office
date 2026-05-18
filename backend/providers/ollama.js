const https = require('https');
const http  = require('http');

class OllamaProvider {
  constructor(baseUrl, model) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model   = model   || process.env.OLLAMA_MODEL   || 'llama3';
    this.name    = `ollama:${this.model}`;
  }

  async generate(systemPrompt, userPrompt) {
    const body = JSON.stringify({
      model:  this.model,
      prompt: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
      stream: false,
    });

    return new Promise((resolve, reject) => {
      const url      = new URL('/api/generate', this.baseUrl);
      const lib      = url.protocol === 'https:' ? https : http;
      const options  = {
        hostname: url.hostname,
        port:     url.port,
        path:     url.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || '');
          } catch (e) {
            reject(new Error(`Ollama parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = OllamaProvider;
