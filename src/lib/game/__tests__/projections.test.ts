import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../events'

// Import projections
import { projectPlayerState } from '../projections/playerState'
import { projectQuestList, projectQuestDetail } from '../projections/questList'
import { projectDilemmaView } from '../projections/dilemmaView'
import { projectCardPoolView } from '../projections/cardPool'
import { projectDeploymentView } from '../projections/deploymentView'
import { projectBattleView, projectBattleResultView } from '../projections/battleView'
import { projectConsequenceView } from '../projections/consequenceView'
import { projectAllianceOptions, projectAllianceTermsView } from '../projections/allianceView'
import { projectMediationView } from '../projections/mediationView'
import { projectReputationDashboard, projectFactionDetailView } from '../projections/reputationView'
import { projectEndingView } from '../projections/endingView'
import { projectChoiceArchaeologyView } from '../projections/choiceArchaeology'

// Helper to create timestamp
function ts(offset = 0): string {
  return new Date(Date.now() + offset).toISOString()
}

// Helper to create basic game start events
function createGameStartEvents(playerId = 'player-1'): GameEvent[] {
  const timestamp = ts()
  return [
    {
      type: 'GAME_STARTED',
      data: { timestamp, playerId, starterCardIds: ['starter_scout', 'starter_freighter', 'starter_corvette'] }
    },
    {
      type: 'PHASE_CHANGED',
      data: { timestamp, fromPhase: 'not_started', toPhase: 'quest_hub' }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp, cardId: 'starter_scout', factionId: 'meridian', source: 'starter', name: 'Scout', attack: 3, armor: 3, agility: 4 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp, cardId: 'starter_freighter', factionId: 'meridian', source: 'starter', name: 'Armed Freighter', attack: 2, armor: 4, agility: 3 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp, cardId: 'starter_corvette', factionId: 'meridian', source: 'starter', name: 'Corvette', attack: 3, armor: 3, agility: 3 }
    },
    {
      type: 'QUESTS_GENERATED',
      data: { timestamp, questIds: ['quest_salvage_claim', 'quest_sanctuary_run', 'quest_brokers_gambit'] }
    }
  ]
}

describe('Player State Projection', () => {
  it('projects initial player state from empty events', () => {
    const view = projectPlayerState([])
    expect(view.gameStatus).toBe('not_started')
    expect(view.currentPhase).toBe('not_started')
    expect(view.bounty).toBe(0)
    expect(view.activeQuest).toBeNull()
  })

  it('projects player state after game start', () => {
    const events = createGameStartEvents()
    const view = projectPlayerState(events)

    expect(view.gameStatus).toBe('in_progress')
    expect(view.currentPhase).toBe('quest_hub')
    expect(view.reputations).toHaveLength(5)
    expect(view.reputations[0].factionId).toBe('ironveil')
    expect(view.reputations[0].value).toBe(0)
  })

  it('projects active quest summary', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: ts(1000),
          questId: 'quest_salvage_claim',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }
    ]
    const view = projectPlayerState(events)

    expect(view.activeQuest).not.toBeNull()
    expect(view.activeQuest?.questId).toBe('quest_salvage_claim')
    expect(view.activeQuest?.title).toBe('The Salvage Claim')
    expect(view.bounty).toBe(500)
  })

  it('tracks reputation changes', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'REPUTATION_CHANGED',
        data: {
          timestamp: ts(1000),
          factionId: 'ironveil',
          delta: 30,
          newValue: 30,
          source: 'choice'
        }
      }
    ]
    const view = projectPlayerState(events)

    const ironveilRep = view.reputations.find(r => r.factionId === 'ironveil')
    expect(ironveilRep?.value).toBe(30)
    expect(ironveilRep?.status).toBe('friendly')
  })
})

