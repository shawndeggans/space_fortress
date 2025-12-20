// ============================================================================
// SPACE FORTRESS - Projections (Event → State)
// ============================================================================
//
// Projections fold events into state. They are pure functions with no side
// effects. State is always computed by replaying events.
//
// Pattern: (State, Event) → State
// ============================================================================

import type { GameEvent } from './events'
import type {
  GameState,
  FactionId,
  OwnedCard,
  ActiveQuest,
  CompletedQuest,
  BattleState,
  BattleOutcome,
  RoundResult,
  ChoiceHistoryEntry,
  GameStats,
  CardBattleHistory,
  TacticalBattleState,
  CombatantState,
  ShipState,
  EnergyState
} from './types'
import { TACTICAL_BATTLE_CONFIG } from './types'
// getCardById is used to look up abilities (which are not stored in events)
import { getCardById } from './content/cards'

// ----------------------------------------------------------------------------
// Initial State
// ----------------------------------------------------------------------------

export function getInitialState(): GameState {
  return {
    // Identity
    playerId: '',
    gameStatus: 'not_started',
    startedAt: null,

    // Current phase
    currentPhase: 'not_started',

    // Reputation with all factions (start at 0 = neutral)
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },

    // Cards
    ownedCards: [],
    cardHistory: [],

    // Quests
    availableQuestIds: [],
    activeQuest: null,
    completedQuests: [],

    // Current dilemma
    currentDilemmaId: null,

    // Current battle (classic system)
    currentBattle: null,

    // Current tactical battle (turn-based system)
    currentTacticalBattle: null,

    // Current mediation
    currentMediationId: null,
    mediationParties: null,
    hasLeaned: false,
    leanedToward: null,

    // Economy
    bounty: 0,

    // Story flags
    flags: {},

    // Statistics
    stats: getInitialStats(),

    // Choice history
    choiceHistory: [],

    // Pending choice consequence
    pendingChoiceConsequence: null,

    // Pending quest summary
    pendingQuestSummary: null
  }
}

function getInitialStats(): GameStats {
  return {
    questsCompleted: 0,
    questsFailed: 0,
    battlesWon: 0,
    battlesLost: 0,
    battlesDraw: 0,
    battlesAvoided: 0,
    choicesMade: 0,
    alliancesFormed: 0,
    secretAlliancesFormed: 0,
    betrayals: 0,
    totalBountyEarned: 0,
    totalBountyShared: 0,
    totalBountyLost: 0,
    cardsAcquired: 0,
    cardsLost: 0,
    playTimeSeconds: 0
  }
}

// ----------------------------------------------------------------------------
// Tactical Battle Helper Functions
// ----------------------------------------------------------------------------

/**
 * Create initial tactical battle state from TACTICAL_BATTLE_STARTED event data
 */
function createInitialTacticalBattleState(eventData: {
  battleId: string
  questId: string
  context: string
  playerDeckCardIds: string[]
  opponentDeckCardIds: string[]
  opponentName: string
  opponentFactionId: FactionId | 'scavengers' | 'pirates'
  difficulty: 'easy' | 'medium' | 'hard'
  playerFlagshipHull: number
  opponentFlagshipHull: number
  firstPlayer: 'player' | 'opponent'
  initiativeReason: 'agility' | 'tiebreaker'
}): TacticalBattleState {
  const isFirstPlayer = eventData.firstPlayer === 'player'

  // Calculate starting energy (first player gets normal start, second gets bonus)
  const playerStartEnergy = isFirstPlayer
    ? TACTICAL_BATTLE_CONFIG.startingMaxEnergy
    : TACTICAL_BATTLE_CONFIG.startingMaxEnergy + TACTICAL_BATTLE_CONFIG.secondPlayerExtraEnergy

  const opponentStartEnergy = isFirstPlayer
    ? TACTICAL_BATTLE_CONFIG.startingMaxEnergy + TACTICAL_BATTLE_CONFIG.secondPlayerExtraEnergy
    : TACTICAL_BATTLE_CONFIG.startingMaxEnergy

  return {
    battleId: eventData.battleId,
    questId: eventData.questId,
    context: eventData.context,
    phase: 'mulligan',
    turnNumber: 0,
    activePlayer: eventData.firstPlayer,
    roundLimit: TACTICAL_BATTLE_CONFIG.roundLimit,

    player: createInitialCombatantState(
      eventData.playerDeckCardIds,
      eventData.playerFlagshipHull,
      playerStartEnergy
    ),
    opponent: createInitialCombatantState(
      eventData.opponentDeckCardIds,
      eventData.opponentFlagshipHull,
      opponentStartEnergy
    ),

    initiative: {
      firstPlayer: eventData.firstPlayer,
      reason: eventData.initiativeReason,
      playerAgility: 0, // Will be set from actual card calculations
      opponentAgility: 0,
      secondPlayerBonus: {
        extraStartingEnergy: TACTICAL_BATTLE_CONFIG.secondPlayerExtraEnergy,
        emergencyReserves: {
          available: !isFirstPlayer, // Second player gets emergency reserves
          expiresOnTurn: 3,
          energyGrant: 2
        }
      }
    },

    opponentName: eventData.opponentName,
    opponentFactionId: eventData.opponentFactionId,
    difficulty: eventData.difficulty,
    actionsThisTurn: []
  }
}

