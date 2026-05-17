import config from '../config.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const API_URL = 'https://api.anthropic.com/v1/messages';

export async function generate({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return { text };
}

export async function stream({ system, messages, maxTokens = 4096, temperature = 0.7, signal, model }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  // Parse Anthropic SSE protocol and yield plain text chunks
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'content_block_delta' && data.delta?.text) {
                    controller.enqueue(data.delta.text);
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
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta' && data.delta?.text) {
                controller.enqueue(data.delta.text);
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

export default { generate, stream, name: 'anthropic', defaultModel: DEFAULT_MODEL };
