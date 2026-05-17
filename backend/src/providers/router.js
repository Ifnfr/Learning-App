import config from '../config.js';
import anthropic from './anthropic.js';
import { openai, openaiMini, kimi, kimiMoonlight } from './openai.js';
import google from './google.js';

const TIER_1_TASKS = ['explanation', 'feynman_eval', 'study_plan'];
const TIER_2_TASKS = ['drill_batch', 'pretest', 'practice'];
const TIER_3_TASKS = ['validation', 'metadata', 'dual_pass'];

function getAvailableProviders() {
  const available = {};
  if (config.anthropicApiKey) available.anthropic = true;
  if (config.openaiApiKey) available.openai = true;
  if (config.googleAiKey) available.google = true;
  if (config.moonshotApiKey) available.kimi = true;
  return available;
}

function getProviderChain(task) {
  const tier1 = TIER_1_TASKS.includes(task);
  const tier2 = TIER_2_TASKS.includes(task);
  const tier3 = TIER_3_TASKS.includes(task);

  if (tier1 || tier2) {
    return [
      { provider: anthropic, key: 'anthropic' },
      { provider: openai, key: 'openai' },
      { provider: kimi, key: 'kimi' },
    ];
  }

  if (tier3) {
    return [
      { provider: google, key: 'google' },
      { provider: openaiMini, key: 'openai' },
      { provider: kimiMoonlight, key: 'kimi' },
    ];
  }

  // Default to tier 2 chain for unknown tasks
  return [
    { provider: anthropic, key: 'anthropic' },
    { provider: openai, key: 'openai' },
    { provider: kimi, key: 'kimi' },
  ];
}

export async function routeRequest(task, options) {
  const available = getAvailableProviders();
  const chain = getProviderChain(task);

  let lastError = null;

  for (const { provider, key } of chain) {
    if (!available[key]) continue;

    try {
      const result = await provider.generate(options);
      return { text: result.text, provider: provider.name, model: options.model || provider.defaultModel };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('No AI providers available. Please configure at least one API key.');
}

export async function routeStream(task, options) {
  const available = getAvailableProviders();
  const chain = getProviderChain(task);

  let lastError = null;

  for (const { provider, key } of chain) {
    if (!available[key]) continue;

    try {
      const stream = await provider.stream(options);
      return { stream, provider: provider.name, model: options.model || provider.defaultModel };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('No AI providers available. Please configure at least one API key.');
}
