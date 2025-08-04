import chalk from 'chalk';
import { GameState, GamePhase, PlayerState } from './GameState';
import { Player, PlayerStats } from './Player';
import { ActionType, CharacterType, GameAction } from './Cards';

export class GameEngine {
	private gameState: GameState;
	private players: Player[];
	private round: number = 1;
	private playerStats: PlayerStats[];
	private discussion: boolean;

	constructor(players: Player[], discussion: boolean = false) {
		this.players = players;
		this.discussion = discussion;
		this.gameState = this.initializeGame(players);
		this.playerStats = this.players.map(p => ({
			id: p.id,
			name: p.name,
			winner: false,
			elimination_round: 0,
			num_bluffs: 0,
			successful_bluffs: 0,
			failed_bluffs: 0,
			challenges_won: 0,
			challenges_lost: 0,
			coups_launched: 0,
			assassinations_blocked: 0,
			total_coins_earned: 2,
			coins_lost_to_theft: 0,
		}));
	}

	async playGame(): Promise<PlayerStats[]> {
		console.log(chalk.bold.blue('Starting Coup Game!'));
		this.logGameState();

		while (!this.isGameOver()) {
			await this.playTurn();
		}

		const winner = this.getWinner();
		if (winner) {
			const winnerStats = this.getPlayerStats(winner.id)!;
			winnerStats.winner = true;
		}

		console.log(chalk.bold.green(`Game Over! Winner: ${winner?.name}`));
		this.logPlayerStats();
		return this.playerStats;
	}

	private initializeGame(players: Player[]): GameState {
		const deck = this.createDeck();
		const playerStates: PlayerState[] = players.map((player, i) => ({
			id: player.id,
			name: player.name,
			coins: 2,
			cards: [deck.pop()!, deck.pop()!],
			isAlive: true,
			lostCards: [],
		}));

		return {
			players: playerStates,
			currentPlayerIndex: 0,
			deck,
			gameLog: [],
			phase: GamePhase.ACTION,
		};
	}

	private createDeck(): CharacterType[] {
		const deck: CharacterType[] = [];
		const characters = Object.values(CharacterType);
		for (let i = 0; i < 3; i++) {
			deck.push(...characters);
		}
		return this.shuffle(deck);
	}

	private shuffle<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	private async playTurn(): Promise<void> {
		if (this.gameState.currentPlayerIndex === 0) {
			console.log(chalk.gray(`--- Round ${this.round} ---`));
		}
		const currentPlayer = this.getCurrentPlayerState();
		if (!currentPlayer.isAlive) {
			this.nextTurn();
			return;
		}

		console.log(chalk.yellow(`${currentPlayer.name}'s turn. Cards: ${currentPlayer.cards.join(', ')}, Coins: ${currentPlayer.coins}`));

		const player = this.players.find(p => p.id === currentPlayer.id)!;

		// Force coup if player has 10+ coins
		if (currentPlayer.coins >= 10) {
			const targets = this.gameState.players.filter(p => p.id !== currentPlayer.id && p.isAlive);
			const target = targets[Math.floor(Math.random() * targets.length)];
			const action: GameAction = { type: ActionType.COUP, playerId: currentPlayer.id, targetId: target.id, cost: 7, canBeBlocked: false };
			console.log(`${currentPlayer.name} is forced to COUP -> ${this.getPlayerName(action.targetId!)}`);
			await this.executeAction(action);
			this.logGameState();
			this.nextTurn();
			return;
		}

		const action = await player.decideAction(this.gameState);
		if (this.discussion && action.discussion) {
			this.gameState.gameLog.push({ type: 'discussion', message: `${currentPlayer.name}: ${action.discussion}` });
		}
		console.log(`${currentPlayer.name} chooses: ${action.type}${action.targetId ? ` -> ${this.getPlayerName(action.targetId)}` : ''}`);

		await this.processAction(action);

		this.logGameState();
		this.nextTurn();
	}

