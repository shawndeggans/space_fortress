// ============================================================================
// SPACE FORTRESS - Opponent Fleet Generation
// ============================================================================
//
// Generates contextually appropriate enemy fleets based on:
// - Battle context (quest, narrative situation)
// - Difficulty level
// - Player strength (adaptive scaling)
//
// Enemy types:
// - Scavengers: Low-tier opponents, uncoordinated
// - Pirates: Mid-tier, more dangerous
// - Faction fleets: When faction becomes hostile
// ============================================================================

import type { Card, FactionId } from './types'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type OpponentFactionId = FactionId | 'scavengers' | 'pirates'

export interface OpponentFleet {
  name: string
  factionId: OpponentFactionId
  cards: Card[]
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
}

export interface FleetTemplate {
  name: string
  factionId: OpponentFactionId
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  cardPool: CardTemplate[]
}

export interface CardTemplate {
  id: string
  name: string
  attack: number
  armor: number
  agility: number
  weight: number  // Selection weight (higher = more likely)
}

export interface BattleGenerationContext {
  questId: string
  opponentType: string
  difficulty: 'easy' | 'medium' | 'hard'
  playerFleetStrength?: number
}

// ----------------------------------------------------------------------------
// Card Pools
// ----------------------------------------------------------------------------

const SCAVENGER_CARDS: CardTemplate[] = [
  { id: 'scav_rustbucket', name: 'Rustbucket Raider', attack: 2, armor: 2, agility: 3, weight: 3 },
  { id: 'scav_salvage_hauler', name: 'Salvage Hauler', attack: 1, armor: 4, agility: 1, weight: 2 },
  { id: 'scav_dart', name: 'Dart Fighter', attack: 3, armor: 1, agility: 4, weight: 2 },
  { id: 'scav_gunboat', name: 'Scrap Gunboat', attack: 4, armor: 2, agility: 2, weight: 2 },
  { id: 'scav_barge', name: 'Armed Barge', attack: 2, armor: 5, agility: 1, weight: 1 },
  { id: 'scav_interceptor', name: 'Cobbled Interceptor', attack: 3, armor: 2, agility: 3, weight: 2 },
  { id: 'scav_command', name: 'Scavenger Command', attack: 3, armor: 3, agility: 2, weight: 1 },
]

const PIRATE_CARDS: CardTemplate[] = [
  { id: 'pirate_raider', name: 'Pirate Raider', attack: 4, armor: 2, agility: 4, weight: 2 },
  { id: 'pirate_corsair', name: 'Corsair Gunship', attack: 5, armor: 3, agility: 2, weight: 2 },
  { id: 'pirate_interceptor', name: 'Pirate Interceptor', attack: 3, armor: 2, agility: 5, weight: 2 },
  { id: 'pirate_frigate', name: 'Marauder Frigate', attack: 4, armor: 4, agility: 2, weight: 2 },
  { id: 'pirate_flagship', name: 'Pirate Flagship', attack: 5, armor: 5, agility: 1, weight: 1 },
  { id: 'pirate_hunter', name: 'Bounty Hunter', attack: 4, armor: 3, agility: 3, weight: 2 },
  { id: 'pirate_bomber', name: 'Pirate Bomber', attack: 6, armor: 2, agility: 2, weight: 1 },
]

const FACTION_CARDS: Record<FactionId, CardTemplate[]> = {
  ironveil: [
    { id: 'iv_mining_barge', name: 'Mining Barge Retrofit', attack: 5, armor: 4, agility: 1, weight: 2 },
    { id: 'iv_extraction_gun', name: 'Extraction Gunship', attack: 4, armor: 4, agility: 2, weight: 2 },
    { id: 'iv_security_corvette', name: 'Security Corvette', attack: 3, armor: 3, agility: 4, weight: 2 },
    { id: 'iv_heavy_hauler', name: 'Heavy Hauler', attack: 2, armor: 6, agility: 2, weight: 1 },
    { id: 'iv_siege_platform', name: 'Siege Platform', attack: 6, armor: 5, agility: 1, weight: 1 },
  ],
  ashfall: [
    { id: 'af_refugee_runner', name: 'Refugee Runner', attack: 2, armor: 2, agility: 5, weight: 2 },
    { id: 'af_interceptor', name: 'Ashfall Interceptor', attack: 3, armor: 2, agility: 5, weight: 2 },
    { id: 'af_scout', name: 'Remnant Scout', attack: 3, armor: 1, agility: 6, weight: 2 },
    { id: 'af_guardian', name: 'Fleet Guardian', attack: 4, armor: 3, agility: 3, weight: 2 },
    { id: 'af_exodus_ship', name: 'Exodus Ship', attack: 2, armor: 5, agility: 3, weight: 1 },
  ],
  meridian: [
    { id: 'md_broker_vessel', name: 'Broker Vessel', attack: 3, armor: 4, agility: 3, weight: 2 },
    { id: 'md_trade_escort', name: 'Trade Escort', attack: 3, armor: 3, agility: 4, weight: 2 },
    { id: 'md_negotiator', name: 'Negotiator Yacht', attack: 2, armor: 4, agility: 4, weight: 2 },
    { id: 'md_enforcer', name: 'Contract Enforcer', attack: 4, armor: 4, agility: 2, weight: 2 },
    { id: 'md_arbiter', name: 'Arbiter Cruiser', attack: 4, armor: 5, agility: 2, weight: 1 },
  ],
  void_wardens: [
    { id: 'vw_bastion', name: 'Bastion Platform', attack: 1, armor: 7, agility: 2, weight: 2 },
    { id: 'vw_cruiser', name: 'Warden Cruiser', attack: 2, armor: 5, agility: 3, weight: 2 },
    { id: 'vw_patrol', name: 'Patrol Cutter', attack: 3, armor: 4, agility: 3, weight: 2 },
    { id: 'vw_sentinel', name: 'Sentinel Frigate', attack: 2, armor: 6, agility: 2, weight: 2 },
    { id: 'vw_fortress', name: 'Void Fortress', attack: 3, armor: 8, agility: 1, weight: 1 },
  ],
  sundered_oath: [
    { id: 'so_striker', name: 'Oath Striker', attack: 6, armor: 2, agility: 2, weight: 2 },
    { id: 'so_raider', name: 'Broken Raider', attack: 5, armor: 2, agility: 3, weight: 2 },
    { id: 'so_vengeance', name: 'Vengeance Cruiser', attack: 6, armor: 3, agility: 1, weight: 2 },
    { id: 'so_shadow', name: 'Shadow Runner', attack: 4, armor: 1, agility: 5, weight: 2 },
    { id: 'so_dreadnought', name: 'Broken Dreadnought', attack: 7, armor: 4, agility: 1, weight: 1 },
  ],
}