/**
 * Create initial combatant state for one side of the battle
 */
function createInitialCombatantState(
  deckCardIds: string[],
  flagshipHull: number,
  startingEnergy: number
): CombatantState {
  return {
    flagship: {
      currentHull: flagshipHull,
      maxHull: flagshipHull
    },
    energy: {
      current: startingEnergy,
      maximum: TACTICAL_BATTLE_CONFIG.startingMaxEnergy,
      regeneration: TACTICAL_BATTLE_CONFIG.energyRegeneration
    },
    battlefield: [null, null, null, null, null],
    hand: [],
    deck: [...deckCardIds], // Will be shuffled/drawn via events
    discard: [],
    shipsDestroyedThisTurn: 0,
    cardsPlayedThisTurn: []
  }
}

/**
 * Update energy for a combatant
 */
function updateCombatantEnergy(
  battleState: TacticalBattleState,
  player: 'player' | 'opponent',
  newTotal: number
): TacticalBattleState {
  const combatantKey = player === 'player' ? 'player' : 'opponent'

  return {
    ...battleState,
    [combatantKey]: {
      ...battleState[combatantKey],
      energy: {
        ...battleState[combatantKey].energy,
        current: newTotal
      }
    }
  }
}

/**
 * Deploy a ship from hand to the battlefield
 */
function deployShipToBattlefield(
  battleState: TacticalBattleState,
  player: 'player' | 'opponent',
  cardId: string,
  position: number
): TacticalBattleState {
  const combatantKey = player === 'player' ? 'player' : 'opponent'
  const combatant = battleState[combatantKey]

  // Get card data
  const card = getCardById(cardId)
  if (!card) {
    console.error(`deployShipToBattlefield: Card ${cardId} not found`)
    return battleState
  }

  // Create ship state
  const shipState: ShipState = {
    cardId,
    card,
    position: position as 1 | 2 | 3 | 4 | 5,
    currentHull: card.hull,
    maxHull: card.hull,
    isExhausted: true, // Ships are exhausted when deployed
    statusEffects: [],
    abilityCooldowns: {}
  }

  // Update battlefield
  const newBattlefield = [...combatant.battlefield]
  newBattlefield[position - 1] = shipState

  // Remove card from hand
  const newHand = combatant.hand.filter(id => id !== cardId)

  // Track card played
  const newCardsPlayed = [...combatant.cardsPlayedThisTurn, cardId]

  return {
    ...battleState,
    [combatantKey]: {
      ...combatant,
      battlefield: newBattlefield,
      hand: newHand,
      cardsPlayedThisTurn: newCardsPlayed
    }
  }
}

/**
 * Draw a card from deck to hand
 */
function drawCardToHand(
  battleState: TacticalBattleState,
  player: 'player' | 'opponent',
  cardId: string
): TacticalBattleState {
  const combatantKey = player === 'player' ? 'player' : 'opponent'
  const combatant = battleState[combatantKey]

  return {
    ...battleState,
    [combatantKey]: {
      ...combatant,
      hand: [...combatant.hand, cardId],
      deck: combatant.deck.filter(id => id !== cardId)
    }
  }
}

/**
 * Discard a card from hand
 */
