import { GameState } from "../game/GameState";
import { GameAction, CharacterType } from "../game/Cards";

export enum Personality {
  ANALYTICAL = 'analytical',
  CAUTIOUS = 'cautious',
  COMPETITIVE = 'competitive',
  SUSPICIOUS = 'suspicious',
  DESPERATE = 'desperate',
  STRAIGHTFORWARD = 'straightforward',
}

const personalityMap: Record<Personality, string> = {
  [Personality.ANALYTICAL]: "You are a master strategist, always thinking three steps ahead. You favor logic and calculated risks over emotional plays. Your goal is to identify the optimal move based on probabilities and opponent's likely holdings.",
  [Personality.CAUTIOUS]: "You are careful and risk-averse. You prioritize survival and accumulating resources quietly. You avoid confrontation unless absolutely necessary and prefer to build up your strength for a decisive late-game move.",
  [Personality.COMPETITIVE]: "You are a highly aggressive and dominant player. You aim to control the game from the start, eliminating threats and asserting your power.",
  [Personality.SUSPICIOUS]: "You are a paranoid and distrustful player. You believe everyone is lying to you. You look for inconsistencies in the game play.",
  [Personality.DESPERATE]: "You are falling behind and need to take big risks to catch up. Others call you bold and unpredictable.",
  [Personality.STRAIGHTFORWARD]: "You are an honest and direct player. You prefer to tell the truth."
};

interface CoupTools {
  chooseAction: any;
  decideChallengeAction: any;
  decideBlockAction: any;
  chooseCardToLose: any;
  chooseCardsForExchange: any;
}

export class PromptBuilder {
  static getCoupTools(): CoupTools {
	return {
	  chooseAction: {
		type: "function",
		function: {
			name: "choose_action",
			description: "Choose an action to take during your turn in Coup",
			parameters: {
			  type: "object",
			  properties: {
				action: {
				  type: "string",
				  enum: ["INCOME", "FOREIGN_AID", "COUP", "TAX", "ASSASSINATE", "STEAL", "EXCHANGE"],
				  description: "The action you want to take"
				},
				target: {
				  type: "string",
				  description: "Target player ID (required for COUP, ASSASSINATE, STEAL)"
				},
				reasoning: {
				  type: "string",
				  description: "Brief explanation of your strategy and why you chose this action"
				},
				discussion: {
				  type: "string",
				  description: "A message to say to the other players about your action."
				}
			  },
			  required: ["action", "reasoning"],
			}
		}
	  },

	  decideChallengeAction: {
		type: "function",
		function: {
			name: "decide_challenge",
			description: "Decide whether to challenge another player's action",
			parameters: {
			  type: "object",
			  properties: {
				challenge: {
				  type: "boolean",
				  description: "Whether to challenge the action (true) or not (false)"
				},
				reasoning: {
				  type: "string",
				  description: "Your reasoning for challenging or not challenging"
				}
			  },
			  required: ["challenge", "reasoning"],
			}
		}
	  },

	  decideBlockAction: {
		type: "function",
		function: {
			name: "decide_block",
			description: "Decide whether to block another player's action",
			parameters: {
			  type: "object",
			  properties: {
				block: {
				  type: "boolean",
				  description: "Whether to block the action"
				},
				character: {
				  type: "string",
				  enum: Object.values(CharacterType),
				  description: "Which character you claim to have for blocking (required if block is true)"
				},
				reasoning: {
				  type: "string",
				  description: "Your reasoning for blocking or not blocking"
				}
			  },
			  required: ["block", "reasoning"],
			}
		}
	  },

	  chooseCardToLose: {
		type: "function",
		function: {
			name: "choose_card_to_lose",
			description: "Choose which card to lose when forced to discard",
			parameters: {
			  type: "object",
			  properties: {
				card: {
				  type: "string",
				  enum: ["DUKE", "ASSASSIN", "CAPTAIN", "AMBASSADOR", "CONTESSA"],
				  description: "The character card you choose to lose"
				},
				reasoning: {
				  type: "string",
				  description: "Why you chose to lose this card"
				}
			  },
			  required: ["card", "reasoning"],
			}
		}
	  },

	  chooseCardsForExchange: {
		type: "function",
		function: {
			name: "choose_cards_for_exchange",
			description: "Choose which cards to keep during an exchange action",
			parameters: {
			  type: "object",
			  properties: {
				keep: {
				  type: "array",
				  items: {
					type: "string",
					enum: Object.values(CharacterType)
				  },
				  description: "The cards you want to keep (must match your hand size)",
				},
				reasoning: {
				  type: "string",
				  description: "Your strategy for these card choices"
				}
			  },
			  required: ["keep", "reasoning"],
			}
		}
	  }
	};
  }

  static buildActionPrompt(gameState: GameState, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const availableTargets = gameState.players
	  .filter(p => p.id !== playerId && p.isAlive)
	  .map(p => p.id)
	  .join(', ');
	const personalityText = personality ? personalityMap[personality] : '';
	const gameHistory = this.buildGameHistory(gameState);
	
	return `You are playing Coup, a bluffing card game. ${personalityText ? `Your personality: ${personalityText}` : ''}

GAME STATE:
${gameContext}

GAME HISTORY:
${gameHistory}

YOUR CARDS: ${player.cards.join(', ')}
YOUR COINS: ${player.coins}

AVAILABLE TARGETS: ${availableTargets}

GAME RULES REMINDER:
- Income: Take 1 coin (always available)
- Foreign Aid: Take 2 coins (can be blocked by Duke)
- Coup: Pay 7 coins to eliminate a player's card (costs 7 coins, cannot be blocked)
${player.coins >= 10 ? '- You MUST coup if you have 10+ coins!' : ''}
- You lose if you have no cards left

CHARACTER ACTIONS (you can bluff having these):
- Tax (Duke): Take 3 coins
- Assassinate (Assassin): Pay 3 coins to force target to lose a card
- Steal (Captain): Take 2 coins from another player  
- Exchange (Ambassador): Draw 2 cards, keep your hand size, shuffle rest back
- Block (Contessa): Block Assassinate

Choose your action wisely considering your cards, coins, and strategy!`;
  }