describe('Quest List Projection', () => {
  it('projects empty quest list for new game', () => {
    const view = projectQuestList([])
    expect(view.available).toHaveLength(0)
    expect(view.locked).toHaveLength(0)
    expect(view.completed).toHaveLength(0)
    expect(view.hasActiveQuest).toBe(false)
  })

  it('projects available quests after game start', () => {
    const events = createGameStartEvents()
    const view = projectQuestList(events)

    expect(view.available.length).toBeGreaterThan(0)
    expect(view.hasActiveQuest).toBe(false)

    // First quest should be available (no rep required)
    const salvageQuest = view.available.find(q => q.questId === 'quest_salvage_claim')
    expect(salvageQuest).toBeDefined()
    expect(salvageQuest?.status).toBe('available')
  })

  it('tracks quest acceptance', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: ts(1000),
          questId: 'quest_salvage_claim',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }
    ]
    const view = projectQuestList(events)

    expect(view.hasActiveQuest).toBe(true)
    // Quest should be removed from available
    const salvageQuest = view.available.find(q => q.questId === 'quest_salvage_claim')
    expect(salvageQuest).toBeUndefined()
  })
})

describe('Quest Detail Projection', () => {
  it('returns null for unknown quest', () => {
    const events = createGameStartEvents()
    const view = projectQuestDetail(events, 'unknown_quest')
    expect(view).toBeNull()
  })

  it('projects quest detail correctly', () => {
    const events = createGameStartEvents()
    const view = projectQuestDetail(events, 'quest_salvage_claim')

    expect(view).not.toBeNull()
    expect(view?.title).toBe('The Salvage Claim')
    expect(view?.factionId).toBe('ironveil')
    expect(view?.canAccept).toBe(true)
  })
})

describe('Card Pool Projection', () => {
  it('projects empty card pool for new game', () => {
    const view = projectCardPoolView([])
    expect(view.totalCards).toBe(0)
    expect(view.allCards).toHaveLength(0)
    expect(view.isBattleContext).toBe(false)
  })

  it('projects owned cards after game start', () => {
    const events = createGameStartEvents()
    const view = projectCardPoolView(events)

    expect(view.totalCards).toBe(3)  // 3 starter cards
    expect(view.allCards).toHaveLength(3)
    expect(view.cardCountByFaction.meridian).toBe(3)
  })

  it('tracks card selection in battle context', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: ts(1000),
          battleId: 'battle-1',
          questId: 'quest_salvage_claim',
          context: 'Scavenger attack',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers',
          difficulty: 'medium'
        }
      },
      {
        type: 'CARD_SELECTED',
        data: { timestamp: ts(1001), cardId: 'starter_scout', battleId: 'battle-1' }
      }
    ]
    const view = projectCardPoolView(events)

    expect(view.isBattleContext).toBe(true)
    expect(view.selectedCount).toBe(1)
    expect(view.selectedCards).toHaveLength(1)
    expect(view.selectedCards[0].id).toBe('starter_scout')
  })
})

describe('Deployment View Projection', () => {
  it('returns null when no battle is active', () => {
    const events = createGameStartEvents()
    const view = projectDeploymentView(events)
    expect(view).toBeNull()
  })

  it('projects deployment slots correctly', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      // Add more cards so we have 5
      { type: 'CARD_GAINED', data: { timestamp: ts(500), cardId: 'card_4', factionId: 'ironveil', source: 'quest', name: 'Card 4', attack: 4, armor: 3, agility: 3 } },
      { type: 'CARD_GAINED', data: { timestamp: ts(600), cardId: 'card_5', factionId: 'ashfall', source: 'quest', name: 'Card 5', attack: 3, armor: 4, agility: 3 } },
      {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: ts(1000),
          battleId: 'battle-1',
          questId: 'quest_salvage_claim',
          context: 'Scavenger attack',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers',
          difficulty: 'medium'
        }
      },
      { type: 'CARD_SELECTED', data: { timestamp: ts(1001), cardId: 'starter_scout', battleId: 'battle-1' } },
      { type: 'CARD_SELECTED', data: { timestamp: ts(1002), cardId: 'starter_freighter', battleId: 'battle-1' } },
      { type: 'CARD_SELECTED', data: { timestamp: ts(1003), cardId: 'starter_corvette', battleId: 'battle-1' } },
      { type: 'CARD_SELECTED', data: { timestamp: ts(1004), cardId: 'card_4', battleId: 'battle-1' } },
      { type: 'CARD_SELECTED', data: { timestamp: ts(1005), cardId: 'card_5', battleId: 'battle-1' } },
      { type: 'FLEET_COMMITTED', data: { timestamp: ts(1006), battleId: 'battle-1', cardIds: ['starter_scout', 'starter_freighter', 'starter_corvette', 'card_4', 'card_5'] } },
      { type: 'PHASE_CHANGED', data: { timestamp: ts(1007), fromPhase: 'card_selection', toPhase: 'deployment' } }
    ]
    const view = projectDeploymentView(events)

    expect(view).not.toBeNull()
    expect(view?.slots).toHaveLength(5)
    expect(view?.unassignedCards).toHaveLength(5)  // None positioned yet
    expect(view?.canLockOrders).toBe(false)
  })
})

