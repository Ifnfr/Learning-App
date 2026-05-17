import { Router } from 'express';
import { routeRequest, routeStream } from '../providers/router.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { task, system, messages, maxTokens, temperature } = req.body;

    if (!task || !messages) {
      return res.status(400).json({ error: 'task and messages are required' });
    }

    const result = await routeRequest(task, { system, messages, maxTokens, temperature });
    return res.json(result);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'AI provider error' });
  }
});

router.post('/stream', async (req, res) => {
  try {
    const { task, system, messages, maxTokens, temperature } = req.body;

    if (!task || !messages) {
      return res.status(400).json({ error: 'task and messages are required' });
    }

    const { stream, provider, model } = await routeStream(task, { system, messages, maxTokens, temperature });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send metadata as first event
    res.write(`data: ${JSON.stringify({ provider, model })}\n\n`);

    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // value is already a plain text string from the provider's parsed stream
        res.write(`data: ${JSON.stringify({ text: value })}\n\n`);
      }
    } catch (streamErr) {
      // Stream aborted or errored
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      return res.status(502).json({ error: err.message || 'AI provider error' });
    }
    res.end();
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { question, options } = req.body;

    if (!question || !options) {
      return res.status(400).json({ error: 'question and options are required' });
    }

    const system = `You are an expert exam validator. Analyze the given question and its answer options using dual-pass validation.

First pass: Determine the correct answer independently.
Second pass: Verify by elimination of wrong answers.

Respond ONLY in valid JSON with this exact structure:
{"answer": "A", "confidence": 0.95, "reasoning": "Brief explanation"}`;

    const userMessage = `Question: ${question}\n\nOptions:\n${options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}`;

    const result = await routeRequest('dual_pass', {
      system,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.1,
    });

    try {
      const parsed = JSON.parse(result.text);
      return res.json({ answer: parsed.answer, confidence: parsed.confidence, reasoning: parsed.reasoning });
    } catch (parseErr) {
      return res.json({ answer: null, confidence: 0, reasoning: result.text });
    }
  } catch (err) {
    return res.status(502).json({ error: err.message || 'AI provider error' });
  }
});

export default router;
