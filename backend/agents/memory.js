const { getProvider } = require('../providers');

/**
 * Memory Agent — The "Brain" of the autonomous cycle.
 * It analyzes past work and decides the next strategic step.
 */
class MemoryAgent {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Reflect on a completed session and suggest the next cycle.
   */
  async reflect(sessionRequest, sessionResult, existingKnowledge = []) {
    const systemPrompt = `You are the Strategy & Memory Agent of a Digital Office.
Your goal is to learn from completed work and propose the next autonomous step.
IMPORTANT: All your text output (learnings, next_workflow_request, reasoning) MUST BE WRITTEN IN VIETNAMESE (Tiếng Việt).
Return JSON ONLY — no markdown fences, no extra text.`;

    const userPrompt = `CONTEXT:
Last Request: "${sessionRequest}"
Last Result Summary: "${sessionResult.slice(0, 2000)}"

EXISTING KNOWLEDGE:
${existingKnowledge.map(k => `- ${k.key}: ${k.value}`).join('\n')}

TASK:
1. Identify 3 SEO keywords for future blog posts based on the results.
2. Suggest 1 specific "Next Action" to be triggered automatically.
3. Update the Knowledge Base with any new "Learnings".

Return JSON:
{
  "learnings": [
    { "key": "string", "value": "string", "category": "seo|tone|strategy" }
  ],
  "next_workflow_request": "Prompt for the next autonomous session",
  "reasoning": "Why this is the next logical step"
}`;

    const response = await this.provider.generate(systemPrompt, userPrompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]+\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[MemoryAgent] Failed to parse reflection:', err);
      return { 
        learnings: [], 
        next_workflow_request: null, 
        reasoning: "Error in reflection" 
      };
    }
  }
}

module.exports = MemoryAgent;
