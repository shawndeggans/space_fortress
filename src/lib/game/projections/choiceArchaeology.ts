// ============================================================================
// SPACE FORTRESS - Choice Archaeology View Projection
// ============================================================================
//
// Projects the choice history data including:
// - All choices made during the game
// - Consequences of each choice
// - Quest progression timeline
//
// Used by: Choice History screen (from Ending), Debug/Analytics
// ============================================================================

import type { GameEvent } from '../events'
import type { FactionId , GameState } from '../types'
import { rebuildState } from '../projections'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface ChoiceRecordView {
  // Identification
  questId: string
  questTitle: string
  dilemmaId: string
  choiceId: string
  choiceLabel: string

  // Context
  situation: string
  timestamp: string
  timestampFormatted: string

  // Consequences
  reputationChanges: ReputationChangeRecord[]
  cardsGained: string[]
  cardsLost: string[]
  triggeredBattle: boolean
  triggeredAlliance: boolean
  triggeredMediation: boolean

  // Phase
  questPhase: number  // Which dilemma in the quest (1, 2, 3...)
  wasPostBattle: boolean
}

export interface ReputationChangeRecord {
  factionId: FactionId
  factionIcon: string
  factionName: string
  delta: number
  newValue: number
}

export interface QuestTimelineView {
  questId: string
  questTitle: string
  factionId: FactionId
  factionIcon: string
  factionColor: string
  choices: ChoiceRecordView[]
  outcome: 'full' | 'partial' | 'compromised' | 'failed' | 'in_progress'
  battlesWon: number
  battlesLost: number
}

export interface ChoiceArchaeologyView {
  // Timeline by quest
  questTimelines: QuestTimelineView[]

  // Summary statistics
  totalChoices: number
  combatChoices: number
  diplomaticChoices: number
  betrayalChoices: number

  // Pattern analysis
  dominantPattern: 'combat' | 'diplomatic' | 'balanced' | 'opportunistic'
  patternDescription: string

  // All choices in chronological order
  allChoices: ChoiceRecordView[]
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId, string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕'
}

const FACTION_COLORS: Record<FactionId, string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d'
}

const FACTION_NAMES: Record<FactionId, string> = {
  ironveil: 'Ironveil Syndicate',
  ashfall: 'Ashfall Remnants',
  meridian: 'Meridian Accord',
  void_wardens: 'Void Wardens',
  sundered_oath: 'Sundered Oath'
}

// Quest titles lookup
const QUEST_TITLES: Record<string, string> = {
  quest_salvage_claim: 'The Salvage Claim',
  quest_sanctuary_run: 'The Sanctuary Run',
  quest_brokers_gambit: "The Broker's Gambit"
}

// Placeholder choice labels - will come from content
const CHOICE_LABELS: Record<string, string> = {
  choice_void_wardens: 'Void Wardens Alliance',
  choice_ashfall_secret: 'Ashfall Alliance (secret deal)',
  choice_mercenaries: 'Mercenary Alliance',
  placeholder_choice_a: 'Option A',
  placeholder_choice_b: 'Option B'
}

// Placeholder situations - will come from content
const DILEMMA_SITUATIONS: Record<string, string> = {
  'quest_salvage_claim_dilemma_1': 'You need escort capability to reach the derelict.'
}