	private async processAction(action: GameAction): Promise<void> {
		this.gameState.gameLog.push({ type: 'action', message: `${action.playerId} uses ${action.type}${action.targetId ? ` on ${action.targetId}` : ''}` });
		this.gameState.pendingAction = { action, resolved: false };
		this.gameState.phase = GamePhase.CHALLENGE;

		if (action.requiredCharacter) {
			const challenger = await this.checkForChallenges(action);
			if (challenger) {
				const success = await this.resolveChallenge(action, challenger);
				if (!success) {
					this.gameState.pendingAction = undefined;
					return; // Action was successfully challenged
				}
			}
		}

		this.gameState.phase = GamePhase.BLOCK;

		if (action.canBeBlocked) {
			const blocker = await this.checkForBlocks(action);
			if (blocker) {
				const blockData = await this.resolveBlock(action, blocker.id, blocker.character);
				if (blockData.success) {
					this.gameState.pendingAction = undefined;
					return; // Action was blocked
				}
			}
		}

		this.gameState.phase = GamePhase.RESOLVE;
		await this.executeAction(action);
		this.gameState.pendingAction = undefined;
	}

	private async checkForChallenges(action: GameAction): Promise<string | undefined> {
		const challengers = await Promise.all(this.players.map(async player => {
			if (player.id !== action.playerId && this.getPlayerState(player.id)!.isAlive) {
				const challenge = await player.decideChallengeAction(this.gameState, action);
				if (challenge) {
					console.log(chalk.magenta(`Challenge! ${player.name} challenges ${this.getPlayerName(action.playerId)}`));
					return player.id;
				}
			}
			return undefined;
		}));
		return challengers.find(c => c !== undefined);
	}

	private async resolveChallenge(action: GameAction, challengerId: string): Promise<boolean> {
		const playerState = this.getPlayerState(action.playerId)!;
		const hasCard = playerState.cards.includes(action.requiredCharacter!);
		const actionPlayerStats = this.getPlayerStats(action.playerId)!;
		const challengerStats = this.getPlayerStats(challengerId)!;

		if (action.requiredCharacter) {
			actionPlayerStats.num_bluffs++;
		}

		if (hasCard) {
			console.log(`${playerState.name} reveals ${action.requiredCharacter}! Challenge failed.`);
			this.gameState.gameLog.push({ type: 'challenge_failed', message: `${challengerId} challenged ${action.playerId} but failed.` });
			this.shuffleCard(action.playerId, action.requiredCharacter!);
			actionPlayerStats.successful_bluffs++;
			challengerStats.challenges_lost++;
			await this.loseInfluence(challengerId, 'failed_challenge');
			return true; // Challenge failed, action proceeds
		} else {
			console.log(`${playerState.name} does not have ${action.requiredCharacter}! Challenge successful.`);
			this.gameState.gameLog.push({ type: 'challenge_successful', message: `${challengerId} successfully challenged ${action.playerId}.` });
			actionPlayerStats.failed_bluffs++;
			challengerStats.challenges_won++;
			await this.loseInfluence(action.playerId, 'failed_challenge');
			return false; // Challenge successful, action fails
		}
	}

	private async checkForBlocks(action: GameAction): Promise<{ id: string, character: CharacterType } | undefined> {
		const potentialBlockers = this.players.filter(p => {
			const playerState = this.getPlayerState(p.id);
			if (!playerState?.isAlive) {
				return false;
			}
			if (action.targetId) {
				return p.id === action.targetId;
			}
			return p.id !== action.playerId;
		});

		for (const player of potentialBlockers) {
			const decision = await player.decideBlockAction(this.gameState, action);
			if (decision.block) {
				console.log(chalk.cyan(`${player.name} blocks with ${decision.character}`));
				return { id: player.id, character: decision.character! };
			}
		}
		return undefined;
	}

