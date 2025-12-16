// ============================================================================
// SPACE FORTRESS - Faction Content
// ============================================================================

import type { Faction, FactionId } from '../types'

// ----------------------------------------------------------------------------
// Faction Lore & Data
// ----------------------------------------------------------------------------

export const factions: Record<FactionId, Faction> = {
  ironveil: {
    id: 'ironveil',
    name: 'Ironveil Syndicate',
    icon: '▣',
    color: '#c9a227',
    description: `The Ironveil Syndicate runs the station's industrial sector with
ruthless efficiency. Their mining fleets strip asteroid fields bare while their
contracts bind smaller operators in webs of debt. They believe order comes from
commerce, and commerce requires enforcement.`,
    values: ['Profit', 'Contracts', 'Order'],
    cardProfile: 'Heavy Siege Vessels - High attack, strong armor, slow to maneuver',
    conflictsWith: ['ashfall']
  },

  ashfall: {
    id: 'ashfall',
    name: 'Ashfall Remnants',
    icon: '◈',
    color: '#e85d04',
    description: `Survivors of the Meridian Collapse, the Ashfall Remnants are a
loose confederation of refugees, freedom fighters, and those who refuse to kneel.
They raid corporate shipments and shelter the displaced. Their ships are fast,
jury-rigged, and crewed by those with nothing left to lose.`,
    values: ['Freedom', 'Survival', 'Defiance'],
    cardProfile: 'Swift Interceptors - High agility, moderate attack, fragile hulls',
    conflictsWith: ['ironveil']
  },

  meridian: {
    id: 'meridian',
    name: 'Meridian Accord',
    icon: '⬡',
    color: '#00b4d8',
    description: `The Meridian Accord represents the station's diplomatic corps and
trading guilds. They profit from negotiation rather than conquest, brokering deals
between factions who would otherwise be at each other's throats. Their neutrality
is both their shield and their product.`,
    values: ['Diplomacy', 'Balance', 'Information'],
    cardProfile: 'Balanced Traders - Moderate stats across the board, adaptable',
    conflictsWith: []
  },

  void_wardens: {
    id: 'void_wardens',
    name: 'Void Wardens',
    icon: '⛊',
    color: '#7209b7',
    description: `The Void Wardens patrol the outer reaches where station law means
nothing. They enforce an older code - salvage rights, beacon protocols, the unwritten
laws that keep the black from swallowing everything. Their heavily armored ships
can take a beating that would crack lesser vessels.`,
    values: ['Duty', 'Tradition', 'Protection'],
    cardProfile: 'Armored Sentinels - Exceptional armor, low attack, steady agility',
    conflictsWith: ['sundered_oath']
  },

  sundered_oath: {
    id: 'sundered_oath',
    name: 'Sundered Oath',
    icon: '✕',
    color: '#6c757d',
    description: `Betrayers. Oathbreakers. The Sundered are those who broke their
bonds - to faction, to family, to cause. They fight for nothing but themselves,
and their ships reflect this: stripped of everything except weapons. They hit
hard and fade into the dark.`,
    values: ['Self-Interest', 'Pragmatism', 'Survival'],
    cardProfile: 'Glass Cannons - Devastating attack, minimal defense, unpredictable',
    conflictsWith: ['void_wardens']
  }
}

// ----------------------------------------------------------------------------
// Faction NPCs (Key Representatives)
// ----------------------------------------------------------------------------

export interface FactionNpc {
  id: string
  name: string
  faction: FactionId | 'crew' | 'neutral'
  title: string
  portrait: string  // Placeholder emoji for MVP
  personality: string
  defaultDialogue: string
}

