const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  authPassphraseHash: process.env.AUTH_PASSPHRASE_HASH || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  googleAiKey: process.env.GOOGLE_AI_KEY || '',
  moonshotApiKey: process.env.MOONSHOT_API_KEY || '',
};

export default config;
