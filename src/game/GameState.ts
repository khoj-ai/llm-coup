import { CharacterType } from "./Cards";
import { GameAction } from "./Cards";

export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  cards: CharacterType[];
  isAlive: boolean;
  lostCards: CharacterType[];
}

export interface GameState {
  players: PlayerState[];
  currentPlayerIndex: number;
  deck: CharacterType[];
  gameLog: GameEvent[];
  phase: GamePhase;
  pendingAction?: PendingAction;
}

export enum GamePhase {
  ACTION = 'action',
  CHALLENGE = 'challenge',
  BLOCK = 'block',
  RESOLVE = 'resolve',
  GAME_OVER = 'game_over'
}

export interface PendingAction {
  action: GameAction;
  challenger?: string;
  blocker?: string;
  resolved: boolean;
}

export interface GameEvent {
    type: string;
    message: string;
}
