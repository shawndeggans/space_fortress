// ============================================================================
// SPACE FORTRESS - Game Commands (Player Intent)
// ============================================================================
//
// Commands represent what the player wants to do. They are validated
// by the decider before generating events.
//
// Naming convention: VERB_NOUN (e.g., ACCEPT_QUEST, SELECT_CARD)
// ============================================================================

import type { FactionId } from './types'

// ----------------------------------------------------------------------------
// Game Lifecycle Commands
// ----------------------------------------------------------------------------

export interface StartGameCommand {
  type: 'START_GAME'
  data: {
    playerId: string
  }
}

export interface StartNewGameCommand {
  type: 'START_NEW_GAME'
  data: {
    playerId: string
  }
}

// ----------------------------------------------------------------------------
// Quest Commands
// ----------------------------------------------------------------------------

export interface ViewQuestDetailsCommand {
  type: 'VIEW_QUEST_DETAILS'
  data: {
    questId: string
  }
}

export interface AcceptQuestCommand {
  type: 'ACCEPT_QUEST'
  data: {
    questId: string
  }
}

export interface DeclineQuestCommand {
  type: 'DECLINE_QUEST'
  data: {
    questId: string
    reason?: string
  }
}

// ----------------------------------------------------------------------------
// Narrative Commands
// ----------------------------------------------------------------------------

export interface MakeChoiceCommand {
  type: 'MAKE_CHOICE'
  data: {
    dilemmaId: string
    choiceId: string
  }
}

export interface MakePostBattleChoiceCommand {
  type: 'MAKE_POST_BATTLE_CHOICE'
  data: {
    dilemmaId: string
    choiceId: string
  }
}

// ----------------------------------------------------------------------------
// Alliance Commands
// ----------------------------------------------------------------------------

export interface ViewAllianceTermsCommand {
  type: 'VIEW_ALLIANCE_TERMS'
  data: {
    factionId: FactionId
  }
}

export interface FormAllianceCommand {
  type: 'FORM_ALLIANCE'
  data: {
    factionId: FactionId
  }
}

export interface RejectAllianceTermsCommand {
  type: 'REJECT_ALLIANCE_TERMS'
  data: {
    factionId: FactionId
  }
}

export interface DeclineAllAlliancesCommand {
  type: 'DECLINE_ALL_ALLIANCES'
  data: {}
}

export interface FinalizeAlliancesCommand {
  type: 'FINALIZE_ALLIANCES'
  data: {}
}

export interface FormSecretAllianceCommand {
  type: 'FORM_SECRET_ALLIANCE'
  data: {
    factionId: FactionId
    publicFactionId?: FactionId
  }
}

// ----------------------------------------------------------------------------
// Mediation Commands
// ----------------------------------------------------------------------------

export interface ViewPositionCommand {
  type: 'VIEW_POSITION'
  data: {
    factionId: FactionId
  }
}

export interface LeanTowardFactionCommand {
  type: 'LEAN_TOWARD_FACTION'
  data: {
    towardFactionId: FactionId
  }
}

export interface RefuseToLeanCommand {
  type: 'REFUSE_TO_LEAN'
  data: {}
}

export interface AcceptCompromiseCommand {
  type: 'ACCEPT_COMPROMISE'
  data: {}
}

// ----------------------------------------------------------------------------
// Battle: Card Selection Commands
// ----------------------------------------------------------------------------

export interface SelectCardCommand {
  type: 'SELECT_CARD'
  data: {
    cardId: string
  }
}

export interface DeselectCardCommand {
  type: 'DESELECT_CARD'
  data: {
    cardId: string
  }
}

export interface CommitFleetCommand {
  type: 'COMMIT_FLEET'
  data: {
    cardIds: string[]
  }
}

// ----------------------------------------------------------------------------
// Battle: Deployment Commands
// ----------------------------------------------------------------------------