	private async resolveBlock(action: GameAction, blockerId: string, blockingCharacter: CharacterType): Promise<{ success: boolean }> {
		this.gameState.phase = GamePhase.CHALLENGE; // Challenge on the block
		const blockAction: GameAction = {
			type: ActionType.BLOCK, // A virtual action to represent the block
			playerId: blockerId,
			requiredCharacter: blockingCharacter,
			canBeBlocked: false
		};

		const challenger = await this.checkForChallenges(blockAction);

		if (challenger) {
			const success = await this.resolveChallenge(blockAction, challenger);
			if (action.type === 'ASSASSINATE' && success) {
				const blockerStats = this.getPlayerStats(blockerId)!;
				blockerStats.assassinations_blocked++;
			}
			const blockResult = !success;
			if (blockResult) {
				this.gameState.gameLog.push({ type: 'block_successful', message: `${blockerId} successfully blocked ${action.playerId}.` });
			} else {
				this.gameState.gameLog.push({ type: 'block_failed', message: `${blockerId} failed to block ${action.playerId}.` });
			}
			return { success: blockResult }; // if challenge is successful, block fails
		}

		this.gameState.gameLog.push({ type: 'block_successful', message: `${blockerId} successfully blocked ${action.playerId}.` });
		return { success: true }; // No challenge, block succeeds
	}

	private async executeAction(action: GameAction): Promise<void> {
		const playerState = this.getPlayerState(action.playerId)!;
		const stats = this.getPlayerStats(action.playerId)!;

		if (action.cost) {
			playerState.coins -= action.cost;
		}

		switch (action.type) {
			case ActionType.INCOME:
				playerState.coins++;
				stats.total_coins_earned++;
				break;
			case ActionType.FOREIGN_AID:
				playerState.coins += 2;
				stats.total_coins_earned += 2;
				break;
			case ActionType.COUP:
				stats.coups_launched++;
				await this.loseInfluence(action.targetId!, 'coup');
				break;
			case ActionType.TAX:
				playerState.coins += 3;
				stats.total_coins_earned += 3;
				break;
			case ActionType.ASSASSINATE:
				await this.loseInfluence(action.targetId!, 'assassination');
				break;
			case ActionType.STEAL:
				const target = this.getPlayerState(action.targetId!)!;
				const targetStats = this.getPlayerStats(action.targetId!)!;
				const amount = Math.min(2, target.coins);
				playerState.coins += amount;
				stats.total_coins_earned += amount;
				target.coins -= amount;
				targetStats.coins_lost_to_theft += amount;
				break;
			case ActionType.BLOCK:
				// Block is a virtual action, its effects are handled in the challenge/block resolution phase.
				break;
			case ActionType.EXCHANGE:
				const player = this.players.find(p => p.id === action.playerId)!;
				const cardsToExchange = [this.gameState.deck.pop()!, this.gameState.deck.pop()!];
				const allCards = [...playerState.cards, ...cardsToExchange];
				const keptCards = await player.chooseCardsForExchange(this.gameState, allCards);
				playerState.cards = keptCards;
				const returnedCards = allCards.filter(c => !keptCards.includes(c));
				this.gameState.deck.push(...returnedCards);
				this.shuffle(this.gameState.deck);
				break;
		}
	}

