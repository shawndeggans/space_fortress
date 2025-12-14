// ============================================================================
// SPACE FORTRESS - Card (Ship) Database
// ============================================================================

import type { Card, FactionId } from '../types'

// ----------------------------------------------------------------------------
// Ironveil Syndicate - Siege Vessels (High Attack, Medium Armor, Low Agility)
// Profile: Heavy hitters that trade speed for firepower
// ----------------------------------------------------------------------------

const ironveilCards: Card[] = [
  {
    id: 'ironveil_hammerhead',
    name: 'Hammerhead',
    faction: 'ironveil',
    attack: 5,
    armor: 4,
    agility: 2,
    flavorText: 'The collection department\'s preferred negotiation tool.'
  },
  {
    id: 'ironveil_creditor',
    name: 'The Creditor',
    faction: 'ironveil',
    attack: 6,
    armor: 3,
    agility: 2,
    flavorText: 'Payments may be deferred. Interest cannot.'
  },
  {
    id: 'ironveil_ironclad',
    name: 'Ironclad',
    faction: 'ironveil',
    attack: 4,
    armor: 5,
    agility: 2,
    flavorText: 'Built in the foundries of Station Seven. Survived its fall.'
  },
  {
    id: 'ironveil_profit_margin',
    name: 'Profit Margin',
    faction: 'ironveil',
    attack: 5,
    armor: 4,
    agility: 1,
    flavorText: 'Every shot fired is a line item. Every hit is revenue.'
  }
]

// ----------------------------------------------------------------------------
// Ashfall Remnants - Interceptors (Medium Attack, Low Armor, High Agility)
// Profile: Fast strikers that rely on not getting hit
// ----------------------------------------------------------------------------

const ashfallCards: Card[] = [
  {
    id: 'ashfall_phoenix',
    name: 'Phoenix Rising',
    faction: 'ashfall',
    attack: 4,
    armor: 2,
    agility: 5,
    flavorText: 'They burned our homes. We learned to fly through fire.'
  },
  {
    id: 'ashfall_redhawk',
    name: 'Redhawk',
    faction: 'ashfall',
    attack: 4,
    armor: 3,
    agility: 4,
    flavorText: 'Named for Jax Mora\'s first raid. Named for the blood.'
  },
  {
    id: 'ashfall_desperado',
    name: 'Desperado',
    faction: 'ashfall',
    attack: 5,
    armor: 1,
    agility: 5,
    flavorText: 'When you\'ve lost everything, you\'ve got nothing left to lose.'
  },
  {
    id: 'ashfall_ember',
    name: 'Ember',
    faction: 'ashfall',
    attack: 3,
    armor: 3,
    agility: 4,
    flavorText: 'Small fires spread. The Syndicate learned that too late.'
  }
]

// ----------------------------------------------------------------------------
// Meridian Accord - Balanced Traders (Medium Stats Across the Board)
// Profile: Jack of all trades, adaptable to any situation
// ----------------------------------------------------------------------------

const meridianCards: Card[] = [
  {
    id: 'meridian_negotiator',
    name: 'Negotiator',
    faction: 'meridian',
    attack: 4,
    armor: 4,
    agility: 3,
    flavorText: 'Armed neutrality is still neutrality. Just louder.'
  },
  {
    id: 'meridian_broker',
    name: 'Deal Broker',
    faction: 'meridian',
    attack: 3,
    armor: 4,
    agility: 4,
    flavorText: 'The best deals are the ones where both sides feel cheated equally.'
  },
  {
    id: 'meridian_arbiter',
    name: 'Arbiter',
    faction: 'meridian',
    attack: 4,
    armor: 3,
    agility: 4,
    flavorText: 'When diplomacy fails, enforcement begins.'
  },
  {
    id: 'meridian_courier',
    name: 'Swift Courier',
    faction: 'meridian',
    attack: 3,
    armor: 3,
    agility: 5,
    flavorText: 'Information moves at the speed of the fastest ship.'
  }
]

// ----------------------------------------------------------------------------
// Void Wardens - Armored Sentinels (Low Attack, High Armor, Medium Agility)
// Profile: Durable defenders that outlast their opponents
// ----------------------------------------------------------------------------