function discardCardFromHand(
  battleState: TacticalBattleState,
  player: 'player' | 'opponent',
  cardId: string
): TacticalBattleState {
  const combatantKey = player === 'player' ? 'player' : 'opponent'
  const combatant = battleState[combatantKey]

  return {
    ...battleState,
    [combatantKey]: {
      ...combatant,
      hand: combatant.hand.filter(id => id !== cardId),
      discard: [...combatant.discard, cardId]
    }
  }
}

/**
 * Apply damage to a target (ship or flagship)
 */
function applyDamageToTarget(
  battleState: TacticalBattleState,
  targetPlayer: 'player' | 'opponent',
  targetId: string,
  newHull: number
): TacticalBattleState {
  const combatantKey = targetPlayer === 'player' ? 'player' : 'opponent'
  const combatant = battleState[combatantKey]

  // Check if target is flagship
  if (targetId === 'flagship') {
    return {
      ...battleState,
      [combatantKey]: {
        ...combatant,
        flagship: {
          ...combatant.flagship,
          currentHull: newHull
        }
      }
    }
  }

  // Target is a ship - find by cardId
  const newBattlefield = combatant.battlefield.map(ship => {
    if (ship && ship.cardId === targetId) {
      return {
        ...ship,
        currentHull: newHull
      }
    }
    return ship
  })

  return {
    ...battleState,
    [combatantKey]: {
      ...combatant,
      battlefield: newBattlefield
    }
  }
}

/**
 * Remove a destroyed ship from the battlefield
 */
function removeShipFromBattlefield(
  battleState: TacticalBattleState,
  owner: 'player' | 'opponent',
  position: number
): TacticalBattleState {
  const combatantKey = owner === 'player' ? 'player' : 'opponent'
  const combatant = battleState[combatantKey]

  // Get the ship being removed
  const ship = combatant.battlefield[position - 1]
  const cardId = ship?.cardId

  // Update battlefield
  const newBattlefield = [...combatant.battlefield]
  newBattlefield[position - 1] = null

  // Add to discard pile if we have the card ID
  const newDiscard = cardId
    ? [...combatant.discard, cardId]
    : combatant.discard

  return {
    ...battleState,
    [combatantKey]: {
      ...combatant,
      battlefield: newBattlefield,
      discard: newDiscard,
      shipsDestroyedThisTurn: combatant.shipsDestroyedThisTurn + 1
    }
  }
}

/**
 * Update flagship hull directly
 */