export const factionNpcs: FactionNpc[] = [
  // Ironveil
  {
    id: 'npc_kira_voss',
    name: 'Kira Voss',
    faction: 'ironveil',
    title: 'Contract Enforcer',
    portrait: '👤',
    personality: 'Cold, calculating, respects efficiency and those who deliver',
    defaultDialogue: 'Every credit spent is an investment. Every debt collected is a return.'
  },
  {
    id: 'npc_director_chen',
    name: 'Director Chen',
    faction: 'ironveil',
    title: 'Mining Operations Director',
    portrait: '🧑‍💼',
    personality: 'Impatient, bottom-line focused, secretly respects boldness',
    defaultDialogue: 'I don\'t pay for explanations. I pay for results.'
  },

  // Ashfall
  {
    id: 'npc_jax_redhawk',
    name: 'Jax "Redhawk" Mora',
    faction: 'ashfall',
    title: 'Raid Captain',
    portrait: '🦅',
    personality: 'Passionate, protective of refugees, distrusts authority',
    defaultDialogue: 'The corps call us pirates. We call it wealth redistribution.'
  },
  {
    id: 'npc_elder_nomi',
    name: 'Elder Nomi',
    faction: 'ashfall',
    title: 'Refugee Council Speaker',
    portrait: '👵',
    personality: 'Wise, weary, remembers what was lost in the Collapse',
    defaultDialogue: 'We remember the stations that burned. We will not let that happen again.'
  },

  // Meridian
  {
    id: 'npc_soren_vale',
    name: 'Soren Vale',
    faction: 'meridian',
    title: 'Licensed Broker',
    portrait: '🎭',
    personality: 'Charming, always calculating angles, truly neutral',
    defaultDialogue: 'Information is currency. I deal in both.'
  },
  {
    id: 'npc_magistrate_yun',
    name: 'Magistrate Yun',
    faction: 'meridian',
    title: 'Arbitration Court',
    portrait: '⚖️',
    personality: 'Fair, formal, believes deeply in process',
    defaultDialogue: 'All disputes can be resolved. The question is: at what price?'
  },

  // Void Wardens
  {
    id: 'npc_captain_thresh',
    name: 'Captain Thresh',
    faction: 'void_wardens',
    title: 'Patrol Commander',
    portrait: '🛡️',
    personality: 'Stoic, honorable, follows the old codes without question',
    defaultDialogue: 'The void has laws older than any faction. We enforce them.'
  },
  {
    id: 'npc_keeper_ash',
    name: 'Keeper Ash',
    faction: 'void_wardens',
    title: 'Beacon Master',
    portrait: '🔆',
    personality: 'Mysterious, speaks in riddles, sees patterns others miss',
    defaultDialogue: 'The beacons remember. Listen, and they will guide you.'
  },

  // Sundered Oath
  {
    id: 'npc_ghost',
    name: '"Ghost"',
    faction: 'sundered_oath',
    title: 'Information Dealer',
    portrait: '👻',
    personality: 'Paranoid, opportunistic, genuinely helpful if paid',
    defaultDialogue: 'Names are chains. I cut mine loose long ago.'
  },
  {
    id: 'npc_razor',
    name: 'Razor',
    faction: 'sundered_oath',
    title: 'Mercenary Captain',
    portrait: '🗡️',
    personality: 'Direct, violent, surprisingly honorable about contracts',
    defaultDialogue: 'I don\'t do loyalty. But I do finish jobs.'
  },

  // Player Crew
  {
    id: 'npc_first_mate',
    name: 'First Mate Torres',
    faction: 'crew',
    title: 'Second in Command',
    portrait: '⭐',
    personality: 'Loyal, practical, voice of caution',
    defaultDialogue: 'Captain, we should think this through before committing.'
  },
  {
    id: 'npc_engineer',
    name: 'Chief Engineer Kai',
    faction: 'crew',
    title: 'Ship Systems',
    portrait: '🔧',
    personality: 'Gruff, technically brilliant, dislikes politics',
    defaultDialogue: 'I keep the ship running. Don\'t make me regret it.'
  },

  // Neutral
  {
    id: 'npc_station_ai',
    name: 'ARIA',
    faction: 'neutral',
    title: 'Station AI Fragment',
    portrait: '🤖',
    personality: 'Helpful, slightly corrupted, remembers fragments of old conflicts',
    defaultDialogue: 'Accessing records... some data has been [REDACTED].'
  }
]

// ----------------------------------------------------------------------------
// Faction Relationship Helpers
// ----------------------------------------------------------------------------

/**
 * Check if two factions are in conflict
 */
export function areFactionsInConflict(a: FactionId, b: FactionId): boolean {
  return factions[a].conflictsWith.includes(b) || factions[b].conflictsWith.includes(a)
}

/**
 * Get the reputation change when helping one faction against another
 */
export function getConflictReputationEffect(
  helpedFaction: FactionId,
  againstFaction: FactionId
): number {
  if (areFactionsInConflict(helpedFaction, againstFaction)) {
    return -15  // Larger penalty for helping direct enemies
  }
  return -5  // Smaller penalty for general opposition
}

/**
 * Get NPC by ID
 */
export function getNpcById(id: string): FactionNpc | undefined {
  return factionNpcs.find(npc => npc.id === id)
}

/**
 * Get primary NPCs for a faction
 */
export function getFactionNpcs(faction: FactionId): FactionNpc[] {
  return factionNpcs.filter(npc => npc.faction === faction)
}

/**
 * Get all faction IDs
 */
export function getAllFactionIds(): FactionId[] {
  return Object.keys(factions) as FactionId[]
}

/**
 * Get faction by ID
 */
export function getFactionById(id: FactionId): Faction | undefined {
  return factions[id]
}
