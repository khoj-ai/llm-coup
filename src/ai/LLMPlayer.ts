import OpenAI from 'openai';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { ActionType, CharacterType, GameAction } from '../game/Cards';
import { PromptBuilder, Personality } from './PromptBuilder';
import { LLMProvider } from './LLMProvider';

interface ActionResponse {
	reasoning: string;
	discussion?: string;
	action: ActionType;
	target?: string;
}

interface ChallengeResponse {
	reasoning: string;
	challenge: boolean;
	discussion?: string;
}

interface BlockResponse {
	reasoning: string;
	block: boolean;
	character?: CharacterType;
	discussion?: string;
}

interface CardLossResponse {
	reasoning: string;
	card: CharacterType;
	discussion?: string;
}

interface ExchangeResponse {
	reasoning: string;
	keep: CharacterType[];
	discussion?: string;
}

export class LLMPlayer extends Player {
	private openai: OpenAI;
	public model: string;
	private personality?: Personality;
	private tools: any;

	constructor(
		id: string,
		name: string,
		apiKey: string,
		model: string,
		personality: Personality,
		provider: LLMProvider = LLMProvider.OPENAI
	) {
		super(id, name, model);
		const baseURL = this.getBaseUrl(provider);
		this.openai = new OpenAI({ apiKey, baseURL });
		this.personality = personality;
		this.model = model;
		this.tools = PromptBuilder.getCoupTools();
	}

	private getBaseUrl(provider: LLMProvider): string | undefined {
		switch (provider) {
			case LLMProvider.GEMINI:
				return 'https://generativelanguage.googleapis.com/v1beta/openai/';
			case LLMProvider.ANTHROPIC:
				return 'https://api.anthropic.com/v1/'; // Placeholder, check actual API endpoint
			default:
				return undefined;
		}
	}

	async decideAction(gameState: GameState): Promise<GameAction> {
		const prompt = PromptBuilder.buildActionPrompt(gameState, this.id, this.personality);

		try {
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				tools: [this.tools.chooseAction],
				tool_choice: { type: 'function', function: { name: 'choose_action' } },
				temperature: 0.7
			});

