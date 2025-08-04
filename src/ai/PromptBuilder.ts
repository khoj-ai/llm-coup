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
				  enum: ["DUKE", "ASSASSIN", "CAPTAIN", "AMBASSADOR", "CONTESSA"],
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
					enum: ["DUKE", "ASSASSIN", "CAPTAIN", "AMBASSADOR", "CONTESSA"]
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
	
	return `You are playing Coup, a bluffing card game. ${personalityText ? `Your personality: ${personalityText}` : ''}\n\nGAME STATE:\n${gameContext}\n\nYOUR CARDS: ${player.cards.join(', ')}\nYOUR COINS: ${player.coins}\n\nAVAILABLE TARGETS: ${availableTargets}\n\nGAME RULES REMINDER:\n- Income: Take 1 coin (always available)\n- Foreign Aid: Take 2 coins (can be blocked by Duke)\n- Coup: Pay 7 coins to eliminate a player's card (costs 7 coins, cannot be blocked)\n${player.coins >= 10 ? '- You MUST coup if you have 10+ coins!' : ''}\n\nCHARACTER ACTIONS (you can bluff having these):\n- Tax (Duke): Take 3 coins\n- Assassinate (Assassin): Pay 3 coins to force target to lose a card\n- Steal (Captain): Take 2 coins from another player  \n- Exchange (Ambassador): Draw 2 cards, keep your hand size, shuffle rest back\n\nChoose your action wisely considering your cards, coins, and strategy!`;
  }

  static buildChallengePrompt(gameState: GameState, action: GameAction, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const actingPlayer = gameState.players.find(p => p.id === action.playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const personalityText = personality ? personalityMap[personality] : '';
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}\n\nGAME STATE:\n${gameContext}\n\nYOUR CARDS: ${player.cards.join(', ')}\n\nCHALLENGE SITUATION:\n${actingPlayer.id} is attempting to use ${action.type}${action.requiredCharacter ? ` (claiming to have ${action.requiredCharacter})` : ''}.\n\nCHALLENGE RULES:\n- If you challenge and they DON'T have the character: they lose a card\n- If you challenge and they DO have the character: you lose a card, they shuffle and redraw\n- Consider what cards you have (they're less likely to have what you have)\n- Consider what's been revealed/discarded already\n- Think about their previous actions and bluffing patterns\n\nRisk vs Reward: Is it worth the gamble?`;
  }

  static buildBlockPrompt(gameState: GameState, action: GameAction, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const actingPlayer = gameState.players.find(p => p.id === action.playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const isTargeted = action.targetId === playerId;
	const personalityText = personality ? personalityMap[personality] : '';
	
	const blockingInfo = action.blockingCharacters?.map(char => {
	  const hasCard = player.cards.includes(char);
	  return `- ${char}${hasCard ? ' (you have this!)' : ' (you would be bluffing)'}`;
	}).join('\n') || 'No blocking possible for this action';
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}\n\nGAME STATE:\n${gameContext}\n\nYOUR CARDS: ${player.cards.join(', ')}\n\nBLOCK SITUATION:\n${actingPlayer.id} is attempting ${action.type}${isTargeted ? ' against YOU!' : ''}.\n\nBLOCKING OPTIONS:\n${blockingInfo}\n\nBLOCK RULES:\n- You can claim to have a blocking character even if you don't (bluffing)\n- If challenged on your block and you don't have the character: you lose a card\n- If not challenged, the action is blocked successfully\n- Consider: Do you actually have the blocking character? Is it worth the bluff?`;
  }

  static buildCardLossPrompt(gameState: GameState, playerId: string, personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
    const isLastCard = player.cards.length === 1;
	const personalityText = personality ? personalityMap[personality] : '';
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}\n\nGAME STATE:\n${gameContext}\n\nYOUR CARDS: ${player.cards.join(', ')}\n\nCARD LOSS SITUATION:\nYou must choose one of your cards to lose and discard face-up.${isLastCard ? '\n\n**WARNING: This is your last card! Losing it will eliminate you from the game!**' : ''}\n\nSTRATEGY CONSIDERATIONS:\n- Which card is least useful for your current strategy?\n- Which card would you least want opponents to know you had?\n- What future actions do you want to keep available?\n- Consider what losing each card reveals about your hand\n\nChoose carefully - this card will be revealed to all players!`;
  }

  static buildExchangePrompt(gameState: GameState, playerId: string, availableCards: CharacterType[], personality?: Personality): string {
	const player = gameState.players.find(p => p.id === playerId)!;
	const gameContext = this.buildGameContext(gameState, playerId);
	const handSize = player.cards.length;
	const personalityText = personality ? personalityMap[personality] : '';
	
	return `You are playing Coup. ${personalityText ? `Your personality: ${personalityText}` : ''}\n\nGAME STATE:\n${gameContext}\n\nEXCHANGE SITUATION:\nYour current cards: ${player.cards.join(', ')}\nAvailable options: ${availableCards.join(', ')}\n\nYou must choose exactly ${handSize} card(s) to keep. The rest will be shuffled back into the deck.\n\nSTRATEGY CONSIDERATIONS:\n- What actions do you want to be able to take/claim?\n- What would give you the best bluffing opportunities?\n- What characters work well together?\n- Consider what other players might expect you to have\n\nChoose your new hand wisely!`;
  }

  private static buildGameContext(gameState: GameState, currentPlayerId: string): string {
	return gameState.players.map(p => 
	  `${p.id}${p.id === currentPlayerId ? ' (YOU)' : ''}: ${p.coins} coins, ${p.cards.length} cards${p.lostCards.length > 0 ? `, lost: ${p.lostCards.join(', ')}` : ''}`
	).join('\n');
  }
}