	private async loseInfluence(playerId: string, cause?: string): Promise<void> {
		const playerState = this.getPlayerState(playerId)!;
		if (!playerState.isAlive) return;

		const player = this.players.find(p => p.id === playerId)!;
		let cardToLose: CharacterType;

		if (playerState.cards.length === 1) {
			cardToLose = playerState.cards[0];
		} else {
			cardToLose = await player.chooseCardToLose(this.gameState);
		}

		const cardIndex = playerState.cards.indexOf(cardToLose);
		if (cardIndex > -1) {
			playerState.lostCards.push(playerState.cards.splice(cardIndex, 1)[0]);
			console.log(chalk.dim(`${playerState.name} loses a card: ${cardToLose}`));
			this.gameState.gameLog.push({ type: 'lose_influence', message: `${playerId} loses ${cardToLose}.` });
		} else {
			// This should not happen if logic is correct
			const lostCard = playerState.cards.pop()!;
			playerState.lostCards.push(lostCard);
			console.log(chalk.dim(`${playerState.name} loses a card: ${lostCard} (fallback)`));
			this.gameState.gameLog.push({ type: 'lose_influence', message: `${playerId} loses ${lostCard}.` });
		}

		if (playerState.cards.length === 0) {
			playerState.isAlive = false;
			const stats = this.getPlayerStats(playerId)!;
			stats.elimination_round = this.round;
			stats.cause_of_elimination = cause;
			console.log(chalk.red(`${playerState.name} has been eliminated!`));
			this.gameState.gameLog.push({ type: 'elimination', message: `${playerId} has been eliminated.` });
		}
	}

	private shuffleCard(playerId: string, card: CharacterType): void {
		const playerState = this.getPlayerState(playerId)!;
		const cardIndex = playerState.cards.indexOf(card);
		if (cardIndex > -1) {
			this.gameState.deck.push(playerState.cards.splice(cardIndex, 1)[0]);
			this.shuffle(this.gameState.deck);
			playerState.cards.push(this.gameState.deck.pop()!);
		}
	}

	private nextTurn(): void {
		const currentIndex = this.gameState.currentPlayerIndex;
		let nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.players.length;
		while (!this.gameState.players[nextPlayerIndex].isAlive) {
			nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
		}
		this.gameState.currentPlayerIndex = nextPlayerIndex;
		if (nextPlayerIndex < currentIndex) {
			this.round++;
		}
	}

	private isGameOver(): boolean {
		return this.gameState.players.filter(p => p.isAlive).length <= 1;
	}

	private getWinner(): PlayerState | undefined {
		return this.gameState.players.find(p => p.isAlive);
	}

	private getCurrentPlayerState(): PlayerState {
		return this.gameState.players[this.gameState.currentPlayerIndex];
	}

	private getPlayerState(playerId: string): PlayerState | undefined {
		return this.gameState.players.find(p => p.id === playerId);
	}

	private getPlayerStats(playerId: string): PlayerStats | undefined {
		return this.playerStats.find(p => p.id === playerId);
	}

	private getPlayerName(playerId: string): string {
		return this.getPlayerState(playerId)?.name || playerId;
	}

	private logGameState(): void {
		console.log(chalk.bold('\n--- Game State ---'));
		const tableData = this.gameState.players.map(p => ({
			Player: p.name,
			Status: p.isAlive ? 'Alive' : 'Eliminated',
			Coins: p.coins,
			Cards: p.cards.length,
			'Lost Cards': p.lostCards.join(', ') || 'None',
		}));
		console.table(tableData);
		console.log(`Deck size: ${this.gameState.deck.length}`);
		console.log(chalk.bold('------------------\n'));
	}

	private logPlayerStats(): void {
		console.log(chalk.bold.blue('\n--- Player Stats ---'));
		const tableData = this.playerStats.map(stats => ({
			Player: stats.name,
			Winner: stats.winner ? 'Yes' : 'No',
			'Elim. Round': stats.elimination_round || '-',
			'Elim. Cause': stats.cause_of_elimination || '-',
			Bluffs: stats.num_bluffs,
			'Successful Bluffs': stats.successful_bluffs,
			'Failed Bluffs': stats.failed_bluffs,
			'Chal. Won': stats.challenges_won,
			'Chal. Lost': stats.challenges_lost,
			Coups: stats.coups_launched,
			'Assassinations Blocked': stats.assassinations_blocked,
			'Coins Earned': stats.total_coins_earned,
			'Coins Lost to Theft': stats.coins_lost_to_theft,
		}));
		console.table(tableData);
		console.log(chalk.bold.blue('--------------------\n'));
	}
}