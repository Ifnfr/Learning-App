import config from '../config.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildRequestBody(system, messages, temperature, maxTokens) {
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  return body;
}

export async function generate({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
  const modelId = model || DEFAULT_MODEL;
  const url = `${BASE_URL}/${modelId}:generateContent?key=${config.googleAiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(system, messages, temperature, maxTokens)),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google AI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .join('') || '';

  return { text };
}

export async function stream({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
  const modelId = model || DEFAULT_MODEL;
  const url = `${BASE_URL}/${modelId}:streamGenerateContent?alt=sse&key=${config.googleAiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(system, messages, temperature, maxTokens)),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google AI API error ${response.status}: ${err}`);
  }

  return response.body;
}

export default { generate, stream, name: 'google', defaultModel: DEFAULT_MODEL };
