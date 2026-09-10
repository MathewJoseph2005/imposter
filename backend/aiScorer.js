const axios = require('axios');

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(10, Math.max(0, numeric));
}

function parseJsonSafe(raw) {
  if (!raw) return null;

  const cleaned = String(raw)
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}') + 1;
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end));
      }
    } catch (innerError) {
      return null;
    }
    return null;
  }
}

async function scoreRepository(githubUrl) {
  const repoUrl = String(githubUrl || '').trim();

  if (!repoUrl) {
    throw new Error('GitHub repository URL is required.');
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is missing.');
  }

  const prompt = `
    Evaluate this GitHub repository for the Asthra Imposter competition: ${repoUrl}

    Score each category from 0 to 10:
    - UI / Design
    - Logic / Functionality
    - Creativity
    - Secret Imposter Task

    Maximum total is 40.

    Return STRICT JSON only in this exact format:
    {
      "ui_score": 8,
      "logic_score": 10,
      "creativity_score": 9,
      "imposter_score": 7,
      "total_score": 34,
      "feedback": "Clean UI. Logic works. Secret task partially implemented."
    }
  `;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a strict evaluator for a coding competition. Only return valid JSON matching the provided schema.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content;
    const parsed = parseJsonSafe(content);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Groq returned invalid JSON.');
    }

    const ui_score = clampScore(parsed.ui_score);
    const logic_score = clampScore(parsed.logic_score);
    const creativity_score = clampScore(parsed.creativity_score);
    const imposter_score = clampScore(parsed.imposter_score);

    const computedTotal = ui_score + logic_score + creativity_score + imposter_score;
    const total_score = clampScore(parsed.total_score || computedTotal);

    return {
      ui_score,
      logic_score,
      creativity_score,
      imposter_score,
      total_score: Math.min(total_score, 40),
      feedback: String(parsed.feedback || 'Repository evaluated successfully.')
    };
  } catch (error) {
    const message = error?.response?.data?.error?.message || error?.message || 'AI scoring failed.';
    throw new Error(message);
  }
}

module.exports = {
  scoreRepository
};