function updateFlagshipHull(
  battleState: TacticalBattleState,
  player: 'player' | 'opponent',
  newHull: number
): TacticalBattleState {
  const combatantKey = player === 'player' ? 'player' : 'opponent'

  return {
    ...battleState,
    [combatantKey]: {
      ...battleState[combatantKey],
      flagship: {
        ...battleState[combatantKey].flagship,
        currentHull: newHull
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Main Evolve Function
// ----------------------------------------------------------------------------

export function evolveState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    // ========================================================================
    // Game Lifecycle Events
    // ========================================================================

    case 'GAME_STARTED':
      return {
        ...state,
        playerId: event.data.playerId,
        gameStatus: 'in_progress',
        startedAt: event.data.timestamp
      }

    case 'NEW_GAME_STARTED':
      return getInitialState()

    case 'GAME_END_TRIGGERED':
      return {
        ...state,
        gameStatus: 'ended',
        stats: {
          ...state.stats,
          playTimeSeconds: event.data.totalPlayTimeSeconds
        }
      }

    case 'GAME_ENDED':
      return {
        ...state,
        gameStatus: 'ended'
      }

    case 'ENDING_DETERMINED':
      return {
        ...state,
        currentPhase: 'ending'
      }

    // ========================================================================
    // Phase Events
    // ========================================================================

    case 'PHASE_CHANGED':
      return {
        ...state,
        currentPhase: event.data.toPhase
      }

    // ========================================================================
    // Quest Events
    // ========================================================================

    case 'QUESTS_GENERATED':
      return {
        ...state,
        availableQuestIds: event.data.questIds
      }

    case 'QUEST_VIEWED':
      // View-only event, no state change
      return state

    case 'QUEST_ACCEPTED':
      return {
        ...state,
        activeQuest: {
          questId: event.data.questId,
          factionId: event.data.factionId,
          currentDilemmaIndex: 0,
          dilemmasCompleted: 0,
          alliances: [],
          battlesWon: 0,
          battlesLost: 0
        },
        bounty: state.bounty + event.data.initialBounty,
        availableQuestIds: state.availableQuestIds.filter(id => id !== event.data.questId),
        stats: {
          ...state.stats,
          totalBountyEarned: state.stats.totalBountyEarned + event.data.initialBounty
        }
      }

    case 'QUEST_DECLINED':
      // Quest remains available, no state change needed
      return state

    case 'QUEST_COMPLETED':
      return {
        ...state,
        activeQuest: null,
        completedQuests: [
          ...state.completedQuests,
          {
            questId: event.data.questId,
            outcome: event.data.outcome,
            finalBounty: event.data.finalBounty,
            completedAt: event.data.timestamp
          }
        ],
        stats: {
          ...state.stats,
          questsCompleted: state.stats.questsCompleted + 1
        }
      }

    case 'QUEST_FAILED':
      return {
        ...state,
        activeQuest: null,
        stats: {
          ...state.stats,
          questsFailed: state.stats.questsFailed + 1
        }
      }

    // ========================================================================
    // Narrative Events
    // ========================================================================

    case 'DILEMMA_PRESENTED':
      // If we already have a current dilemma and this is a different one,
      // we're advancing to the next dilemma - increment the index
      const isAdvancingToNextDilemma =
        state.currentDilemmaId !== null &&
        state.currentDilemmaId !== event.data.dilemmaId &&
        state.activeQuest !== null

      return {
        ...state,
        currentDilemmaId: event.data.dilemmaId,
        activeQuest: isAdvancingToNextDilemma && state.activeQuest
          ? {
              ...state.activeQuest,
              currentDilemmaIndex: state.activeQuest.currentDilemmaIndex + 1
            }
          : state.activeQuest
      }

    case 'CHOICE_MADE':
      return {
        ...state,
        choiceHistory: [
          ...state.choiceHistory,
          {
            questId: event.data.questId,
            dilemmaId: event.data.dilemmaId,
            choiceId: event.data.choiceId,
            madeAt: event.data.timestamp
          }
        ],
        stats: {
          ...state.stats,
          choicesMade: state.stats.choicesMade + 1
        }
      }

    case 'FLAG_SET':
      return {
        ...state,
        flags: {
          ...state.flags,
          [event.data.flagName]: event.data.value
        }
      }

    // ========================================================================
    // Alliance Events
    // ========================================================================

    case 'ALLIANCE_PHASE_STARTED':
      return state  // Phase change handled by PHASE_CHANGED

    case 'ALLIANCE_TERMS_VIEWED':
      return state  // View-only

    case 'ALLIANCE_FORMED':
      return {
        ...state,
        activeQuest: state.activeQuest ? {
          ...state.activeQuest,
          alliances: [
            ...state.activeQuest.alliances,
            {
              faction: event.data.factionId,
              bountyShare: event.data.bountyShare,
              isSecret: event.data.isSecret
            }
          ]
        } : null,
        stats: {
          ...state.stats,
          alliancesFormed: state.stats.alliancesFormed + 1
        }
      }

    case 'ALLIANCE_REJECTED':
      return state  // No state change

    case 'ALLIANCES_DECLINED':
      return state  // Player proceeds without allies

    case 'SECRET_ALLIANCE_FORMED':
      return {
        ...state,
        activeQuest: state.activeQuest ? {
          ...state.activeQuest,
          alliances: [
            ...state.activeQuest.alliances,
            {
              faction: event.data.factionId,
              bountyShare: 0.15,  // Secret alliances have lower share
              isSecret: true
            }
          ]
        } : null,
        stats: {
          ...state.stats,
          alliancesFormed: state.stats.alliancesFormed + 1,
          secretAlliancesFormed: state.stats.secretAlliancesFormed + 1
        }
      }

    case 'ALLIANCE_DISCOVERED':
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [event.data.discoveredByFactionId]:
            state.reputation[event.data.discoveredByFactionId] - event.data.reputationPenalty
        },
        stats: {
          ...state.stats,
          betrayals: state.stats.betrayals + 1
        }
      }

    // ========================================================================
    // Mediation Events
    // ========================================================================

    case 'MEDIATION_STARTED':
      return {
        ...state,
        currentMediationId: event.data.mediationId,
        mediationParties: event.data.partyFactionIds,
        hasLeaned: false,
        leanedToward: null
      }

    case 'POSITION_VIEWED':
      return state  // View-only

    case 'MEDIATION_LEANED':
      return {
        ...state,
        hasLeaned: true,
        leanedToward: event.data.towardFactionId
      }

    case 'MEDIATION_COLLAPSED':
      return {
        ...state,
        currentMediationId: null,
        mediationParties: null,
        hasLeaned: false,
        leanedToward: null
      }

    case 'COMPROMISE_ACCEPTED':
      return {
        ...state,
        currentMediationId: null,
        mediationParties: null,
        hasLeaned: false,
        leanedToward: null,
        stats: {
          ...state.stats,
          battlesAvoided: state.stats.battlesAvoided + 1
        }
      }

    // ========================================================================
    // Reputation Events
    // ========================================================================

    case 'REPUTATION_CHANGED':
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [event.data.factionId]: event.data.newValue
        }
      }

    case 'REPUTATION_THRESHOLD_CROSSED':
      // Threshold crossing is informational; actual value set by REPUTATION_CHANGED
      return state

    case 'CARDS_UNLOCKED':
      return {
        ...state,
        ownedCards: state.ownedCards.map(card =>
          event.data.cardIds.includes(card.id)
            ? { ...card, isLocked: false, lockReason: undefined }
            : card
        )
      }

    case 'CARDS_LOCKED':
      return {
        ...state,
        ownedCards: state.ownedCards.map(card =>
          event.data.cardIds.includes(card.id)
            ? { ...card, isLocked: true, lockReason: event.data.reason }
            : card
        )
      }

    // ========================================================================
    // Card Events
    // ========================================================================

    case 'CARD_GAINED':
      // Use fat event data directly - no content lookup needed
      // Get abilities from card definition (not stored in event)
      const cardDef = getCardById(event.data.cardId)
      const newCard: OwnedCard = {
        id: event.data.cardId,
        name: event.data.name,
        faction: event.data.factionId,
        attack: event.data.attack,
        defense: event.data.defense,
        hull: event.data.hull,
        agility: event.data.agility,
        energyCost: event.data.energyCost,
        abilities: cardDef?.abilities ?? [],
        source: event.data.source,
        acquiredAt: event.data.timestamp,
        isLocked: false
      }
      return {
        ...state,
        ownedCards: [...state.ownedCards, newCard],
        stats: {
          ...state.stats,
          cardsAcquired: state.stats.cardsAcquired + 1
        }
      }

    case 'CARD_LOST':
      return {
        ...state,
        ownedCards: state.ownedCards.filter(card => card.id !== event.data.cardId),
        stats: {
          ...state.stats,
          cardsLost: state.stats.cardsLost + 1
        }
      }

    // ========================================================================
    // Battle Events
    // ========================================================================

    case 'BATTLE_TRIGGERED':
      return {
        ...state,
        currentBattle: {
          battleId: event.data.battleId,
          questId: event.data.questId,
          phase: 'selection',
          selectedCardIds: [],
          positions: [null, null, null, null, null],
          currentRound: 0,
          rounds: [],
          // Store opponent info for battle execution
          opponentType: event.data.opponentType,
          opponentFactionId: event.data.opponentFactionId,
          difficulty: event.data.difficulty,
          context: event.data.context
        }
      }

    case 'CARD_SELECTED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          selectedCardIds: [...state.currentBattle.selectedCardIds, event.data.cardId]
        }
      }

    case 'CARD_DESELECTED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          selectedCardIds: state.currentBattle.selectedCardIds.filter(id => id !== event.data.cardId)
        }
      }

    case 'FLEET_COMMITTED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          phase: 'deployment',
          selectedCardIds: event.data.cardIds
        }
      }

    case 'CARD_POSITIONED':
      if (!state.currentBattle) return state
      const newPositions = [...state.currentBattle.positions]
      // Remove card from any existing position
      const existingIndex = newPositions.indexOf(event.data.cardId)
      if (existingIndex !== -1) {
        newPositions[existingIndex] = null
      }
      // Place in new position (0-indexed internally, 1-indexed in event)
      newPositions[event.data.position - 1] = event.data.cardId
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          positions: newPositions
        }
      }

    case 'ORDERS_LOCKED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          phase: 'execution'
        }
      }

    case 'BATTLE_STARTED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          currentRound: 0
        }
      }

    case 'ROUND_STARTED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          currentRound: event.data.roundNumber
        }
      }

    case 'CARDS_REVEALED':
      // Card reveal is informational for UI
      return state

    case 'INITIATIVE_RESOLVED':
      // Initiative is informational for UI
      return state

    case 'ATTACK_ROLLED':
      // Attack rolls are informational for UI
      return state

    case 'ROUND_RESOLVED':
      if (!state.currentBattle) return state
      const roundResult: RoundResult = {
        roundNumber: event.data.roundNumber,
        playerCard: event.data.playerCard,
        opponentCard: event.data.opponentCard,
        initiative: 'simultaneous',  // Would come from event
        playerRoll: {
          base: event.data.playerRoll.base,
          modifier: event.data.playerRoll.modifier,
          total: event.data.playerRoll.total,
          target: 10 + event.data.opponentCard.defense,
          hit: event.data.playerRoll.hit
        },
        opponentRoll: {
          base: event.data.opponentRoll.base,
          modifier: event.data.opponentRoll.modifier,
          total: event.data.opponentRoll.total,
          target: 10 + event.data.playerCard.defense,
          hit: event.data.opponentRoll.hit
        },
        outcome: event.data.outcome
      }
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          rounds: [...state.currentBattle.rounds, roundResult]
        }
      }

    case 'BATTLE_RESOLVED':
      if (!state.currentBattle) return state
      return {
        ...state,
        currentBattle: {
          ...state.currentBattle,
          phase: 'resolved',
          outcome: event.data.outcome
        },
        activeQuest: state.activeQuest ? {
          ...state.activeQuest,
          battlesWon: state.activeQuest.battlesWon + (event.data.outcome === 'victory' ? 1 : 0),
          battlesLost: state.activeQuest.battlesLost + (event.data.outcome === 'defeat' ? 1 : 0)
        } : null,
        stats: {
          ...state.stats,
          battlesWon: state.stats.battlesWon + (event.data.outcome === 'victory' ? 1 : 0),
          battlesLost: state.stats.battlesLost + (event.data.outcome === 'defeat' ? 1 : 0),
          battlesDraw: state.stats.battlesDraw + (event.data.outcome === 'draw' ? 1 : 0)
        }
      }

    // ========================================================================
    // Tactical Battle Events (Turn-Based Combat)
    // ========================================================================

    case 'TACTICAL_BATTLE_STARTED':
      return {
        ...state,
        currentPhase: 'tactical_battle',
        currentTacticalBattle: createInitialTacticalBattleState(event.data)
      }

    case 'TACTICAL_TURN_STARTED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: {
          ...state.currentTacticalBattle,
          turnNumber: event.data.turnNumber,
          activePlayer: event.data.activePlayer,
          actionsThisTurn: [],
          player: event.data.activePlayer === 'player'
            ? {
                ...state.currentTacticalBattle.player,
                energy: {
                  ...state.currentTacticalBattle.player.energy,
                  current: event.data.newEnergyTotal
                },
                shipsDestroyedThisTurn: 0,
                cardsPlayedThisTurn: []
              }
            : state.currentTacticalBattle.player,
          opponent: event.data.activePlayer === 'opponent'
            ? {
                ...state.currentTacticalBattle.opponent,
                energy: {
                  ...state.currentTacticalBattle.opponent.energy,
                  current: event.data.newEnergyTotal
                },
                shipsDestroyedThisTurn: 0,
                cardsPlayedThisTurn: []
              }
            : state.currentTacticalBattle.opponent
        }
      }

    case 'TACTICAL_TURN_ENDED':
      // Turn end is mostly a marker - the real work happens in TURN_STARTED
      return state

    case 'ENERGY_GAINED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: updateCombatantEnergy(
          state.currentTacticalBattle,
          event.data.player,
          event.data.newTotal
        )
      }

    case 'ENERGY_SPENT':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: updateCombatantEnergy(
          state.currentTacticalBattle,
          event.data.player,
          event.data.newTotal
        )
      }

    case 'SHIP_DEPLOYED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: deployShipToBattlefield(
          state.currentTacticalBattle,
          event.data.player,
          event.data.cardId,
          event.data.position
        )
      }

    case 'TACTICAL_CARD_DRAWN':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: drawCardToHand(
          state.currentTacticalBattle,
          event.data.player,
          event.data.cardId
        )
      }

    case 'TACTICAL_CARD_DISCARDED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: discardCardFromHand(
          state.currentTacticalBattle,
          event.data.player,
          event.data.cardId
        )
      }

    case 'DAMAGE_DEALT':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: applyDamageToTarget(
          state.currentTacticalBattle,
          event.data.targetPlayer,
          event.data.targetId,
          event.data.targetNewHull
        )
      }

    case 'SHIP_DESTROYED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: removeShipFromBattlefield(
          state.currentTacticalBattle,
          event.data.owner,
          event.data.position
        )
      }

    case 'FLAGSHIP_DAMAGED':
      if (!state.currentTacticalBattle) return state
      return {
        ...state,
        currentTacticalBattle: updateFlagshipHull(
          state.currentTacticalBattle,
          event.data.player,
          event.data.newHull
        )
      }

    case 'TACTICAL_BATTLE_RESOLVED': {
      const outcome: BattleOutcome =
        event.data.winner === 'player' ? 'victory' :
        event.data.winner === 'opponent' ? 'defeat' : 'draw'

      return {
        ...state,
        currentTacticalBattle: state.currentTacticalBattle ? {
          ...state.currentTacticalBattle,
          phase: 'resolved',
          winner: event.data.winner,
          victoryCondition: event.data.victoryCondition
        } : null,
        activeQuest: state.activeQuest ? {
          ...state.activeQuest,
          battlesWon: state.activeQuest.battlesWon + (outcome === 'victory' ? 1 : 0),
          battlesLost: state.activeQuest.battlesLost + (outcome === 'defeat' ? 1 : 0)
        } : null,
        stats: {
          ...state.stats,
          battlesWon: state.stats.battlesWon + (outcome === 'victory' ? 1 : 0),
          battlesLost: state.stats.battlesLost + (outcome === 'defeat' ? 1 : 0),
          battlesDraw: state.stats.battlesDraw + (outcome === 'draw' ? 1 : 0)
        }
      }
    }

    // Other tactical battle events that don't need state changes yet
    case 'MULLIGAN_COMPLETED':
    case 'SHIP_ATTACKED':
    case 'SHIP_MOVED':
    case 'FLAGSHIP_DESTROYED':
    case 'ABILITY_TRIGGERED':
    case 'ABILITY_ACTIVATED':
    case 'STATUS_APPLIED':
    case 'STATUS_EXPIRED':
    case 'STATUS_TRIGGERED':
      // These events are important for the combat log but don't require
      // immediate state changes - the resulting state changes come from
      // their effect events (DAMAGE_DEALT, SHIP_DESTROYED, etc.)
      return state

    // ========================================================================
    // Consequence Events
    // ========================================================================

    case 'BOUNTY_CALCULATED':
      return {
        ...state,
        bounty: state.bounty + event.data.net,
        stats: {
          ...state.stats,
          totalBountyEarned: state.stats.totalBountyEarned + event.data.base,
          totalBountyShared: state.stats.totalBountyShared +
            event.data.shares.reduce((sum, s) => sum + s.amount, 0)
        }
      }

    case 'BOUNTY_SHARED':
      // Already accounted for in BOUNTY_CALCULATED
      return state

    case 'OUTCOME_ACKNOWLEDGED':
      // Validate battle exists before clearing
      if (!state.currentBattle) {
        console.warn('OUTCOME_ACKNOWLEDGED: No current battle to acknowledge')
        return state
      }
      // Validate acknowledgment matches current battle
      if (state.currentBattle.battleId !== event.data.battleId) {
        console.warn('OUTCOME_ACKNOWLEDGED: Mismatch between current battle and acknowledged', {
          current: state.currentBattle.battleId,
          acknowledged: event.data.battleId
        })
      }
      return {
        ...state,
        currentBattle: null
      }

    case 'BOUNTY_MODIFIED':
      return {
        ...state,
        bounty: event.data.newValue,
        stats: {
          ...state.stats,
          totalBountyEarned: event.data.amount > 0
            ? state.stats.totalBountyEarned + event.data.amount
            : state.stats.totalBountyEarned,
          totalBountyLost: event.data.amount < 0
            ? state.stats.totalBountyLost + Math.abs(event.data.amount)
            : state.stats.totalBountyLost
        }
      }

    // ========================================================================
    // Post-Battle Events
    // ========================================================================

    case 'POST_BATTLE_DILEMMA_TRIGGERED':
      return {
        ...state,
        currentDilemmaId: event.data.dilemmaId
      }

    case 'POST_BATTLE_CHOICE_MADE':
      return {
        ...state,
        stats: {
          ...state.stats,
          choicesMade: state.stats.choicesMade + 1
        }
      }

    // ========================================================================
    // Choice Consequence Events
    // ========================================================================

    case 'CHOICE_CONSEQUENCE_PRESENTED':
      // Store the consequence data for the UI to display
      return {
        ...state,
        pendingChoiceConsequence: {
          questId: event.data.questId,
          dilemmaId: event.data.dilemmaId,
          choiceId: event.data.choiceId,
          choiceLabel: event.data.choiceLabel,
          narrativeText: event.data.narrativeText,
          triggersNext: event.data.triggersNext,
          consequences: event.data.consequences
        }
      }

    case 'CHOICE_CONSEQUENCE_ACKNOWLEDGED':
      // Validate pending state exists before clearing
      if (!state.pendingChoiceConsequence) {
        console.warn('CHOICE_CONSEQUENCE_ACKNOWLEDGED: No pending consequence to acknowledge')
        return state
      }
      // Validate acknowledgment matches pending item
      if (state.pendingChoiceConsequence.dilemmaId !== event.data.dilemmaId ||
          state.pendingChoiceConsequence.choiceId !== event.data.choiceId) {
        console.warn('CHOICE_CONSEQUENCE_ACKNOWLEDGED: Mismatch between pending and acknowledged', {
          pending: { dilemmaId: state.pendingChoiceConsequence.dilemmaId, choiceId: state.pendingChoiceConsequence.choiceId },
          acknowledged: { dilemmaId: event.data.dilemmaId, choiceId: event.data.choiceId }
        })
      }
      // Clear the pending consequence
      return {
        ...state,
        pendingChoiceConsequence: null
      }

    // ========================================================================
    // Quest Summary Events
    // ========================================================================

    case 'QUEST_SUMMARY_PRESENTED':
      // Store the quest summary data for the UI to display
      return {
        ...state,
        pendingQuestSummary: {
          questId: event.data.questId,
          questTitle: event.data.questTitle,
          outcome: event.data.outcome
        }
      }

    case 'QUEST_SUMMARY_ACKNOWLEDGED':
      // Validate pending state exists before clearing
      if (!state.pendingQuestSummary) {
        console.warn('QUEST_SUMMARY_ACKNOWLEDGED: No pending quest summary to acknowledge')
        return state
      }
      // Validate acknowledgment matches pending item
      if (state.pendingQuestSummary.questId !== event.data.questId) {
        console.warn('QUEST_SUMMARY_ACKNOWLEDGED: Mismatch between pending and acknowledged', {
          pending: state.pendingQuestSummary.questId,
          acknowledged: event.data.questId
        })
      }
      // Clear the pending quest summary
      return {
        ...state,
        pendingQuestSummary: null
      }

    // ========================================================================
    // Default
    // ========================================================================

    default:
      // Unknown event type - return state unchanged
      return state
  }
}

// ----------------------------------------------------------------------------
// Rebuild State from Events
// ----------------------------------------------------------------------------

export function rebuildState(events: GameEvent[]): GameState {
  return events.reduce(evolveState, getInitialState())
}

// ----------------------------------------------------------------------------
// Utility Projections
// ----------------------------------------------------------------------------

/**
 * Get count of events by type (useful for debugging/analytics)
 */
export function countEventsByType(events: GameEvent[]): Record<string, number> {
  return events.reduce((counts, event) => {
    counts[event.type] = (counts[event.type] || 0) + 1
    return counts
  }, {} as Record<string, number>)
}

/**
 * Get all events of a specific type
 */
export function filterEventsByType<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T
): Extract<GameEvent, { type: T }>[] {
  return events.filter(e => e.type === type) as Extract<GameEvent, { type: T }>[]
}

/**
 * Get the latest event of a specific type
 */
export function getLatestEvent<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T
): Extract<GameEvent, { type: T }> | undefined {
  const filtered = filterEventsByType(events, type)
  return filtered[filtered.length - 1]
}
