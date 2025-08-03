import 'dotenv/config';
import { GameRunner } from './cli/GameRunner';

import { LLMProvider } from './ai/LLMProvider';

const getProvider = (): LLMProvider => {
  if (process.argv.includes('--gemini')) {
    return LLMProvider.GEMINI;
  }
  if (process.argv.includes('--anthropic')) {
    return LLMProvider.ANTHROPIC;
  }
  return LLMProvider.OPENAI;
};

const runner = new GameRunner(getProvider());
runner.run();
