import { GameState } from "./GameState";
import { GameAction, CharacterType } from "./Cards";

export abstract class Player {
  constructor(public id: string, public name: string) {}
  
  abstract decideAction(gameState: GameState): Promise<GameAction>;
  abstract decideChallengeAction(gameState: GameState, action: GameAction): Promise<boolean>;
  abstract decideBlockAction(gameState: GameState, action: GameAction): Promise<{block: boolean, character?: CharacterType}>;
  abstract chooseCardToLose(gameState: GameState): Promise<CharacterType>;
  abstract chooseCardsForExchange(gameState: GameState, availableCards: CharacterType[]): Promise<CharacterType[]>;
}