describe('Reputation Dashboard Projection', () => {
  it('projects all factions with initial values', () => {
    const events = createGameStartEvents()
    const view = projectReputationDashboard(events)

    expect(view.factions).toHaveLength(5)
    expect(view.totalCards).toBe(3)
    expect(view.dominantFaction).toBeNull()  // All at 0

    // All factions should be neutral
    for (const faction of view.factions) {
      expect(faction.status).toBe('neutral')
      expect(faction.reputation).toBe(0)
    }
  })

  it('identifies dominant faction', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'REPUTATION_CHANGED',
        data: { timestamp: ts(1000), factionId: 'ironveil', delta: 50, newValue: 50, source: 'choice' }
      }
    ]
    const view = projectReputationDashboard(events)

    expect(view.dominantFaction).toBe('ironveil')
    expect(view.dominantFactionName).toBe('Ironveil Syndicate')
  })

  it('calculates reputation trends', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(1000), factionId: 'ironveil', delta: 10, newValue: 10, source: 'choice' } },
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(2000), factionId: 'ironveil', delta: 10, newValue: 20, source: 'choice' } },
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(3000), factionId: 'ironveil', delta: 10, newValue: 30, source: 'choice' } }
    ]
    const view = projectReputationDashboard(events)

    const ironveil = view.factions.find(f => f.factionId === 'ironveil')
    expect(ironveil?.trend).toBe('rising')
  })
})

describe('Faction Detail Projection', () => {
  it('projects faction detail correctly', () => {
    const events = createGameStartEvents()
    const view = projectFactionDetailView(events, 'ironveil')

    expect(view.factionId).toBe('ironveil')
    expect(view.factionName).toBe('Ironveil Syndicate')
    expect(view.reputation).toBe(0)
    expect(view.status).toBe('neutral')
    expect(view.thresholds).toHaveLength(5)
    expect(view.description).toBeTruthy()
    expect(view.values).toContain('Profit')
  })

  it('tracks reputation history', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(1000), factionId: 'ironveil', delta: 10, newValue: 10, source: 'choice' } },
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(2000), factionId: 'ironveil', delta: 15, newValue: 25, source: 'alliance' } }
    ]
    const view = projectFactionDetailView(events, 'ironveil')

    expect(view.reputationHistory).toHaveLength(2)
    expect(view.reputation).toBe(25)
    expect(view.status).toBe('friendly')
  })
})