export interface SetCardPositionCommand {
  type: 'SET_CARD_POSITION'
  data: {
    cardId: string
    position: number  // 1-5
  }
}

export interface LockOrdersCommand {
  type: 'LOCK_ORDERS'
  data: {}
}

// ----------------------------------------------------------------------------
// Battle: Execution Commands
// ----------------------------------------------------------------------------

export interface ContinueBattleCommand {
  type: 'CONTINUE_BATTLE'
  data: {}
}

// ----------------------------------------------------------------------------
// Consequence Commands
// ----------------------------------------------------------------------------

export interface AcknowledgeOutcomeCommand {
  type: 'ACKNOWLEDGE_OUTCOME'
  data: {}
}

export interface ContinueToNextPhaseCommand {
  type: 'CONTINUE_TO_NEXT_PHASE'
  data: {}
}

// ----------------------------------------------------------------------------
// Information Commands (View-only, may generate VIEW events)
// ----------------------------------------------------------------------------

export interface ViewFactionDetailsCommand {
  type: 'VIEW_FACTION_DETAILS'
  data: {
    factionId: FactionId
  }
}

export interface ViewCardDetailsCommand {
  type: 'VIEW_CARD_DETAILS'
  data: {
    cardId: string
  }
}

export interface ViewChoiceHistoryCommand {
  type: 'VIEW_CHOICE_HISTORY'
  data: {}
}

// ----------------------------------------------------------------------------
// Navigation Commands
// ----------------------------------------------------------------------------

export interface NavigateToScreenCommand {
  type: 'NAVIGATE_TO_SCREEN'
  data: {
    screen: 'quest_hub' | 'reputation' | 'fleet' | 'settings'
  }
}

export interface OpenMenuCommand {
  type: 'OPEN_MENU'
  data: {}
}

export interface CloseMenuCommand {
  type: 'CLOSE_MENU'
  data: {}
}

// ----------------------------------------------------------------------------
// Save/Load Commands
// ----------------------------------------------------------------------------

export interface SaveGameCommand {
  type: 'SAVE_GAME'
  data: {
    saveName: string
  }
}

export interface LoadGameCommand {
  type: 'LOAD_GAME'
  data: {
    saveId: string
  }
}

// ----------------------------------------------------------------------------
// Union Type: All Game Commands
// ----------------------------------------------------------------------------

export type GameCommand =
  // Game Lifecycle
  | StartGameCommand
  | StartNewGameCommand
  // Quest
  | ViewQuestDetailsCommand
  | AcceptQuestCommand
  | DeclineQuestCommand
  // Narrative
  | MakeChoiceCommand
  | MakePostBattleChoiceCommand
  // Alliance
  | ViewAllianceTermsCommand
  | FormAllianceCommand
  | RejectAllianceTermsCommand
  | DeclineAllAlliancesCommand
  | FinalizeAlliancesCommand
  | FormSecretAllianceCommand
  // Mediation
  | ViewPositionCommand
  | LeanTowardFactionCommand
  | RefuseToLeanCommand
  | AcceptCompromiseCommand
  // Battle: Selection
  | SelectCardCommand
  | DeselectCardCommand
  | CommitFleetCommand
  // Battle: Deployment
  | SetCardPositionCommand
  | LockOrdersCommand
  // Battle: Execution
  | ContinueBattleCommand
  // Consequence
  | AcknowledgeOutcomeCommand
  | ContinueToNextPhaseCommand
  // Information
  | ViewFactionDetailsCommand
  | ViewCardDetailsCommand
  | ViewChoiceHistoryCommand
  // Navigation
  | NavigateToScreenCommand
  | OpenMenuCommand
  | CloseMenuCommand
  // Save/Load
  | SaveGameCommand
  | LoadGameCommand

// ----------------------------------------------------------------------------
// Command Type Guards
// ----------------------------------------------------------------------------

