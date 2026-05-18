/**
 * Shared utility to extract JSON from possibly messy LLM output.
 */
function extractJSON(text) {
  // 1. Direct parse
  try { return JSON.parse(text); } catch {}

  // 2. Extract from ```json ... ``` block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
  }

  // 3. Find first {...} or [...] in response
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }

  throw new Error(`Could not extract valid JSON from response:\n${text.slice(0, 500)}`);
}

module.exports = { extractJSON };
