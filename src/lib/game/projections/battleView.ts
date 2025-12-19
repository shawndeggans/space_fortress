// ============================================================================
// SPACE FORTRESS - Battle View Projection
// ============================================================================
//
// Projects the battle screen data including:
// - Current round with cards
// - Combat log with rolls
// - Round-by-round results
// - Final battle summary
//
// Used by: Battle screen
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  Card,
  RoundOutcome,
  BattleOutcome,
  CombatRoll
, GameState } from '../types'
import { rebuildState } from '../projections'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface BattleCardView {
  id: string
  name: string
  factionId: FactionId | 'scavengers' | 'pirates'
  factionIcon: string
  attack: number
  defense: number
  agility: number
}

export interface CombatRollView {
  attacker: 'player' | 'opponent'
  attackerName: string
  roll: number  // d20 result
  modifier: number  // attack stat
  total: number
  targetArmor: number
  targetNumber: number  // 10 + armor
  isHit: boolean
}

export interface RoundResultView {
  roundNumber: number
  playerCard: BattleCardView
  opponentCard: BattleCardView
  initiative: 'player' | 'opponent' | 'simultaneous'
  playerRoll: CombatRollView
  opponentRoll: CombatRollView
  outcome: RoundOutcome
  outcomeLabel: string  // "WON", "LOST", "DRAW"
}

export interface BattleViewData {
  // Battle identification
  battleId: string
  battleContext: string
  opponentName: string

  // Current state
  currentRound: number
  totalRounds: number
  phase: 'in_progress' | 'complete'

  // Score tracking
  playerWins: number
  opponentWins: number
  draws: number

  // Current round display (during battle)
  currentRoundView: CurrentRoundView | null

  // All completed rounds
  completedRounds: RoundResultView[]

  // Combat log entries
  combatLog: CombatLogEntry[]
}

export interface CurrentRoundView {
  roundNumber: number
  playerCard: BattleCardView
  opponentCard: BattleCardView
  initiative: 'player' | 'opponent' | 'simultaneous' | null
  initiativeResolved: boolean
  playerRoll: CombatRollView | null
  opponentRoll: CombatRollView | null
  outcome: RoundOutcome | null
  isComplete: boolean
}

export interface CombatLogEntry {
  type: 'initiative' | 'attack' | 'outcome'
  text: string
  isPlayerAction: boolean
  isHit?: boolean
}

export interface BattleResultViewData {
  battleId: string
  battleContext: string
  opponentName: string
  outcome: BattleOutcome
  outcomeLabel: string  // "VICTORY", "DEFEAT", "DRAW"
  playerWins: number
  opponentWins: number
  draws: number
  rounds: RoundResultView[]
  summaryText: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId | 'scavengers' | 'pirates', string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕',
  scavengers: '☠',
  pirates: '⚔'
}

const TOTAL_ROUNDS = 5

// ----------------------------------------------------------------------------
// Projection Functions
// ----------------------------------------------------------------------------