export function isQuestCommand(command: GameCommand): boolean {
  return [
    'VIEW_QUEST_DETAILS',
    'ACCEPT_QUEST',
    'DECLINE_QUEST'
  ].includes(command.type)
}

export function isBattleCommand(command: GameCommand): boolean {
  return [
    'SELECT_CARD',
    'DESELECT_CARD',
    'COMMIT_FLEET',
    'SET_CARD_POSITION',
    'LOCK_ORDERS',
    'CONTINUE_BATTLE'
  ].includes(command.type)
}

export function isAllianceCommand(command: GameCommand): boolean {
  return [
    'VIEW_ALLIANCE_TERMS',
    'FORM_ALLIANCE',
    'REJECT_ALLIANCE_TERMS',
    'DECLINE_ALL_ALLIANCES',
    'FINALIZE_ALLIANCES',
    'FORM_SECRET_ALLIANCE'
  ].includes(command.type)
}

export function isMediationCommand(command: GameCommand): boolean {
  return [
    'VIEW_POSITION',
    'LEAN_TOWARD_FACTION',
    'REFUSE_TO_LEAN',
    'ACCEPT_COMPROMISE'
  ].includes(command.type)
}

export function isNavigationCommand(command: GameCommand): boolean {
  return [
    'NAVIGATE_TO_SCREEN',
    'OPEN_MENU',
    'CLOSE_MENU'
  ].includes(command.type)
}

// ----------------------------------------------------------------------------
// Command Factories (for type-safe command creation)
// ----------------------------------------------------------------------------

export const CommandFactory = {
  startGame(playerId: string): StartGameCommand {
    return { type: 'START_GAME', data: { playerId } }
  },

  acceptQuest(questId: string): AcceptQuestCommand {
    return { type: 'ACCEPT_QUEST', data: { questId } }
  },

  declineQuest(questId: string, reason?: string): DeclineQuestCommand {
    return { type: 'DECLINE_QUEST', data: { questId, reason } }
  },

  makeChoice(dilemmaId: string, choiceId: string): MakeChoiceCommand {
    return { type: 'MAKE_CHOICE', data: { dilemmaId, choiceId } }
  },

  formAlliance(factionId: FactionId): FormAllianceCommand {
    return { type: 'FORM_ALLIANCE', data: { factionId } }
  },

  finalizeAlliances(): FinalizeAlliancesCommand {
    return { type: 'FINALIZE_ALLIANCES', data: {} }
  },

  formSecretAlliance(factionId: FactionId, publicFactionId?: FactionId): FormSecretAllianceCommand {
    return { type: 'FORM_SECRET_ALLIANCE', data: { factionId, publicFactionId } }
  },

  selectCard(cardId: string): SelectCardCommand {
    return { type: 'SELECT_CARD', data: { cardId } }
  },

  deselectCard(cardId: string): DeselectCardCommand {
    return { type: 'DESELECT_CARD', data: { cardId } }
  },

  commitFleet(cardIds: string[]): CommitFleetCommand {
    return { type: 'COMMIT_FLEET', data: { cardIds } }
  },

  setCardPosition(cardId: string, position: number): SetCardPositionCommand {
    return { type: 'SET_CARD_POSITION', data: { cardId, position } }
  },

  lockOrders(): LockOrdersCommand {
    return { type: 'LOCK_ORDERS', data: {} }
  },

  leanTowardFaction(towardFactionId: FactionId): LeanTowardFactionCommand {
    return { type: 'LEAN_TOWARD_FACTION', data: { towardFactionId } }
  },

  acknowledgeOutcome(): AcknowledgeOutcomeCommand {
    return { type: 'ACKNOWLEDGE_OUTCOME', data: {} }
  },

  saveGame(saveName: string): SaveGameCommand {
    return { type: 'SAVE_GAME', data: { saveName } }
  },

  loadGame(saveId: string): LoadGameCommand {
    return { type: 'LOAD_GAME', data: { saveId } }
  }
}