const voidWardensCards: Card[] = [
  {
    id: 'void_bulwark',
    name: 'Bulwark',
    faction: 'void_wardens',
    attack: 2,
    armor: 6,
    agility: 3,
    flavorText: 'The old codes demand protection. The Bulwark provides it.'
  },
  {
    id: 'void_sentinel',
    name: 'Sentinel',
    faction: 'void_wardens',
    attack: 3,
    armor: 5,
    agility: 3,
    flavorText: 'For three centuries, the beacons have never gone dark.'
  },
  {
    id: 'void_warden_prime',
    name: 'Warden Prime',
    faction: 'void_wardens',
    attack: 3,
    armor: 6,
    agility: 2,
    flavorText: 'First into the black. Last to leave.'
  },
  {
    id: 'void_beacon_keeper',
    name: 'Beacon Keeper',
    faction: 'void_wardens',
    attack: 2,
    armor: 5,
    agility: 4,
    flavorText: 'Every ship that finds safe harbor owes thanks to a Keeper.'
  }
]

// ----------------------------------------------------------------------------
// Sundered Oath - Glass Cannons (Very High Attack, Low Armor, Medium Agility)
// Profile: Devastating offense, hope you kill them before they kill you
// ----------------------------------------------------------------------------

const sunderedOathCards: Card[] = [
  {
    id: 'sundered_oathbreaker',
    name: 'Oathbreaker',
    faction: 'sundered_oath',
    attack: 6,
    armor: 2,
    agility: 3,
    flavorText: 'The only oath I keep is to myself.'
  },
  {
    id: 'sundered_betrayer',
    name: 'Betrayer\'s Edge',
    faction: 'sundered_oath',
    attack: 6,
    armor: 1,
    agility: 4,
    flavorText: 'Trust is a weapon. I aim it at those who gave it.'
  },
  {
    id: 'sundered_exile',
    name: 'Exile',
    faction: 'sundered_oath',
    attack: 5,
    armor: 2,
    agility: 4,
    flavorText: 'Home is wherever hasn\'t caught up with me yet.'
  },
  {
    id: 'sundered_ghost_ship',
    name: 'Ghost Ship',
    faction: 'sundered_oath',
    attack: 5,
    armor: 3,
    agility: 3,
    flavorText: 'No registry. No records. No survivors.'
  }
]

// ----------------------------------------------------------------------------
// Starter Cards - Neutral/Generic vessels for new players
// Profile: Modest but reliable, given to player at game start
// ----------------------------------------------------------------------------

const starterCards: Card[] = [
  {
    id: 'starter_salvager',
    name: 'Salvager',
    faction: 'meridian',  // Neutral-ish faction
    attack: 3,
    armor: 3,
    agility: 3,
    flavorText: 'Every fortune starts with someone else\'s misfortune.'
  },
  {
    id: 'starter_runner',
    name: 'System Runner',
    faction: 'meridian',
    attack: 3,
    armor: 2,
    agility: 4,
    flavorText: 'Fast enough to run. Armed enough to regret it.'
  },
  {
    id: 'starter_freighter',
    name: 'Armed Freighter',
    faction: 'meridian',
    attack: 2,
    armor: 4,
    agility: 3,
    flavorText: 'Pirates expect easy prey. Surprise them.'
  },
  {
    id: 'starter_scout',
    name: 'Scout',
    faction: 'meridian',
    attack: 3,
    armor: 3,
    agility: 4,
    flavorText: 'See everything. Be seen by nothing.'
  }
]

// ----------------------------------------------------------------------------
// Enemy-Only Cards (Scavengers, Pirates)
// These appear as opponents but cannot be acquired by the player
// ----------------------------------------------------------------------------

export const enemyCards: Card[] = [
  // Scavengers - chaotic, unpredictable stats
  {
    id: 'enemy_scav_rustbucket',
    name: 'Rustbucket',
    faction: 'meridian',  // Neutral faction for enemies
    attack: 4,
    armor: 2,
    agility: 3,
    flavorText: 'Held together by spite and salvage tape.'
  },
  {
    id: 'enemy_scav_wrecker',
    name: 'Wrecker',
    faction: 'meridian',
    attack: 5,
    armor: 3,
    agility: 2,
    flavorText: 'Why trade for parts when you can take them?'
  },
  {
    id: 'enemy_scav_vulture',
    name: 'Vulture',
    faction: 'meridian',
    attack: 3,
    armor: 2,
    agility: 4,
    flavorText: 'Where there\'s death, there\'s opportunity.'
  },
  {
    id: 'enemy_scav_junker',
    name: 'Junker',
    faction: 'meridian',
    attack: 4,
    armor: 4,
    agility: 2,
    flavorText: 'One ship\'s trash is another ship\'s firepower.'
  },
  {
    id: 'enemy_scav_rat',
    name: 'Void Rat',
    faction: 'meridian',
    attack: 3,
    armor: 1,
    agility: 5,
    flavorText: 'Too quick to kill, too greedy to ignore.'
  },

  // Pirates - more organized, slightly better ships
  {
    id: 'enemy_pirate_raider',
    name: 'Raider',
    faction: 'meridian',
    attack: 4,
    armor: 3,
    agility: 4,
    flavorText: 'Hit fast, grab what you can, disappear.'
  },
  {
    id: 'enemy_pirate_marauder',
    name: 'Marauder',
    faction: 'meridian',
    attack: 5,
    armor: 4,
    agility: 2,
    flavorText: 'The black market\'s favorite supplier.'
  },
  {
    id: 'enemy_pirate_corsair',
    name: 'Corsair',
    faction: 'meridian',
    attack: 4,
    armor: 2,
    agility: 5,
    flavorText: 'Licensed by no one. Feared by everyone.'
  }
]