// Pattern descriptions
const PATTERN_DESCRIPTIONS: Record<string, string> = {
  combat: 'You favored direct confrontation, letting your fleet speak for you.',
  diplomatic: 'You sought peaceful resolutions whenever possible, preferring negotiation to battle.',
  balanced: 'You adapted to circumstances, choosing combat or diplomacy as the situation demanded.',
  opportunistic: 'You played all sides, forming secret alliances and making pragmatic choices.'
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectChoiceArchaeologyView(events: GameEvent[], providedState?: GameState): ChoiceArchaeologyView {
  const state = providedState ?? rebuildState(events)

  // Get all choice events
  const choiceEvents = events.filter(
    e => e.type === 'CHOICE_MADE' || e.type === 'POST_BATTLE_CHOICE_MADE'
  )

  // Build choice records
  const allChoices: ChoiceRecordView[] = []
  const questChoiceMap = new Map<string, ChoiceRecordView[]>()

  for (const event of choiceEvents) {
    if (event.type !== 'CHOICE_MADE' && event.type !== 'POST_BATTLE_CHOICE_MADE') continue

    const isPostBattle = event.type === 'POST_BATTLE_CHOICE_MADE'
    const questId = isPostBattle ? (state.activeQuest?.questId || '') : (event as Extract<GameEvent, { type: 'CHOICE_MADE' }>).data.questId
    const dilemmaId = event.data.dilemmaId
    const choiceId = event.data.choiceId
    const timestamp = event.data.timestamp

    // Get reputation changes that happened around this choice
    const repChanges = getReputationChangesForChoice(events, timestamp)

    // Get card changes
    const cardChanges = getCardChangesForChoice(events, timestamp)

    // Check what this choice triggered
    const triggeredBattle = didChoiceTriggerBattle(events, timestamp)
    const triggeredAlliance = didChoiceTriggerAlliance(events, timestamp)
    const triggeredMediation = didChoiceTriggerMediation(events, timestamp)

    // Determine quest phase
    const questChoices = questChoiceMap.get(questId) || []
    const questPhase = questChoices.length + 1

    const choiceRecord: ChoiceRecordView = {
      questId,
      questTitle: QUEST_TITLES[questId] || questId,
      dilemmaId,
      choiceId,
      choiceLabel: CHOICE_LABELS[choiceId] || choiceId,
      situation: DILEMMA_SITUATIONS[dilemmaId] || 'A decision was required.',
      timestamp,
      timestampFormatted: formatTimestamp(timestamp),
      reputationChanges: repChanges,
      cardsGained: cardChanges.gained,
      cardsLost: cardChanges.lost,
      triggeredBattle,
      triggeredAlliance,
      triggeredMediation,
      questPhase,
      wasPostBattle: isPostBattle
    }

    allChoices.push(choiceRecord)
    questChoices.push(choiceRecord)
    questChoiceMap.set(questId, questChoices)
  }

  // Build quest timelines
  const questTimelines: QuestTimelineView[] = []

  for (const [questId, choices] of questChoiceMap) {
    // Determine faction from quest ID
    let factionId: FactionId = 'ironveil'
    if (questId.includes('sanctuary')) factionId = 'ashfall'
    if (questId.includes('broker')) factionId = 'meridian'

    // Find quest outcome
    const completed = state.completedQuests.find(q => q.questId === questId)
    let outcome: 'full' | 'partial' | 'compromised' | 'failed' | 'in_progress' = 'in_progress'
    if (completed) {
      outcome = completed.outcome
    }

    // Count battles for this quest
    const questBattles = events.filter(
      e => e.type === 'BATTLE_RESOLVED' &&
           events.some(
             be => be.type === 'BATTLE_TRIGGERED' &&
                   be.data.battleId === (e as Extract<GameEvent, { type: 'BATTLE_RESOLVED' }>).data.battleId &&
                   be.data.questId === questId
           )
    )

    let battlesWon = 0
    let battlesLost = 0
    for (const battle of questBattles) {
      if (battle.type === 'BATTLE_RESOLVED') {
        if (battle.data.outcome === 'victory') battlesWon++
        else if (battle.data.outcome === 'defeat') battlesLost++
      }
    }

    questTimelines.push({
      questId,
      questTitle: QUEST_TITLES[questId] || questId,
      factionId,
      factionIcon: FACTION_ICONS[factionId],
      factionColor: FACTION_COLORS[factionId],
      choices,
      outcome,
      battlesWon,
      battlesLost
    })
  }

  // Calculate statistics
  const totalChoices = allChoices.length
  let combatChoices = 0
  let diplomaticChoices = 0
  let betrayalChoices = 0

  for (const choice of allChoices) {
    if (choice.triggeredBattle) combatChoices++
    if (choice.triggeredMediation) diplomaticChoices++
    if (choice.choiceLabel.toLowerCase().includes('secret')) betrayalChoices++
  }

  // Determine dominant pattern
  let dominantPattern: 'combat' | 'diplomatic' | 'balanced' | 'opportunistic' = 'balanced'
  if (betrayalChoices >= 2 || state.stats.secretAlliancesFormed >= 2) {
    dominantPattern = 'opportunistic'
  } else if (combatChoices > diplomaticChoices * 1.5) {
    dominantPattern = 'combat'
  } else if (diplomaticChoices > combatChoices * 1.5) {
    dominantPattern = 'diplomatic'
  }

  return {
    questTimelines,
    totalChoices,
    combatChoices,
    diplomaticChoices,
    betrayalChoices,
    dominantPattern,
    patternDescription: PATTERN_DESCRIPTIONS[dominantPattern],
    allChoices
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getReputationChangesForChoice(events: GameEvent[], choiceTimestamp: string): ReputationChangeRecord[] {
  // Find reputation changes within 1 second of the choice
  const choiceTime = new Date(choiceTimestamp).getTime()
  const windowMs = 1000

  return events
    .filter((e): e is Extract<GameEvent, { type: 'REPUTATION_CHANGED' }> => {
      if (e.type !== 'REPUTATION_CHANGED') return false
      const eventTime = new Date(e.data.timestamp).getTime()
      return Math.abs(eventTime - choiceTime) <= windowMs
    })
    .map(e => ({
      factionId: e.data.factionId,
      factionIcon: FACTION_ICONS[e.data.factionId],
      factionName: FACTION_NAMES[e.data.factionId],
      delta: e.data.delta,
      newValue: e.data.newValue
    }))
}

function getCardChangesForChoice(events: GameEvent[], choiceTimestamp: string): { gained: string[]; lost: string[] } {
  const choiceTime = new Date(choiceTimestamp).getTime()
  const windowMs = 1000

  const gained: string[] = []
  const lost: string[] = []

  for (const event of events) {
    const eventTime = new Date((event as any).data?.timestamp || '').getTime()
    if (Math.abs(eventTime - choiceTime) > windowMs) continue

    if (event.type === 'CARD_GAINED') {
      gained.push(event.data.cardId)
    } else if (event.type === 'CARD_LOST') {
      lost.push(event.data.cardId)
    }
  }

  return { gained, lost }
}

function didChoiceTriggerBattle(events: GameEvent[], choiceTimestamp: string): boolean {
  const choiceTime = new Date(choiceTimestamp).getTime()
  const windowMs = 1000

  return events.some(e => {
    if (e.type !== 'BATTLE_TRIGGERED') return false
    const eventTime = new Date(e.data.timestamp).getTime()
    return eventTime > choiceTime && eventTime - choiceTime <= windowMs * 5
  })
}

function didChoiceTriggerAlliance(events: GameEvent[], choiceTimestamp: string): boolean {
  const choiceTime = new Date(choiceTimestamp).getTime()
  const windowMs = 1000

  return events.some(e => {
    if (e.type !== 'ALLIANCE_PHASE_STARTED') return false
    const eventTime = new Date(e.data.timestamp).getTime()
    return eventTime > choiceTime && eventTime - choiceTime <= windowMs * 5
  })
}

function didChoiceTriggerMediation(events: GameEvent[], choiceTimestamp: string): boolean {
  const choiceTime = new Date(choiceTimestamp).getTime()
  const windowMs = 1000

  return events.some(e => {
    if (e.type !== 'MEDIATION_STARTED') return false
    const eventTime = new Date(e.data.timestamp).getTime()
    return eventTime > choiceTime && eventTime - choiceTime <= windowMs * 5
  })
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return timestamp
  }
}
