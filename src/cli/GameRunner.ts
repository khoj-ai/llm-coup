import { Command } from 'commander';
import { GameEngine } from '../game/GameEngine';
import { LLMPlayer } from '../ai/LLMPlayer';
import { LLMProvider } from '../ai/LLMProvider';

export class GameRunner {
  private program: Command;
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
	this.program
	  .name('coup-cli')
	  .description('CLI implementation of Coup card game with LLM players')
	  .version('1.0.0');

	this.program
	  .command('play')
	  .description('Start a new game')
	  .option('-p, --players <number>', 'Number of players (2-6)', '4')
	  .option('-m, --model <model>', 'LLM model to use')
	  .option('-k, --api-key <key>', 'API key for the LLM')
	  .option('--personalities', 'Use different personalities for players')
      .option('--gemini', 'Use the Gemini API')
      .option('--anthropic', 'Use the Anthropic API')
      .option('--openai', 'Use the OpenAI API')
	  .action(this.startGame.bind(this));
  }

  private async startGame(options: any): Promise<void> {
    const provider = this.getProvider(options);
	const numPlayers = parseInt(options.players);
	if (numPlayers < 2 || numPlayers > 6) {
	  console.error('Number of players must be between 2 and 6');
	  return;
	}

	const apiKey = options.apiKey || process.env.API_KEY;
	if (!apiKey) {
	  console.error('API key required. Set API_KEY environment variable or use --api-key option');
	  return;
	}

    let model = options.model;
    if (!model) {
        switch (provider) {
            case LLMProvider.GEMINI:
                model = 'gemini-1.5-flash-latest';
                break;
            case LLMProvider.ANTHROPIC:
                model = 'claude-3-opus-20240229';
                break;
            case LLMProvider.OPENAI:
                model = 'gpt-4';
                break;
        }
    }

	const players = this.createPlayers(numPlayers, apiKey, model, options.personalities, provider);
	const engine = new GameEngine(players);
	
	await engine.playGame();
  }

  private createPlayers(count: number, apiKey: string, model: string, usePersonalities: boolean, provider: LLMProvider): LLMPlayer[] {
	const personalities = usePersonalities ? [
	  'Aggressive and bold, likes to bluff frequently',
	  'Conservative and analytical, challenges often',
	  'Chaotic and unpredictable, makes surprising moves',
	  'Defensive and careful, blocks frequently',
	  'Strategic and patient, waits for the right moment',
	  'Paranoid and suspicious, trusts no one'
	] : [];

	return Array.from({ length: count }, (_, i) => 
	  new LLMPlayer(
		`player${i + 1}`,
		`Player ${i + 1}`,
		apiKey,
		model,
		personalities[i],
        provider
	  )
	);
  }

  private getProvider(options: any): LLMProvider {
    if (options.gemini) return LLMProvider.GEMINI;
    if (options.anthropic) return LLMProvider.ANTHROPIC;
    if (options.openai) return LLMProvider.OPENAI;
    return this.provider;
  }

  run(): void {
	this.program.parse();
  }
}
