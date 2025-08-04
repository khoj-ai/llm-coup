import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GameEngine } from '../game/GameEngine';
import { LLMPlayer } from '../ai/LLMPlayer';
import { LLMProvider } from '../ai/LLMProvider';
import { PlayerStats } from '../game/Player';
import { Personality } from '../ai/PromptBuilder';

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
			.option('--discussion', 'Enable player discussions')
			.action(this.startGame.bind(this));
	}

	private generateGameId(): string {
		return crypto.randomBytes(8).toString('hex');
	}

	private setupLogging(gameId: string): void {
		const logDir = path.join(process.cwd(), 'logs');
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir);
		}
		const logFile = path.join(logDir, `${gameId}.txt`);
		const logStream = fs.createWriteStream(logFile, { flags: 'a' });

		const stripAnsi = (str: string) => str.replace(/[][[()#;?]*.{0,2}(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

		console.log = (message: any, ...optionalParams: any[]) => {
			const plainMessage = stripAnsi(`${message} ${optionalParams.join(' ')}`);
			logStream.write(`${plainMessage}\n`);
			process.stdout.write(`${message} ${optionalParams.join(' ')}\n`);
		};

		console.error = (message: any, ...optionalParams: any[]) => {
			const plainMessage = stripAnsi(`${message} ${optionalParams.join(' ')}`);
			logStream.write(`ERROR: ${plainMessage}\n`);
			process.stderr.write(`ERROR: ${message} ${optionalParams.join(' ')}\n`);
		};
	}

	private async writeResultsToCsv(gameId: string, playerStats: PlayerStats[], model: string, personalities: boolean): Promise<void> {
		const csvPath = path.join(process.cwd(), 'results.csv');
		const fileExists = fs.existsSync(csvPath);
		const headers = 'game_id,player_id,player_name,winner,elimination_round,cause_of_elimination,num_bluffs,successful_bluffs,failed_bluffs,challenges_won,challenges_lost,coups_launched,assassinations_blocked,total_coins_earned,coins_lost_to_theft,model,personalities\n';

		if (!fileExists) {
			fs.writeFileSync(csvPath, headers);
		}

		const rows = playerStats.map(stats =>
			[gameId, stats.id, stats.name, stats.winner, stats.elimination_round, stats.cause_of_elimination, stats.num_bluffs, stats.successful_bluffs, stats.failed_bluffs, stats.challenges_won, stats.challenges_lost, stats.coups_launched, stats.assassinations_blocked, stats.total_coins_earned, stats.coins_lost_to_theft, model, personalities].join(',')
		).join('\n');

		fs.appendFileSync(csvPath, rows + '\n');
	}

	private async startGame(options: any): Promise<void> {
		const gameId = this.generateGameId();
		this.setupLogging(gameId);

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
		const engine = new GameEngine(players, options.discussion);

		const finalStats = await engine.playGame();
		await this.writeResultsToCsv(gameId, finalStats, model, options.personalities || false);
	}

	private createPlayers(count: number, apiKey: string, model: string, usePersonalities: boolean, provider: LLMProvider): LLMPlayer[] {
		const personalities = usePersonalities ? Object.values(Personality) : [];

		return Array.from({ length: count }, (_, i) => {
			const personality = personalities[i % personalities.length];
			const playerName = usePersonalities ? `Player ${i + 1} (${personality})` : `Player ${i + 1}`;

			return new LLMPlayer(
				`player${i + 1}`,
				playerName,
				apiKey,
				model,
				personality,
				provider
			)
		});
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
