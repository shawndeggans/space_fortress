// ============================================================================
// SPACE FORTRESS - Card (Ship) Database
// ============================================================================

import type { Card, FactionId, OwnedCard, CardAbility } from '../types'

// ----------------------------------------------------------------------------
// Card Creation Helpers (for tests and dynamic card generation)
// ----------------------------------------------------------------------------

/**
 * Create a card with default values for all required fields.
 * Useful for tests and dynamic card creation.
 */
export function createCard(overrides: Partial<Card> & { id: string; name: string; faction: FactionId }): Card {
  return {
    attack: 3,
    defense: 2,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [],
    ...overrides
  }
}

/**
 * Create an owned card with default values for all required fields.
 * Useful for tests and dynamic card creation.
 */
export function createOwnedCard(
  overrides: Partial<OwnedCard> & { id: string; name: string; faction: FactionId }
): OwnedCard {
  return {
    attack: 3,
    defense: 2,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [],
    source: 'starter',
    acquiredAt: new Date().toISOString(),
    isLocked: false,
    ...overrides
  }
}

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
    defense: 3,
    hull: 6,
    agility: 2,
    energyCost: 3,
    abilities: [
      {
        id: 'hammerhead_breach',
        name: 'Hull Breach',
        trigger: 'onAttack',
        targetType: 'enemy',
        effect: { type: 'reduce_defense', amount: 1, duration: 2 },
        description: 'Attacking reduces target\'s defense by 1 for 2 turns.'
      }
    ],
    flavorText: 'The collection department\'s preferred negotiation tool.'
  },
  {
    id: 'ironveil_creditor',
    name: 'The Creditor',
    faction: 'ironveil',
    attack: 6,
    defense: 2,
    hull: 5,
    agility: 2,
    energyCost: 3,
    abilities: [
      {
        id: 'creditor_collect',
        name: 'Collect Debt',
        trigger: 'onDestroyed',
        targetType: 'enemy',
        effect: { type: 'deal_damage', amount: 3 },
        description: 'When destroyed, deals 3 damage to a random enemy.'
      }
    ],
    flavorText: 'Payments may be deferred. Interest cannot.'
  },
  {
    id: 'ironveil_ironclad',
    name: 'Ironclad',
    faction: 'ironveil',
    attack: 4,
    defense: 4,
    hull: 7,
    agility: 2,
    energyCost: 3,
    abilities: [
      {
        id: 'ironclad_fortify',
        name: 'Fortify',
        trigger: 'activated',
        energyCost: 1,
        targetType: 'self',
        effect: { type: 'shield', amount: 2, duration: 1 },
        description: 'Spend 1 energy to gain 2 shield for 1 turn.',
        cooldown: 2
      }
    ],
    flavorText: 'Built in the foundries of Station Seven. Survived its fall.'
  },
  {
    id: 'ironveil_profit_margin',
    name: 'Profit Margin',
    faction: 'ironveil',
    attack: 5,
    defense: 3,
    hull: 6,
    agility: 1,
    energyCost: 3,
    abilities: [
      {
        id: 'profit_compound',
        name: 'Compound Interest',
        trigger: 'endTurn',
        targetType: 'self',
        effect: { type: 'boost_attack', amount: 1, duration: 99 },
        description: 'At end of turn, permanently gains +1 attack.'
      }
    ],
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
    defense: 1,
    hull: 4,
    agility: 5,
    energyCost: 2,
    abilities: [
      {
        id: 'phoenix_rebirth',
        name: 'Rebirth',
        trigger: 'onDestroyed',
        targetType: 'self',
        effect: { type: 'repair', amount: 3 },
        description: 'When destroyed, revives with 3 hull (once per battle).'
      }
    ],
    flavorText: 'They burned our homes. We learned to fly through fire.'
  },
  {
    id: 'ashfall_redhawk',
    name: 'Redhawk',
    faction: 'ashfall',
    attack: 4,
    defense: 2,
    hull: 4,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'redhawk_strafe',
        name: 'Strafing Run',
        trigger: 'onAttack',
        targetType: 'adjacent',
        effect: { type: 'area_damage', amount: 1, targets: 'adjacent' },
        description: 'Attacks also deal 1 damage to adjacent enemies.'
      }
    ],
    flavorText: 'Named for Jax Mora\'s first raid. Named for the blood.'
  },
  {
    id: 'ashfall_desperado',
    name: 'Desperado',
    faction: 'ashfall',
    attack: 5,
    defense: 0,
    hull: 3,
    agility: 5,
    energyCost: 2,
    abilities: [
      {
        id: 'desperado_reckless',
        name: 'Reckless Assault',
        trigger: 'passive',
        targetType: 'self',
        effect: {
          type: 'conditional',
          condition: { type: 'hull_below', percentage: 50 },
          effect: { type: 'boost_attack', amount: 2, duration: 99 }
        },
        description: 'When below 50% hull, gains +2 attack.'
      }
    ],
    flavorText: 'When you\'ve lost everything, you\'ve got nothing left to lose.'
  },
  {
    id: 'ashfall_ember',
    name: 'Ember',
    faction: 'ashfall',
    attack: 3,
    defense: 2,
    hull: 4,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'ember_spread',
        name: 'Spreading Flames',
        trigger: 'startTurn',
        targetType: 'all_enemies',
        effect: { type: 'deal_damage', amount: 1 },
        description: 'At start of turn, deals 1 damage to all enemies.'
      }
    ],
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
    defense: 3,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [
      {
        id: 'negotiator_diplomacy',
        name: 'Diplomatic Immunity',
        trigger: 'onDeploy',
        targetType: 'self',
        effect: { type: 'shield', amount: 3, duration: 2 },
        description: 'On deploy, gains 3 shield for 2 turns.'
      }
    ],
    flavorText: 'Armed neutrality is still neutrality. Just louder.'
  },
  {
    id: 'meridian_broker',
    name: 'Deal Broker',
    faction: 'meridian',
    attack: 3,
    defense: 3,
    hull: 5,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'broker_trade',
        name: 'Fair Trade',
        trigger: 'activated',
        energyCost: 1,
        targetType: 'any_card',
        effect: { type: 'draw_card', amount: 1 },
        description: 'Spend 1 energy to draw a card.',
        cooldown: 1
      }
    ],
    flavorText: 'The best deals are the ones where both sides feel cheated equally.'
  },
  {
    id: 'meridian_arbiter',
    name: 'Arbiter',
    faction: 'meridian',
    attack: 4,
    defense: 2,
    hull: 5,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'arbiter_enforce',
        name: 'Enforce Order',
        trigger: 'activated',
        energyCost: 2,
        targetType: 'enemy',
        effect: { type: 'stun', duration: 1 },
        description: 'Spend 2 energy to stun an enemy for 1 turn.',
        cooldown: 2
      }
    ],
    flavorText: 'When diplomacy fails, enforcement begins.'
  },
  {
    id: 'meridian_courier',
    name: 'Swift Courier',
    faction: 'meridian',
    attack: 3,
    defense: 2,
    hull: 4,
    agility: 5,
    energyCost: 1,
    abilities: [
      {
        id: 'courier_swift',
        name: 'Swift Delivery',
        trigger: 'onDeploy',
        targetType: 'self',
        effect: { type: 'draw_card', amount: 1 },
        description: 'On deploy, draw a card.'
      }
    ],
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
    defense: 5,
    hull: 8,
    agility: 3,
    energyCost: 3,
    abilities: [
      {
        id: 'bulwark_protect',
        name: 'Shield Wall',
        trigger: 'passive',
        targetType: 'adjacent',
        effect: { type: 'redirect_damage', to: 'adjacent' },
        description: 'Adjacent allies take 1 less damage from attacks.'
      }
    ],
    flavorText: 'The old codes demand protection. The Bulwark provides it.'
  },
  {
    id: 'void_sentinel',
    name: 'Sentinel',
    faction: 'void_wardens',
    attack: 3,
    defense: 4,
    hull: 7,
    agility: 3,
    energyCost: 3,
    abilities: [
      {
        id: 'sentinel_vigilant',
        name: 'Vigilant Watch',
        trigger: 'onDefend',
        targetType: 'enemy',
        effect: { type: 'deal_damage', amount: 2 },
        description: 'When attacked, deals 2 damage to attacker.'
      }
    ],
    flavorText: 'For three centuries, the beacons have never gone dark.'
  },
  {
    id: 'void_warden_prime',
    name: 'Warden Prime',
    faction: 'void_wardens',
    attack: 3,
    defense: 5,
    hull: 8,
    agility: 2,
    energyCost: 4,
    abilities: [
      {
        id: 'warden_prime_rally',
        name: 'Rally the Fleet',
        trigger: 'activated',
        energyCost: 2,
        targetType: 'all_allies',
        effect: { type: 'repair', amount: 2 },
        description: 'Spend 2 energy to repair all allies for 2 hull.',
        cooldown: 3
      }
    ],
    flavorText: 'First into the black. Last to leave.'
  },
  {
    id: 'void_beacon_keeper',
    name: 'Beacon Keeper',
    faction: 'void_wardens',
    attack: 2,
    defense: 4,
    hull: 6,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'keeper_guidance',
        name: 'Guiding Light',
        trigger: 'startTurn',
        targetType: 'ally',
        effect: { type: 'boost_defense', amount: 1, duration: 1 },
        description: 'At start of turn, grants +1 defense to an ally for 1 turn.'
      }
    ],
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
    defense: 1,
    hull: 4,
    agility: 3,
    energyCost: 3,
    abilities: [
      {
        id: 'oathbreaker_betray',
        name: 'Broken Vow',
        trigger: 'onAttack',
        targetType: 'enemy',
        effect: { type: 'disable_ability', duration: 2 },
        description: 'Attacks disable target\'s abilities for 2 turns.'
      }
    ],
    flavorText: 'The only oath I keep is to myself.'
  },
  {
    id: 'sundered_betrayer',
    name: 'Betrayer\'s Edge',
    faction: 'sundered_oath',
    attack: 6,
    defense: 0,
    hull: 3,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'betrayer_backstab',
        name: 'Backstab',
        trigger: 'onAttack',
        targetType: 'enemy',
        effect: {
          type: 'conditional',
          condition: { type: 'first_card_played' },
          effect: { type: 'deal_damage', amount: 3 }
        },
        description: 'First attack each turn deals +3 extra damage.'
      }
    ],
    flavorText: 'Trust is a weapon. I aim it at those who gave it.'
  },
  {
    id: 'sundered_exile',
    name: 'Exile',
    faction: 'sundered_oath',
    attack: 5,
    defense: 1,
    hull: 4,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'exile_vanish',
        name: 'Vanish',
        trigger: 'activated',
        energyCost: 1,
        targetType: 'self',
        effect: { type: 'return_to_hand', target: 'self' },
        description: 'Spend 1 energy to return to hand (avoiding destruction).',
        cooldown: 1
      }
    ],
    flavorText: 'Home is wherever hasn\'t caught up with me yet.'
  },
  {
    id: 'sundered_ghost_ship',
    name: 'Ghost Ship',
    faction: 'sundered_oath',
    attack: 5,
    defense: 2,
    hull: 5,
    agility: 3,
    energyCost: 3,
    abilities: [
      {
        id: 'ghost_phase',
        name: 'Phase Through',
        trigger: 'onDefend',
        targetType: 'self',
        effect: { type: 'shield', amount: 3, duration: 1 },
        description: 'When attacked, gains 3 shield for 1 turn.'
      }
    ],
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
    defense: 2,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [
      {
        id: 'salvager_scrap',
        name: 'Salvage Parts',
        trigger: 'onDestroyed',
        targetType: 'self',
        effect: { type: 'energy_restore', amount: 1 },
        description: 'When destroyed, restores 1 energy.'
      }
    ],
    flavorText: 'Every fortune starts with someone else\'s misfortune.'
  },
  {
    id: 'starter_runner',
    name: 'System Runner',
    faction: 'meridian',
    attack: 3,
    defense: 1,
    hull: 4,
    agility: 4,
    energyCost: 1,
    abilities: [
      {
        id: 'runner_evade',
        name: 'Evasive Maneuvers',
        trigger: 'onDefend',
        targetType: 'self',
        effect: { type: 'boost_defense', amount: 2, duration: 1 },
        description: 'When attacked, gains +2 defense for this attack.'
      }
    ],
    flavorText: 'Fast enough to run. Armed enough to regret it.'
  },
  {
    id: 'starter_freighter',
    name: 'Armed Freighter',
    faction: 'meridian',
    attack: 2,
    defense: 3,
    hull: 6,
    agility: 3,
    energyCost: 2,
    abilities: [
      {
        id: 'freighter_cargo',
        name: 'Cargo Hold',
        trigger: 'onDeploy',
        targetType: 'self',
        effect: { type: 'draw_card', amount: 1 },
        description: 'On deploy, draw 1 card.'
      }
    ],
    flavorText: 'Pirates expect easy prey. Surprise them.'
  },
  {
    id: 'starter_scout',
    name: 'Scout',
    faction: 'meridian',
    attack: 3,
    defense: 2,
    hull: 4,
    agility: 4,
    energyCost: 1,
    abilities: [
      {
        id: 'scout_recon',
        name: 'Reconnaissance',
        trigger: 'onDeploy',
        targetType: 'enemy',
        effect: { type: 'reduce_defense', amount: 1, duration: 2 },
        description: 'On deploy, reduces one enemy\'s defense by 1 for 2 turns.'
      }
    ],
    flavorText: 'See everything. Be seen by nothing.'
  },
  {
    id: 'starter_corvette',
    name: 'Corvette',
    faction: 'meridian',
    attack: 3,
    defense: 2,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [],  // Basic starter card with no special ability
    flavorText: 'Small but reliable. A captain\'s first command.'
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
    defense: 1,
    hull: 4,
    agility: 3,
    energyCost: 2,
    abilities: [
      {
        id: 'rustbucket_fall_apart',
        name: 'Falling Apart',
        trigger: 'endTurn',
        targetType: 'self',
        effect: { type: 'deal_damage', amount: 1 },
        description: 'Takes 1 damage at end of each turn.'
      }
    ],
    flavorText: 'Held together by spite and salvage tape.'
  },
  {
    id: 'enemy_scav_wrecker',
    name: 'Wrecker',
    faction: 'meridian',
    attack: 5,
    defense: 2,
    hull: 5,
    agility: 2,
    energyCost: 3,
    abilities: [
      {
        id: 'wrecker_salvage',
        name: 'Strip for Parts',
        trigger: 'onAttack',
        targetType: 'enemy',
        effect: { type: 'reduce_defense', amount: 1, duration: 99 },
        description: 'Attacks permanently reduce target defense by 1.'
      }
    ],
    flavorText: 'Why trade for parts when you can take them?'
  },
  {
    id: 'enemy_scav_vulture',
    name: 'Vulture',
    faction: 'meridian',
    attack: 3,
    defense: 1,
    hull: 3,
    agility: 4,
    energyCost: 1,
    abilities: [
      {
        id: 'vulture_feast',
        name: 'Feast on Wreckage',
        trigger: 'passive',
        targetType: 'self',
        effect: {
          type: 'conditional',
          condition: { type: 'card_destroyed_this_turn' },
          effect: { type: 'repair', amount: 2 }
        },
        description: 'When any card is destroyed, repairs 2 hull.'
      }
    ],
    flavorText: 'Where there\'s death, there\'s opportunity.'
  },
  {
    id: 'enemy_scav_junker',
    name: 'Junker',
    faction: 'meridian',
    attack: 4,
    defense: 3,
    hull: 5,
    agility: 2,
    energyCost: 2,
    abilities: [
      {
        id: 'junker_armor',
        name: 'Jury-Rigged Armor',
        trigger: 'onDeploy',
        targetType: 'self',
        effect: { type: 'shield', amount: 2, duration: 2 },
        description: 'On deploy, gains 2 shield for 2 turns.'
      }
    ],
    flavorText: 'One ship\'s trash is another ship\'s firepower.'
  },
  {
    id: 'enemy_scav_rat',
    name: 'Void Rat',
    faction: 'meridian',
    attack: 3,
    defense: 0,
    hull: 2,
    agility: 5,
    energyCost: 1,
    abilities: [
      {
        id: 'rat_scurry',
        name: 'Scurry Away',
        trigger: 'onDefend',
        targetType: 'self',
        effect: { type: 'boost_defense', amount: 3, duration: 1 },
        description: 'When attacked, gains +3 defense for this attack.'
      }
    ],
    flavorText: 'Too quick to kill, too greedy to ignore.'
  },

  // Pirates - more organized, slightly better ships
  {
    id: 'enemy_pirate_raider',
    name: 'Raider',
    faction: 'meridian',
    attack: 4,
    defense: 2,
    hull: 4,
    agility: 4,
    energyCost: 2,
    abilities: [
      {
        id: 'raider_strike',
        name: 'Hit and Run',
        trigger: 'onAttack',
        targetType: 'self',
        effect: { type: 'boost_defense', amount: 2, duration: 1 },
        description: 'After attacking, gains +2 defense until next turn.'
      }
    ],
    flavorText: 'Hit fast, grab what you can, disappear.'
  },
  {
    id: 'enemy_pirate_marauder',
    name: 'Marauder',
    faction: 'meridian',
    attack: 5,
    defense: 3,
    hull: 6,
    agility: 2,
    energyCost: 3,
    abilities: [
      {
        id: 'marauder_intimidate',
        name: 'Intimidate',
        trigger: 'onDeploy',
        targetType: 'all_enemies',
        effect: { type: 'reduce_attack', amount: 1, duration: 2 },
        description: 'On deploy, reduces all enemy attack by 1 for 2 turns.'
      }
    ],
    flavorText: 'The black market\'s favorite supplier.'
  },
  {
    id: 'enemy_pirate_corsair',
    name: 'Corsair',
    faction: 'meridian',
    attack: 4,
    defense: 1,
    hull: 4,
    agility: 5,
    energyCost: 2,
    abilities: [
      {
        id: 'corsair_board',
        name: 'Boarding Action',
        trigger: 'onAttack',
        targetType: 'enemy',
        effect: { type: 'stun', duration: 1 },
        description: 'Attacks stun target for 1 turn.'
      }
    ],
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
 * Get alliance cards for a faction (2 cards per alliance)
 */
export function getAllianceCardsForFaction(factionId: FactionId): Card[] {
  const factionCards = getCardsByFaction(factionId)
  // Return first 2 cards from each faction as alliance cards
  return factionCards.slice(0, 2)
}

/**
 * Get alliance card IDs for a faction
 */
export function getAllianceCardIds(factionId: FactionId): string[] {
  return getAllianceCardsForFaction(factionId).map(c => c.id)
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
    sum + card.attack + card.defense + card.hull + card.agility, 0)
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
    defense: number
    hull: number
    agility: number
    energyCost: number
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
  let totalDefense = 0
  let totalHull = 0
  let totalAgility = 0
  let totalEnergyCost = 0

  for (const card of playerAcquirableCards) {
    factionCounts[card.faction]++
    totalAttack += card.attack
    totalDefense += card.defense
    totalHull += card.hull
    totalAgility += card.agility
    totalEnergyCost += card.energyCost
  }

  const count = playerAcquirableCards.length

  return {
    totalCards: count,
    byFaction: factionCounts,
    averageStats: {
      attack: totalAttack / count,
      defense: totalDefense / count,
      hull: totalHull / count,
      agility: totalAgility / count,
      energyCost: totalEnergyCost / count
    }
  }
}
