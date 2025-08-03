import chalk from 'chalk';
import { GameState, GamePhase, PlayerState } from './GameState';
import { Player } from './Player';
import { ActionType, CharacterType, GameAction } from './Cards';

export class GameEngine {
	private gameState: GameState;
	private players: Player[];
	private round: number = 1;

	constructor(players: Player[]) {
		this.players = players;
		this.gameState = this.initializeGame(players);
	}

	async playGame(): Promise<string> {
		console.log(chalk.bold.blue('Starting Coup Game!'));
		this.logGameState();

		while (!this.isGameOver()) {
			await this.playTurn();
		}

		const winner = this.getWinner();
		console.log(chalk.bold.green(`Game Over! Winner: ${winner?.name}`));
		return winner?.id || '';
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
			console.log(chalk.gray(`\n--- Round ${this.round} ---`));
		}
		const currentPlayer = this.getCurrentPlayerState();
		if (!currentPlayer.isAlive) {
			this.nextTurn();
			return;
		}

		console.log(chalk.yellow(`\n${currentPlayer.name}'s turn`));

		const player = this.players.find(p => p.id === currentPlayer.id)!;

		// Force coup if player has 10+ coins
		if (currentPlayer.coins >= 10) {
			const targets = this.gameState.players.filter(p => p.id !== currentPlayer.id && p.isAlive);
			const target = targets[Math.floor(Math.random() * targets.length)];
			const action: GameAction = { type: ActionType.COUP, playerId: currentPlayer.id, targetId: target.id, cost: 7, canBeBlocked: false };
			console.log(`${currentPlayer.name} is forced to COUP -> ${this.getPlayerName(action.targetId!)}`);
			await this.executeAction(action);
			this.nextTurn();
			return;
		}

		const action = await player.decideAction(this.gameState);
		console.log(`${currentPlayer.name} chooses: ${action.type}${action.targetId ? ` -> ${this.getPlayerName(action.targetId)}` : ''}`);

		await this.processAction(action);

		this.nextTurn();
	}

	private async processAction(action: GameAction): Promise<void> {
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

		if (hasCard) {
			console.log(`${playerState.name} reveals ${action.requiredCharacter}! Challenge failed.`);
			this.shuffleCard(action.playerId, action.requiredCharacter!);
			await this.loseInfluence(challengerId);
			return true; // Challenge failed, action proceeds
		} else {
			console.log(`${playerState.name} does not have ${action.requiredCharacter}! Challenge successful.`);
			await this.loseInfluence(action.playerId);
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
			return { success: !success }; // if challenge is successful, block fails
		}

		return { success: true }; // No challenge, block succeeds
	}

	private async executeAction(action: GameAction): Promise<void> {
		const playerState = this.getPlayerState(action.playerId)!;

		if (action.cost) {
			playerState.coins -= action.cost;
		}

		switch (action.type) {
			case ActionType.INCOME:
				playerState.coins++;
				break;
			case ActionType.FOREIGN_AID:
				playerState.coins += 2;
				break;
			case ActionType.COUP:
				await this.loseInfluence(action.targetId!);
				break;
			case ActionType.TAX:
				playerState.coins += 3;
				break;
			case ActionType.ASSASSINATE:
				await this.loseInfluence(action.targetId!);
				break;
			case ActionType.STEAL:
				const target = this.getPlayerState(action.targetId!)!;
				const amount = Math.min(2, target.coins);
				playerState.coins += amount;
				target.coins -= amount;
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
		this.logGameState();
	}

	private async loseInfluence(playerId: string): Promise<void> {
		const playerState = this.getPlayerState(playerId)!;
		if (!playerState.isAlive) return;

		const player = this.players.find(p => p.id === playerId)!;
		const cardToLose = await player.chooseCardToLose(this.gameState);

		const cardIndex = playerState.cards.indexOf(cardToLose);
		if (cardIndex > -1) {
			playerState.lostCards.push(playerState.cards.splice(cardIndex, 1)[0]);
			console.log(chalk.dim(`${playerState.name} loses a card: ${cardToLose}`));
		} else {
			// This should not happen if logic is correct
			const lostCard = playerState.cards.pop()!;
			playerState.lostCards.push(lostCard);
			console.log(chalk.dim(`${playerState.name} loses a card: ${lostCard} (fallback)`));
		}

		if (playerState.cards.length === 0) {
			playerState.isAlive = false;
			console.log(chalk.red(`${playerState.name} has been eliminated!`));
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
		let nextPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.players.length;
		while (!this.gameState.players[nextPlayerIndex].isAlive) {
			nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
		}
		this.gameState.currentPlayerIndex = nextPlayerIndex;
		if (this.gameState.currentPlayerIndex === 0) {
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

	private getPlayerName(playerId: string): string {
		return this.getPlayerState(playerId)?.name || playerId;
	}

	private logGameState(): void {
		console.log(chalk.bold('\n--- Game State ---'));
		this.gameState.players.forEach(p => {
			const status = p.isAlive ? chalk.green('Alive') : chalk.red('Eliminated');
			console.log(`${chalk.bold(p.name)}: ${status}, Coins: ${chalk.yellow(p.coins)}, Cards: ${p.cards.length}, Lost: ${p.lostCards.join(', ') || 'None'}`);
		});
		console.log(`Deck size: ${this.gameState.deck.length}`);
		console.log(chalk.bold('------------------\n'));
	}
}