describe('Alliance Options Projection', () => {
  it('returns null when no active quest', () => {
    const events = createGameStartEvents()
    const view = projectAllianceOptions(events)
    expect(view).toBeNull()
  })

  it('projects alliance options for active quest', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),  // 3 starter cards
      // Add 2 more cards so player has 5 total (enough to proceed alone)
      { type: 'CARD_GAINED', data: { timestamp: ts(900), cardId: 'extra_card_1', factionId: 'ironveil', source: 'quest', name: 'Extra Card 1', attack: 4, armor: 4, agility: 2 } },
      { type: 'CARD_GAINED', data: { timestamp: ts(950), cardId: 'extra_card_2', factionId: 'ironveil', source: 'quest', name: 'Extra Card 2', attack: 4, armor: 3, agility: 2 } },
      {
        type: 'QUEST_ACCEPTED',
        data: { timestamp: ts(1000), questId: 'quest_salvage_claim', factionId: 'ironveil', initialBounty: 500, initialCardIds: [] }
      }
    ]
    const view = projectAllianceOptions(events)

    expect(view).not.toBeNull()
    expect(view?.options.length).toBeGreaterThan(0)
    expect(view?.canProceedAlone).toBe(true)  // Now true because player has 5 cards
  })
})

describe('Alliance Terms Projection', () => {
  it('projects alliance terms correctly', () => {
    const events = createGameStartEvents()
    const view = projectAllianceTermsView(events, 'void_wardens')

    expect(view).not.toBeNull()
    expect(view?.factionName).toBe('Void Wardens')
    expect(view?.bountyShare).toBe(30)  // 30%
    expect(view?.battleRole).toBe('defender')
    expect(view?.cardsProvided).toHaveLength(2)
  })

  it('marks hostile factions as unavailable', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      { type: 'REPUTATION_CHANGED', data: { timestamp: ts(1000), factionId: 'sundered_oath', delta: -80, newValue: -80, source: 'choice' } }
    ]
    const view = projectAllianceTermsView(events, 'sundered_oath')

    expect(view?.canAccept).toBe(false)
    expect(view?.rejectReason).toBeTruthy()
  })
})

describe('Ending View Projection', () => {
  it('returns null when game not ended', () => {
    const events = createGameStartEvents()
    const view = projectEndingView(events)
    expect(view).toBeNull()
  })

  it('projects ending view correctly', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      { type: 'GAME_END_TRIGGERED', data: { timestamp: ts(10000), questsCompleted: 3, totalPlayTimeSeconds: 3600 } },
      { type: 'ENDING_DETERMINED', data: { timestamp: ts(10001), endingType: 'negotiator', title: 'THE NEGOTIATOR', subtitle: '"Battles end. Agreements endure."' } }
    ]
    const view = projectEndingView(events)

    expect(view).not.toBeNull()
    expect(view?.endingType).toBe('negotiator')
    expect(view?.title).toBe('THE NEGOTIATOR')
    expect(view?.standings).toHaveLength(5)
    expect(view?.showNewGameButton).toBe(true)
  })
})

describe('Choice Archaeology Projection', () => {
  it('projects empty choice history for new game', () => {
    const events = createGameStartEvents()
    const view = projectChoiceArchaeologyView(events)

    expect(view.totalChoices).toBe(0)
    expect(view.allChoices).toHaveLength(0)
    expect(view.questTimelines).toHaveLength(0)
  })

  it('tracks choices made', () => {
    const events: GameEvent[] = [
      ...createGameStartEvents(),
      {
        type: 'QUEST_ACCEPTED',
        data: { timestamp: ts(1000), questId: 'quest_salvage_claim', factionId: 'ironveil', initialBounty: 500, initialCardIds: [] }
      },
      {
        type: 'CHOICE_MADE',
        data: { timestamp: ts(2000), dilemmaId: 'quest_salvage_claim_dilemma_1', choiceId: 'choice_void_wardens', questId: 'quest_salvage_claim' }
      }
    ]
    const view = projectChoiceArchaeologyView(events)

    expect(view.totalChoices).toBe(1)
    expect(view.allChoices).toHaveLength(1)
    expect(view.allChoices[0].choiceId).toBe('choice_void_wardens')
    expect(view.questTimelines).toHaveLength(1)
    expect(view.questTimelines[0].questId).toBe('quest_salvage_claim')
  })
})
