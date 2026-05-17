import config from '../config.js';

function createProvider({ baseURL, apiKey, name, defaultModel }) {
  async function generate({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
    const chatMessages = [];
    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }
    chatMessages.push(...messages);

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${name} API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return { text };
  }

  async function stream({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
    const chatMessages = [];
    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }
    chatMessages.push(...messages);

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages: chatMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${name} API error ${response.status}: ${err}`);
    }

    return response.body;
  }

  return { generate, stream, name, defaultModel };
}

export const openai = createProvider({
  baseURL: 'https://api.openai.com/v1',
  apiKey: () => config.openaiApiKey,
  name: 'openai',
  defaultModel: 'gpt-4o',
});

export const openaiMini = createProvider({
  baseURL: 'https://api.openai.com/v1',
  apiKey: () => config.openaiApiKey,
  name: 'openai',
  defaultModel: 'gpt-4o-mini',
});

export const kimi = createProvider({
  baseURL: 'https://api.moonshot.cn/v1',
  apiKey: () => config.moonshotApiKey,
  name: 'kimi',
  defaultModel: 'kimi-k2',
});

export const kimiMoonlight = createProvider({
  baseURL: 'https://api.moonshot.cn/v1',
  apiKey: () => config.moonshotApiKey,
  name: 'kimi',
  defaultModel: 'moonshot-v1-128k',
});

export default { openai, openaiMini, kimi, kimiMoonlight };
