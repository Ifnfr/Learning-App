import { Router } from 'express';
import config from '../config.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    providers: {
      anthropic: !!config.anthropicApiKey,
      openai: !!config.openaiApiKey,
      google: !!config.googleAiKey,
      moonshot: !!config.moonshotApiKey,
    },
  });
});

export default router;