// ----------------------------------------------------------------------------
// Combined Card Database
// ----------------------------------------------------------------------------

export const allCards: Card[] = [
  ...ironveilCards,
  ...ashfallCards,
  ...meridianCards,
  ...voidWardensCards,
  ...sunderedOathCards,
  ...starterCards,
  ...enemyCards
]

export const playerAcquirableCards: Card[] = [
  ...ironveilCards,
  ...ashfallCards,
  ...meridianCards,
  ...voidWardensCards,
  ...sunderedOathCards,
  ...starterCards
]

// ----------------------------------------------------------------------------
// Card Lookup Helpers
// ----------------------------------------------------------------------------

/**
 * Get a card by its ID
 */
export function getCardById(cardId: string): Card | undefined {
  return allCards.find(card => card.id === cardId)
}

/**
 * Get all cards for a specific faction
 */
export function getCardsByFaction(factionId: FactionId): Card[] {
  return playerAcquirableCards.filter(card => card.faction === factionId)
}

/**
 * Get the starter deck for a new game
 */
export function getStarterDeck(): Card[] {
  return starterCards
}

/**
 * Get starter card IDs
 */
export function getStarterCardIds(): string[] {
  return starterCards.map(card => card.id)
}

/**
 * Get cards by IDs
 */
export function getCardsByIds(ids: string[]): Card[] {
  return ids.map(id => getCardById(id)).filter((c): c is Card => c !== undefined)
}

/**
 * Generate a scavenger fleet of specified size
 */
export function generateScavengerFleet(size: number): Card[] {
  const scavCards = enemyCards.filter(c => c.id.startsWith('enemy_scav_'))
  const fleet: Card[] = []
  for (let i = 0; i < size; i++) {
    fleet.push(scavCards[Math.floor(Math.random() * scavCards.length)])
  }
  return fleet
}

/**
 * Generate a pirate fleet of specified size
 */
export function generatePirateFleet(size: number): Card[] {
  const pirateCards = enemyCards.filter(c => c.id.startsWith('enemy_pirate_'))
  const fleet: Card[] = []
  for (let i = 0; i < size; i++) {
    fleet.push(pirateCards[Math.floor(Math.random() * pirateCards.length)])
  }
  return fleet
}

/**
 * Calculate average power level of a fleet (for difficulty scaling)
 */
export function calculateFleetPower(cards: Card[]): number {
  if (cards.length === 0) return 0
  const totalStats = cards.reduce((sum, card) =>
    sum + card.attack + card.armor + card.agility, 0)
  return totalStats / cards.length
}

// ----------------------------------------------------------------------------
// Card Stat Summary (for UI display)
// ----------------------------------------------------------------------------

export interface CardStatSummary {
  totalCards: number
  byFaction: Record<FactionId, number>
  averageStats: {
    attack: number
    armor: number
    agility: number
  }
}

export function getCardStatSummary(): CardStatSummary {
  const factionCounts: Record<FactionId, number> = {
    ironveil: 0,
    ashfall: 0,
    meridian: 0,
    void_wardens: 0,
    sundered_oath: 0
  }

  let totalAttack = 0
  let totalArmor = 0
  let totalAgility = 0

  for (const card of playerAcquirableCards) {
    factionCounts[card.faction]++
    totalAttack += card.attack
    totalArmor += card.armor
    totalAgility += card.agility
  }

  const count = playerAcquirableCards.length

  return {
    totalCards: count,
    byFaction: factionCounts,
    averageStats: {
      attack: totalAttack / count,
      armor: totalArmor / count,
      agility: totalAgility / count
    }
  }
}