// ----------------------------------------------------------------------------
// Fleet Templates
// ----------------------------------------------------------------------------

const FLEET_TEMPLATES: FleetTemplate[] = [
  // Scavenger fleets
  {
    name: 'Scavenger Patrol',
    factionId: 'scavengers',
    difficulty: 'easy',
    description: 'A ragtag group of scavengers in salvaged ships',
    cardPool: SCAVENGER_CARDS
  },
  {
    name: 'Scavenger Swarm',
    factionId: 'scavengers',
    difficulty: 'medium',
    description: 'A larger scavenger group with some organization',
    cardPool: SCAVENGER_CARDS
  },

  // Pirate fleets
  {
    name: 'Pirate Raiders',
    factionId: 'pirates',
    difficulty: 'medium',
    description: 'Professional pirates with coordinated tactics',
    cardPool: PIRATE_CARDS
  },
  {
    name: 'Pirate Armada',
    factionId: 'pirates',
    difficulty: 'hard',
    description: 'A dangerous pirate fleet with a powerful flagship',
    cardPool: PIRATE_CARDS
  },

  // Faction fleets (when factions become hostile)
  {
    name: 'Ironveil Security Fleet',
    factionId: 'ironveil',
    difficulty: 'hard',
    description: 'Corporate security forces with heavy siege weapons',
    cardPool: FACTION_CARDS.ironveil
  },
  {
    name: 'Ashfall Defense Force',
    factionId: 'ashfall',
    difficulty: 'medium',
    description: 'Fast interceptors protecting refugee convoys',
    cardPool: FACTION_CARDS.ashfall
  },
  {
    name: 'Meridian Enforcers',
    factionId: 'meridian',
    difficulty: 'medium',
    description: 'Contract enforcement vessels',
    cardPool: FACTION_CARDS.meridian
  },
  {
    name: 'Void Warden Patrol',
    factionId: 'void_wardens',
    difficulty: 'hard',
    description: 'Heavily armored patrol vessels',
    cardPool: FACTION_CARDS.void_wardens
  },
  {
    name: 'Sundered Oath Raiders',
    factionId: 'sundered_oath',
    difficulty: 'hard',
    description: 'Devastating glass cannon fleet',
    cardPool: FACTION_CARDS.sundered_oath
  },
]

// ----------------------------------------------------------------------------
// Difficulty Modifiers
// ----------------------------------------------------------------------------

interface DifficultyModifiers {
  statBonus: number
  selectBetterCards: boolean
  forceFlagship: boolean
}

const DIFFICULTY_MODIFIERS: Record<'easy' | 'medium' | 'hard', DifficultyModifiers> = {
  easy: {
    statBonus: -1,
    selectBetterCards: false,
    forceFlagship: false
  },
  medium: {
    statBonus: 0,
    selectBetterCards: false,
    forceFlagship: false
  },
  hard: {
    statBonus: 1,
    selectBetterCards: true,
    forceFlagship: true
  }
}

// ----------------------------------------------------------------------------
// Fleet Generation
// ----------------------------------------------------------------------------

/**
 * Select cards from a pool using weighted random selection
 */
