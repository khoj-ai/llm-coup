import { GameState } from "./GameState";
import { GameAction, CharacterType } from "./Cards";

export type PlayerStats = {
  id: string;
  name: string;
  model: string;
  winner: boolean;
  elimination_round: number;
  num_bluffs: number;
  successful_bluffs: number;
  failed_bluffs: number;
  challenges_won: number;
  challenges_lost: number;
  coups_launched: number;
  assassinations_blocked: number;
  total_coins_earned: number;
  coins_lost_to_theft: number;
  cause_of_elimination: string[];
  attacks_received: number;
  attacks_launched: number;
};

export abstract class Player {
  constructor(public id: string, public name: string, public model: string) {}
  
  abstract decideAction(gameState: GameState): Promise<GameAction>;
  abstract decideChallengeAction(gameState: GameState, action: GameAction): Promise<{challenge: boolean, discussion?: string}>;
  abstract decideBlockAction(gameState: GameState, action: GameAction): Promise<{block: boolean, character?: CharacterType, discussion?: string}>;
  abstract chooseCardToLose(gameState: GameState): Promise<{card: CharacterType, discussion?: string}>;
  abstract chooseCardsForExchange(gameState: GameState, availableCards: CharacterType[]): Promise<{cards: CharacterType[], discussion?: string}>;
}