export function projectBattleView(events: GameEvent[], battleId?: string, providedState?: GameState): BattleViewData | null {
  const state = providedState ?? rebuildState(events)

  if (!state.currentBattle) {
    return null
  }

  const battle = state.currentBattle
  const targetBattleId = battleId || battle.battleId

  // Get battle trigger info
  let battleContext = 'Combat engagement'
  let opponentName = 'Enemy Fleet'

  const battleEvent = events.find(
    e => e.type === 'BATTLE_TRIGGERED' && e.data.battleId === targetBattleId
  )
  if (battleEvent && battleEvent.type === 'BATTLE_TRIGGERED') {
    battleContext = battleEvent.data.context
    opponentName = capitalizeFirst(battleEvent.data.opponentType) + ' Fleet'
  }

  // Process round results from state
  const completedRounds: RoundResultView[] = battle.rounds.map(round => ({
    roundNumber: round.roundNumber,
    playerCard: cardToView(round.playerCard),
    opponentCard: cardToView(round.opponentCard),
    initiative: round.initiative,
    playerRoll: {
      attacker: 'player',
      attackerName: round.playerCard.name,
      roll: round.playerRoll.base,
      modifier: round.playerRoll.modifier,
      total: round.playerRoll.total,
      targetArmor: round.opponentCard.defense,
      targetNumber: round.playerRoll.target,
      isHit: round.playerRoll.hit
    },
    opponentRoll: {
      attacker: 'opponent',
      attackerName: round.opponentCard.name,
      roll: round.opponentRoll.base,
      modifier: round.opponentRoll.modifier,
      total: round.opponentRoll.total,
      targetArmor: round.playerCard.defense,
      targetNumber: round.opponentRoll.target,
      isHit: round.opponentRoll.hit
    },
    outcome: round.outcome,
    outcomeLabel: getOutcomeLabel(round.outcome)
  }))

  // Calculate scores
  let playerWins = 0
  let opponentWins = 0
  let draws = 0

  for (const round of completedRounds) {
    if (round.outcome === 'player_won') playerWins++
    else if (round.outcome === 'opponent_won') opponentWins++
    else draws++
  }

  // Build combat log
  const combatLog = buildCombatLog(events, targetBattleId)

  // Determine if battle is complete
  const isComplete = battle.phase === 'resolved' || completedRounds.length >= TOTAL_ROUNDS

  // Build current round view if battle is in progress
  let currentRoundView: CurrentRoundView | null = null
  if (!isComplete && battle.currentRound > 0) {
    // Try to get current round info from events
    currentRoundView = buildCurrentRoundView(events, targetBattleId, battle.currentRound)
  }

  return {
    battleId: targetBattleId,
    battleContext,
    opponentName,
    currentRound: battle.currentRound,
    totalRounds: TOTAL_ROUNDS,
    phase: isComplete ? 'complete' : 'in_progress',
    playerWins,
    opponentWins,
    draws,
    currentRoundView,
    completedRounds,
    combatLog
  }
}