function selectCards(
  pool: CardTemplate[],
  count: number,
  difficulty: 'easy' | 'medium' | 'hard'
): CardTemplate[] {
  const modifiers = DIFFICULTY_MODIFIERS[difficulty]
  const selected: CardTemplate[] = []
  const availablePool = [...pool]

  // For hard difficulty, force at least one low-weight (powerful) card
  if (modifiers.forceFlagship) {
    const flagships = availablePool.filter(c => c.weight === 1)
    if (flagships.length > 0) {
      const flagship = flagships[Math.floor(Math.random() * flagships.length)]
      selected.push(flagship)
      const index = availablePool.findIndex(c => c.id === flagship.id)
      if (index !== -1) availablePool.splice(index, 1)
    }
  }

  // Fill remaining slots
  while (selected.length < count && availablePool.length > 0) {
    let selectedCard: CardTemplate

    if (modifiers.selectBetterCards) {
      // For hard difficulty, prefer lower-weight (rarer/stronger) cards
      availablePool.sort((a, b) => a.weight - b.weight)
      selectedCard = availablePool[Math.floor(Math.random() * Math.min(3, availablePool.length))]
    } else {
      // Normal weighted selection
      const totalWeight = availablePool.reduce((sum, c) => sum + c.weight, 0)
      let random = Math.random() * totalWeight
      selectedCard = availablePool[0]

      for (const card of availablePool) {
        random -= card.weight
        if (random <= 0) {
          selectedCard = card
          break
        }
      }
    }

    selected.push(selectedCard)

    // Allow duplicates but limit to 2 of the same card
    const sameCardCount = selected.filter(c => c.id === selectedCard.id).length
    if (sameCardCount >= 2) {
      const index = availablePool.findIndex(c => c.id === selectedCard.id)
      if (index !== -1) availablePool.splice(index, 1)
    }
  }

  return selected
}

/**
 * Convert card templates to actual Card objects with difficulty modifiers
 */
function templateToCard(
  template: CardTemplate,
  factionId: OpponentFactionId,
  difficulty: 'easy' | 'medium' | 'hard',
  index: number
): Card {
  const modifiers = DIFFICULTY_MODIFIERS[difficulty]

  return {
    id: `${template.id}_${index}`,
    name: template.name,
    faction: factionId as FactionId,  // Type coercion for scavengers/pirates
    attack: Math.max(1, template.attack + modifiers.statBonus),
    armor: Math.max(1, template.armor + modifiers.statBonus),
    agility: Math.max(1, template.agility + modifiers.statBonus),
  }
}

/**
 * Generate an opponent fleet based on context
 */
export function generateOpponentFleet(context: BattleGenerationContext): OpponentFleet {
  const { opponentType, difficulty } = context

  // Find matching template
  let template = FLEET_TEMPLATES.find(
    t => t.factionId === opponentType && t.difficulty === difficulty
  )

  // Fallback to any template with matching opponent type
  if (!template) {
    template = FLEET_TEMPLATES.find(t => t.factionId === opponentType)
  }

  // Final fallback to scavengers
  if (!template) {
    template = FLEET_TEMPLATES.find(t => t.factionId === 'scavengers')!
  }

  // Select 5 cards from the pool
  const selectedTemplates = selectCards(template.cardPool, 5, difficulty)

  // Convert templates to cards
  const cards = selectedTemplates.map((t, i) =>
    templateToCard(t, template!.factionId, difficulty, i)
  )

  return {
    name: template.name,
    factionId: template.factionId,
    cards,
    difficulty,
    description: template.description
  }
}

/**
 * Generate a fleet with adaptive difficulty based on player strength
 */
export function generateAdaptiveFleet(
  context: BattleGenerationContext,
  playerStrength: number
): OpponentFleet {
  // Calculate target strength based on player + difficulty modifier
  const difficultyMultiplier = context.difficulty === 'easy' ? 0.8
    : context.difficulty === 'hard' ? 1.2
    : 1.0

  const targetStrength = playerStrength * difficultyMultiplier

  // Generate base fleet
  const fleet = generateOpponentFleet(context)

  // Calculate current fleet strength
  const currentStrength = fleet.cards.reduce(
    (sum, c) => sum + c.attack + c.armor + c.agility,
    0
  )

  // If fleet is too weak/strong, adjust stats slightly
  const strengthRatio = targetStrength / currentStrength

  if (strengthRatio < 0.85 || strengthRatio > 1.15) {
    const adjustment = strengthRatio > 1 ? 1 : -1
    fleet.cards = fleet.cards.map(card => ({
      ...card,
      attack: Math.max(1, card.attack + adjustment),
      armor: Math.max(1, card.armor + adjustment),
    }))
  }

  return fleet
}

/**
 * Calculate total fleet strength (for adaptive difficulty)
 */
export function calculateFleetStrength(cards: Card[]): number {
  return cards.reduce(
    (sum, c) => sum + c.attack + c.armor + c.agility,
    0
  )
}

/**
 * Get all available fleet templates
 */
export function getFleetTemplates(): FleetTemplate[] {
  return FLEET_TEMPLATES
}

/**
 * Get card pool for a specific opponent type
 */
export function getCardPool(opponentType: OpponentFactionId): CardTemplate[] {
  if (opponentType === 'scavengers') return SCAVENGER_CARDS
  if (opponentType === 'pirates') return PIRATE_CARDS
  return FACTION_CARDS[opponentType] || SCAVENGER_CARDS
}
