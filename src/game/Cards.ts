export enum CharacterType {
  DUKE = 'Duke',
  ASSASSIN = 'Assassin',
  CAPTAIN = 'Captain',
  AMBASSADOR = 'Ambassador',
  CONTESSA = 'Contessa'
}

export interface CharacterCard {
  type: CharacterType;
  abilities: string[];
  blocks: string[];
}

export enum ActionType {
  INCOME = 'INCOME',
  FOREIGN_AID = 'FOREIGN_AID',
  COUP = 'COUP',
  TAX = 'TAX',
  ASSASSINATE = 'ASSASSINATE',
  STEAL = 'STEAL',
  EXCHANGE = 'EXCHANGE',
  BLOCK = 'BLOCK'
}

export interface GameAction {
  type: ActionType;
  playerId: string;
  targetId?: string;
  cost?: number;
  requiredCharacter?: CharacterType;
  canBeBlocked: boolean;
  blockingCharacters?: CharacterType[];
}
