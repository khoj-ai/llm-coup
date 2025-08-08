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

	constructor() {
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
			.option('--player-model <value>', 'Specify a player model in the format provider:model_name. This option can be used multiple times.', (value, previous: string[]) => previous.concat(value), [])
			.option('--personalities', 'Use different personalities for players')
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

	private async writeResultsToCsv(gameId: string, playerStats: PlayerStats[], model: string, personalities: boolean, publicDiscussion: boolean, totalPlayTime: number): Promise<void> {
		const csvPath = path.join(process.cwd(), 'results.csv');
		const fileExists = fs.existsSync(csvPath);
		const headers = 'game_id,date,player_id,player_name,winner,elimination_round,cause_of_elimination,num_bluffs,successful_bluffs,failed_bluffs,challenges_won,challenges_lost,coups_launched,assassinations_blocked,total_coins_earned,coins_lost_to_theft,attacks_received,attacks_launched,model,all_models,personalities,public_discussion,total_play_time\n';

		if (!fileExists) {
			fs.writeFileSync(csvPath, headers);
		}

		const gameDate = new Date().toISOString();
		const rows = playerStats.map(stats =>
			[gameId, gameDate, stats.id, stats.name, stats.winner, stats.elimination_round, stats.cause_of_elimination.join(';'), stats.num_bluffs, stats.successful_bluffs, stats.failed_bluffs, stats.challenges_won, stats.challenges_lost, stats.coups_launched, stats.assassinations_blocked, stats.total_coins_earned, stats.coins_lost_to_theft, stats.attacks_received, stats.attacks_launched, stats.model, model, personalities, publicDiscussion, totalPlayTime].join(',')
		).join('\n');

		fs.appendFileSync(csvPath, rows + '\n');
	}

	private async startGame(options: any): Promise<void> {
		const startTime = Date.now();
		const gameId = this.generateGameId();
		this.setupLogging(gameId);

		if (options.personalities && options.playerModel.length > 1) {
			console.error('When using --personalities, only one --player-model can be specified.');
			return;
		}

		const playerModels = options.playerModel.map((pm: string) => {
			const [provider, model] = pm.split(':');
			return { provider: provider.toLowerCase() as LLMProvider, model };
		});

		const allProviders = [...new Set(playerModels.map((pm: any) => pm.provider))];
		for (const provider of allProviders) {
			if (!this.getApiKey(provider as LLMProvider)) {
				return; // Error message is handled in getApiKey
			}
		}

		const numPlayers = parseInt(options.players);
		if (numPlayers < 2 || numPlayers > 6) {
			console.error('Number of players must be between 2 and 6');
			return;
		}

		const players = this.createPlayers(numPlayers, playerModels, options.personalities);
		const engine = new GameEngine(players, options.discussion);

		const finalStats = await engine.playGame();
		const totalPlayTime = (Date.now() - startTime) / 1000;
		await this.writeResultsToCsv(gameId, finalStats, playerModels.map((pm: any) => pm.model).join(';'), options.personalities || false, options.discussion || false, totalPlayTime);
	}

	private createPlayers(count: number, playerModels: { provider: LLMProvider, model: string }[], usePersonalities: boolean): LLMPlayer[] {
		const personalities = usePersonalities ? this.shuffleArray(Object.values(Personality)) : [];

		return Array.from({ length: count }, (_, i) => {
			const playerModel = playerModels[i % playerModels.length];
			const personality = personalities[i % personalities.length];
			const playerName = usePersonalities ? `Player ${i + 1} (${personality})` : `Player ${i + 1} (${playerModel.provider}:${playerModel.model})`;
			const apiKey = this.getApiKey(playerModel.provider)!;

			return new LLMPlayer(
				`player${i + 1}`,
				playerName,
				apiKey,
				playerModel.model,
				personality,
				playerModel.provider
			)
		});
	}

	private getApiKey(provider: LLMProvider): string | undefined {
		let apiKey: string | undefined;
		let envVar: string;

		switch (provider) {
			case LLMProvider.GEMINI:
				envVar = 'GEMINI_API_KEY';
				apiKey = process.env.GEMINI_API_KEY;
				break;
			case LLMProvider.ANTHROPIC:
				envVar = 'ANTHROPIC_API_KEY';
				apiKey = process.env.ANTHROPIC_API_KEY;
				break;
			case LLMProvider.OPENAI:
				envVar = 'OPENAI_API_KEY';
				apiKey = process.env.OPENAI_API_KEY;
				break;
		}

		if (!apiKey) {
			console.error(`API key for ${provider} not found. Please set the ${envVar} environment variable.`);
		}

		return apiKey;
	}

	private shuffleArray<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	run(): void {
		this.program.parse();
	}
}