export function projectBattleResultView(events: GameEvent[], battleId?: string, providedState?: GameState): BattleResultViewData | null {
  const battleView = projectBattleView(events, battleId, providedState)
  if (!battleView) return null

  const state = providedState ?? rebuildState(events)
  const battle = state.currentBattle

  // Get final outcome
  let outcome: BattleOutcome = 'draw'
  if (battle?.outcome) {
    outcome = battle.outcome
  } else if (battleView.playerWins > battleView.opponentWins) {
    outcome = 'victory'
  } else if (battleView.opponentWins > battleView.playerWins) {
    outcome = 'defeat'
  }

  const outcomeLabel = outcome === 'victory' ? 'VICTORY'
    : outcome === 'defeat' ? 'DEFEAT'
    : 'DRAW'

  const summaryText = `Final: ${battleView.playerWins} wins, ${battleView.opponentWins} losses, ${battleView.draws} draws`

  return {
    battleId: battleView.battleId,
    battleContext: battleView.battleContext,
    opponentName: battleView.opponentName,
    outcome,
    outcomeLabel,
    playerWins: battleView.playerWins,
    opponentWins: battleView.opponentWins,
    draws: battleView.draws,
    rounds: battleView.completedRounds,
    summaryText
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function cardToView(card: Card): BattleCardView {
  const factionId = card.faction as FactionId | 'scavengers' | 'pirates'
  return {
    id: card.id,
    name: card.name,
    factionId,
    factionIcon: FACTION_ICONS[factionId] || '○',
    attack: card.attack,
    defense: card.defense,
    agility: card.agility
  }
}

function getOutcomeLabel(outcome: RoundOutcome): string {
  switch (outcome) {
    case 'player_won': return 'WON'
    case 'opponent_won': return 'LOST'
    case 'draw': return 'DRAW'
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function buildCombatLog(events: GameEvent[], battleId: string): CombatLogEntry[] {
  const log: CombatLogEntry[] = []

  for (const event of events) {
    if (event.type === 'INITIATIVE_RESOLVED' && event.data.battleId === battleId) {
      const firstStriker = event.data.firstStriker
      let text: string
      if (firstStriker === 'simultaneous') {
        text = `Round ${event.data.roundNumber}: Simultaneous attacks (Agility ${event.data.playerAgility} = ${event.data.opponentAgility})`
      } else if (firstStriker === 'player') {
        text = `Round ${event.data.roundNumber}: You strike first (Agility ${event.data.playerAgility} > ${event.data.opponentAgility})`
      } else {
        text = `Round ${event.data.roundNumber}: Enemy strikes first (Agility ${event.data.opponentAgility} > ${event.data.playerAgility})`
      }
      log.push({ type: 'initiative', text, isPlayerAction: firstStriker === 'player' })
    }

    if (event.type === 'ATTACK_ROLLED' && event.data.battleId === battleId) {
      const isPlayer = event.data.attacker === 'player'
      const hitMiss = event.data.hit ? 'HIT!' : 'MISS!'
      const text = `${isPlayer ? 'You roll' : 'Enemy rolls'}: [${event.data.roll}] + ⚔${event.data.modifier} = ${event.data.total} vs ${event.data.targetNumber} (10 + 🛡${event.data.targetArmor}) — ${hitMiss}`
      log.push({ type: 'attack', text, isPlayerAction: isPlayer, isHit: event.data.hit })
    }

    if (event.type === 'ROUND_RESOLVED' && event.data.battleId === battleId) {
      const outcomeText = event.data.outcome === 'player_won' ? '✓ ROUND WON'
        : event.data.outcome === 'opponent_won' ? '✗ ROUND LOST'
        : '─ ROUND DRAW'
      log.push({ type: 'outcome', text: outcomeText, isPlayerAction: event.data.outcome === 'player_won' })
    }
  }

  return log
}

function buildCurrentRoundView(events: GameEvent[], battleId: string, roundNumber: number): CurrentRoundView | null {
  // Look for CARDS_REVEALED event for this round
  const revealEvent = events.find(
    e => e.type === 'CARDS_REVEALED' &&
         e.data.battleId === battleId &&
         e.data.roundNumber === roundNumber
  )

  if (!revealEvent || revealEvent.type !== 'CARDS_REVEALED') {
    return null
  }

  // Check for initiative
  const initEvent = events.find(
    e => e.type === 'INITIATIVE_RESOLVED' &&
         e.data.battleId === battleId &&
         e.data.roundNumber === roundNumber
  )

  // Check for attack rolls
  const playerAttack = events.find(
    e => e.type === 'ATTACK_ROLLED' &&
         e.data.battleId === battleId &&
         e.data.roundNumber === roundNumber &&
         e.data.attacker === 'player'
  )

  const opponentAttack = events.find(
    e => e.type === 'ATTACK_ROLLED' &&
         e.data.battleId === battleId &&
         e.data.roundNumber === roundNumber &&
         e.data.attacker === 'opponent'
  )

  // Check for round resolution
  const resolveEvent = events.find(
    e => e.type === 'ROUND_RESOLVED' &&
         e.data.battleId === battleId &&
         e.data.roundNumber === roundNumber
  )

  return {
    roundNumber,
    playerCard: cardToView(revealEvent.data.playerCard),
    opponentCard: cardToView(revealEvent.data.opponentCard),
    initiative: initEvent && initEvent.type === 'INITIATIVE_RESOLVED'
      ? initEvent.data.firstStriker
      : null,
    initiativeResolved: !!initEvent,
    playerRoll: playerAttack && playerAttack.type === 'ATTACK_ROLLED' ? {
      attacker: 'player',
      attackerName: revealEvent.data.playerCard.name,
      roll: playerAttack.data.roll,
      modifier: playerAttack.data.modifier,
      total: playerAttack.data.total,
      targetArmor: playerAttack.data.targetArmor,
      targetNumber: playerAttack.data.targetNumber,
      isHit: playerAttack.data.hit
    } : null,
    opponentRoll: opponentAttack && opponentAttack.type === 'ATTACK_ROLLED' ? {
      attacker: 'opponent',
      attackerName: revealEvent.data.opponentCard.name,
      roll: opponentAttack.data.roll,
      modifier: opponentAttack.data.modifier,
      total: opponentAttack.data.total,
      targetArmor: opponentAttack.data.targetArmor,
      targetNumber: opponentAttack.data.targetNumber,
      isHit: opponentAttack.data.hit
    } : null,
    outcome: resolveEvent && resolveEvent.type === 'ROUND_RESOLVED'
      ? resolveEvent.data.outcome
      : null,
    isComplete: !!resolveEvent
  }
}
