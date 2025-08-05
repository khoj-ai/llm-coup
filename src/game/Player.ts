import { GameState } from "./GameState";
import { GameAction, CharacterType } from "./Cards";

export type PlayerStats = {
  id: string;
  name: string;
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
};

export abstract class Player {
  constructor(public id: string, public name: string) {}
  
  abstract decideAction(gameState: GameState): Promise<GameAction>;
  abstract decideChallengeAction(gameState: GameState, action: GameAction): Promise<boolean>;
  abstract decideBlockAction(gameState: GameState, action: GameAction): Promise<{block: boolean, character?: CharacterType}>;
  abstract chooseCardToLose(gameState: GameState): Promise<CharacterType>;
  abstract chooseCardsForExchange(gameState: GameState, availableCards: CharacterType[]): Promise<CharacterType[]>;
}