			const toolCall = response.choices[0].message.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== 'choose_action') {
				throw new Error('Invalid function call response');
			}

			const actionData: ActionResponse = JSON.parse(toolCall.function.arguments);
			console.log(`💭 ${this.name}: ${actionData.reasoning}`);

			return this.buildGameAction(actionData, gameState);
		} catch (error) {
			console.warn(`⚠️ LLM call failed for ${this.name}, using fallback action`);
			return this.getFallbackAction(gameState);
		}
	}

	async decideChallengeAction(gameState: GameState, action: GameAction): Promise<{challenge: boolean, discussion?: string}> {
		const prompt = PromptBuilder.buildChallengePrompt(gameState, action, this.id, this.personality);

		try {
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				tools: [this.tools.decideChallengeAction],
				tool_choice: { type: 'function', function: { name: 'decide_challenge' } },
				temperature: 0.7
			});

			const toolCall = response.choices[0].message.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== 'decide_challenge') {
				throw new Error('Invalid function call response');
			}

			const challengeData: ChallengeResponse = JSON.parse(toolCall.function.arguments);
			console.log(`💭 ${this.name}: ${challengeData.reasoning}`);

			return { challenge: challengeData.challenge, discussion: challengeData.discussion };
		} catch (error) {
			console.warn(`⚠️ LLM call failed for ${this.name}, defaulting to no challenge`);
			return { challenge: false };
		}
	}

	async decideBlockAction(gameState: GameState, action: GameAction): Promise<{ block: boolean, character?: CharacterType, discussion?: string }> {
		const prompt = PromptBuilder.buildBlockPrompt(gameState, action, this.id, this.personality);

		try {
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				tools: [this.tools.decideBlockAction],
				tool_choice: { type: 'function', function: { name: 'decide_block' } },
				temperature: 0.7
			});

			const toolCall = response.choices[0].message.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== 'decide_block') {
				throw new Error('Invalid function call response');
			}

			const blockData: BlockResponse = JSON.parse(toolCall.function.arguments);
			console.log(`💭 ${this.name}: ${blockData.reasoning}`);

			return {
				block: blockData.block,
				character: blockData.character,
				discussion: blockData.discussion
			};
		} catch (error) {
			console.warn(`⚠️ LLM call failed for ${this.name}, defaulting to no block`);
			return { block: false };
		}
	}

	async chooseCardToLose(gameState: GameState): Promise<{card: CharacterType, discussion?: string}> {
		const prompt = PromptBuilder.buildCardLossPrompt(gameState, this.id, this.personality);

		try {
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				tools: [this.tools.chooseCardToLose],
				tool_choice: { type: 'function', function: { name: 'choose_card_to_lose' } },
				temperature: 0.7
			});

			const toolCall = response.choices[0].message.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== 'choose_card_to_lose') {
				throw new Error('Invalid function call response');
			}

			const lossData: CardLossResponse = JSON.parse(toolCall.function.arguments);
			console.log(`💭 ${this.name}: ${lossData.reasoning}`);

			// Validate the player actually has this card
			const player = gameState.players.find(p => p.id === this.id)!;
			if (player.cards.includes(lossData.card as CharacterType)) {
				return { card: lossData.card as CharacterType, discussion: lossData.discussion };
			} else {
				// Fallback to first available card
				return { card: player.cards[0] };
			}
		} catch (error) {
			console.warn(`⚠️ LLM call failed for ${this.name}, choosing random card to lose`);
			const player = gameState.players.find(p => p.id === this.id)!;
			return { card: player.cards[0] };
		}
	}

	async chooseCardsForExchange(gameState: GameState, availableCards: CharacterType[]): Promise<{cards: CharacterType[], discussion?: string}> {
		const prompt = PromptBuilder.buildExchangePrompt(gameState, this.id, availableCards, this.personality);

		try {
			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				tools: [this.tools.chooseCardsForExchange],
				tool_choice: { type: 'function', function: { name: 'choose_cards_for_exchange' } },
				temperature: 0.7
			});

			const toolCall = response.choices[0].message.tool_calls?.[0];
			if (!toolCall || toolCall.function.name !== 'choose_cards_for_exchange') {
				throw new Error('Invalid function call response');
			}

			const exchangeData: ExchangeResponse = JSON.parse(toolCall.function.arguments);
			console.log(`💭 ${this.name}: ${exchangeData.reasoning}`);

			const player = gameState.players.find(p => p.id === this.id)!;
			const requiredCount = player.cards.length;

			// Validate the selection
			if (exchangeData.keep.length === requiredCount &&
				exchangeData.keep.every(card => availableCards.includes(card as CharacterType))) {
				return { cards: exchangeData.keep as CharacterType[], discussion: exchangeData.discussion };
			} else {
				// Fallback: keep current cards if available, otherwise take first available
				return { cards: availableCards.slice(0, requiredCount) as CharacterType[] };
			}
		} catch (error) {
			console.warn(`⚠️ LLM call failed for ${this.name}, using fallback card selection`);
			const player = gameState.players.find(p => p.id === this.id)!;
			return { cards: availableCards.slice(0, player.cards.length) as CharacterType[] };
		}
	}

	private buildGameAction(actionData: ActionResponse, gameState: GameState): GameAction {
		const actionType = actionData.action as ActionType;
		const targetId = actionData.target;
		const discussion = actionData.discussion;

		// Map action types to game actions with proper validation
		switch (actionType) {
			case ActionType.INCOME:
				return { type: ActionType.INCOME, playerId: this.id, canBeBlocked: false, discussion };
			case ActionType.FOREIGN_AID:
				return { type: ActionType.FOREIGN_AID, playerId: this.id, canBeBlocked: true, blockingCharacters: [CharacterType.DUKE], discussion };
			case ActionType.COUP:
				if (!targetId) throw new Error('COUP requires a target');
				return { type: ActionType.COUP, playerId: this.id, targetId, cost: 7, canBeBlocked: false, discussion };
			case ActionType.TAX:
				return { type: ActionType.TAX, playerId: this.id, requiredCharacter: CharacterType.DUKE, canBeBlocked: false, discussion };
			case ActionType.ASSASSINATE:
				if (!targetId) throw new Error('ASSASSINATE requires a target');
				return { type: ActionType.ASSASSINATE, playerId: this.id, targetId, cost: 3, requiredCharacter: CharacterType.ASSASSIN, canBeBlocked: true, blockingCharacters: [CharacterType.CONTESSA], discussion };
			case ActionType.STEAL:
				if (!targetId) throw new Error('STEAL requires a target');
				return { type: ActionType.STEAL, playerId: this.id, targetId, requiredCharacter: CharacterType.CAPTAIN, canBeBlocked: true, blockingCharacters: [CharacterType.CAPTAIN, CharacterType.AMBASSADOR], discussion };
			case ActionType.EXCHANGE:
				return { type: ActionType.EXCHANGE, playerId: this.id, requiredCharacter: CharacterType.AMBASSADOR, canBeBlocked: false, discussion };
			default:
				throw new Error(`Unknown action type: ${actionType}`);
		}
	}

	private getFallbackAction(gameState: GameState): GameAction {
		const player = gameState.players.find(p => p.id === this.id)!;

		// Force coup if required
		if (player.coins >= 7) {
			const targets = gameState.players.filter(p => p.id !== this.id && p.isAlive);
			const target = targets[Math.floor(Math.random() * targets.length)];
			return { type: ActionType.COUP, playerId: this.id, targetId: target.id, cost: 7, canBeBlocked: false };
		}

		// Otherwise take income as safe fallback
		return { type: ActionType.INCOME, playerId: this.id, canBeBlocked: false };
	}
}
