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

    // Parse OpenAI-compatible SSE protocol and yield plain text chunks
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(content);
                    }
                  } catch {}
                }
              }
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let enqueued = false;
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') {
                controller.close();
                return;
              }
              try {
                const data = JSON.parse(payload);
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(content);
                  enqueued = true;
                }
              } catch {}
            }
          }
          if (enqueued) return; // Yield control after processing all lines from this read
        }
      },
      cancel() {
        reader.cancel();
      },
    });
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