  static buildChallengePrompt(gameState: GameState, action: GameAction, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const actingPlayer = gameState.players.find(p => p.id === action.playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const personalityText = personality ? personalityMap[personality] : '';
	const gameHistory = this.buildGameHistory(gameState);
	const isTargeted = action.targetId === playerId;

	let blockInfo = '';
	if (action.type === 'BLOCK') {
		// Don't show block info when challenging a block
	} else if (action.canBeBlocked) {
		if (isTargeted) {
			blockInfo = `
If you don't challenge, you will have the opportunity to block this action.
This action can be blocked by: ${action.blockingCharacters?.join(', ')}.
You can bluff having these cards.`;
		} else {
			blockInfo = `
If no one challenges, the target will have an opportunity to block.
This action can be blocked, if the target has one of these cards: ${action.blockingCharacters?.join(', ')}.`;
		}
	} else {
		blockInfo = `
This action cannot be blocked. If no one challenges, it will resolve immediately.`;
	}

	if (blockInfo) {
		// Prepend the block info phase review
		blockInfo = `BLOCKING PHASE PREVIEW:
${blockInfo}`;
	}
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}

GAME STATE:
${gameContext}

GAME HISTORY:
${gameHistory}

YOUR CARDS: ${player.cards.join(', ')}

CHALLENGE SITUATION:
${actingPlayer.id} is attempting to use ${action.type}${action.requiredCharacter ? ` (claiming to have ${action.requiredCharacter})` : ''}.

CHALLENGE RULES:
- If you challenge and they DON'T have the character: they lose a card
- If you challenge and they DO have the character: you lose a card, they shuffle and redraw
- Consider what cards you have
- There are three of each character in the deck
- Consider what's been revealed/discarded already
- Think about their previous actions and bluffing patterns

${blockInfo}

Risk vs Reward: Is it worth the gamble?`;
  }

  static buildBlockPrompt(gameState: GameState, action: GameAction, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const actingPlayer = gameState.players.find(p => p.id === action.playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const isTargeted = action.targetId === playerId;
	const personalityText = personality ? personalityMap[personality] : '';
	const gameHistory = this.buildGameHistory(gameState);
	
	const blockingInfo = action.blockingCharacters?.map(char => {
	  const hasCard = player.cards.includes(char);
	  return `- ${char}${hasCard ? ' (you have this)' : ' (you would be bluffing)'}`;
	}).join('\n') || 'No blocking possible for this action';
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}

GAME STATE:
${gameContext}

GAME HISTORY:
${gameHistory}

YOUR CARDS: ${player.cards.join(', ')}

BLOCK SITUATION:
${actingPlayer.id} is attempting ${action.type}${isTargeted ? ' against you' : ''}.

BLOCKING OPTIONS:
${blockingInfo}

BLOCK RULES:
- You can claim to have a blocking character even if you don't (bluffing)
- If challenged on your block and you don't have the character: you lose a card
- If not challenged, the action is blocked successfully
- Consider: Do you actually have the blocking character? Is it worth the bluff?`;
  }

  static buildCardLossPrompt(gameState: GameState, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
    const isLastCard = player.cards.length === 1;
	const personalityText = personality ? personalityMap[personality] : '';
	const gameHistory = this.buildGameHistory(gameState);
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}

GAME STATE:
${gameContext}

GAME HISTORY:
${gameHistory}

YOUR CARDS: ${player.cards.join(', ')}

CARD LOSS SITUATION:
You must choose one of your cards to lose and discard face-up.${isLastCard ? `

**WARNING: This is your last card! Losing it will eliminate you from the game!**` : ''}

STRATEGY CONSIDERATIONS:
- Which card is least useful for your current strategy?
- Which card would you least want opponents to know you had?
- What future actions do you want to keep available?
- Consider what losing each card reveals about your hand

Choose carefully - this card will be revealed to all players!`;
  }

  static buildExchangePrompt(gameState: GameState, playerId: string, availableCards: CharacterType[], personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const handSize = player.cards.length;
	const personalityText = personality ? personalityMap[personality] : '';
	const gameHistory = this.buildGameHistory(gameState);
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}

GAME STATE:
${gameContext}

GAME HISTORY:
${gameHistory}

EXCHANGE SITUATION:
Your current cards: ${player.cards.join(', ')}
Available options: ${availableCards.join(', ')}

You must choose exactly ${handSize} card(s) to keep. The rest will be shuffled back into the deck.

STRATEGY CONSIDERATIONS:
- What actions do you want to be able to take/claim?
- What would give you the best bluffing opportunities?
- What characters work well together?
- Consider what other players might expect you to have

Choose your new hand wisely!`;
  }

  private static buildGameHistory(gameState: GameState): string {
	return gameState.gameLog.map(event => `[${event.type}] ${event.message}`).join('\n');
  }

  private static buildGameContext(gameState: GameState, currentPlayerId: string): string {
	return gameState.players.map(p => 
	  `${p.id}${p.id === currentPlayerId ? ' (YOU)' : ''}: ${p.coins} coins, ${p.cards.length} cards${p.lostCards.length > 0 ? `, lost: ${p.lostCards.join(', ')}` : ''}`
	).join('\n');
  }
}