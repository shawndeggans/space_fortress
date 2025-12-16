// ============================================================================
// SHARED KERNEL - Core Domain Types
// ============================================================================
//
// This module contains the foundational types that are shared across all
// vertical slices. These are the ubiquitous language of the Space Fortress
// domain - concepts that appear in multiple bounded contexts.
//
// IMPORTANT: Keep this module minimal. Only types that are truly shared
// across multiple slices belong here. Slice-specific types should live
// in their respective slice modules.
// ============================================================================

// ----------------------------------------------------------------------------
// Faction Identity
// ----------------------------------------------------------------------------

/**
 * The five factions that players can ally with or antagonize.
 * This is the most fundamental type in the game - nearly every
 * slice deals with factions in some way.
 */
export type FactionId =
  | 'ironveil'       // Industrial syndicate, values contracts and profit
  | 'ashfall'        // Refugee collective, values survival and community
  | 'meridian'       // Free traders, values independence and opportunity
  | 'void_wardens'   // Peacekeepers, values order and stability
  | 'sundered_oath'  // Mercenary guild, values honor and strength

/**
 * Reputation status thresholds determine what options are available
 * to the player. These are universal across all faction interactions.
 */
export type ReputationStatus =
  | 'devoted'    // 75+: Best terms, exclusive content
  | 'friendly'   // 25 to 74: Good terms, most content available
  | 'neutral'    // -24 to 24: Standard terms
  | 'unfriendly' // -74 to -25: Poor terms, limited options
  | 'hostile'    // -75 or below: Refuses interaction, may attack

/**
 * Calculate reputation status from a numeric value.
 * This is a pure function used across multiple slices.
 */
export function getReputationStatus(value: number): ReputationStatus {
  if (value >= 75) return 'devoted'
  if (value >= 25) return 'friendly'
  if (value >= -24) return 'neutral'
  if (value >= -74) return 'unfriendly'
  return 'hostile'
}

/**
 * Check if a faction is available for alliance based on reputation status.
 * Hostile factions refuse all alliance offers.
 */
export function canFormAlliance(status: ReputationStatus): boolean {
  return status !== 'hostile'
}

// ----------------------------------------------------------------------------
// Game Phase
// ----------------------------------------------------------------------------

/**
 * The game progresses through discrete phases. Each phase corresponds
 * to a specific screen and set of available commands.
 *
 * This type is fundamental to routing and state management across
 * all slices.
 */
export type GamePhase =
  | 'not_started'        // Initial state, no game in progress
  | 'quest_hub'          // Selecting or viewing available quests
  | 'narrative'          // Reading dilemma text, making choices
  | 'choice_consequence' // Showing consequence of a narrative choice
  | 'alliance'           // Forming alliances before battle
  | 'mediation'          // Diplomatic resolution path
  | 'card_selection'     // Selecting cards for battle
  | 'deployment'         // Positioning cards in battle order
  | 'battle'             // Combat execution
  | 'consequence'        // Viewing battle results and rewards
  | 'post_battle_dilemma'// Special dilemmas that occur after battle
  | 'quest_summary'      // Showing quest completion summary
  | 'ending'             // Game complete, viewing final results

// ----------------------------------------------------------------------------
// Card Types
// ----------------------------------------------------------------------------

/**
 * Basic card definition - the ships that make up fleets.
 * Cards are central to both the alliance and battle slices.
 */
export interface Card {
  id: string
  name: string
  faction: FactionId
  attack: number   // 1-6: Offensive power (modifier to d20 attack roll)
  armor: number    // 1-7: Defensive strength (added to target number 10)
  agility: number  // 1-5: Initiative in combat (higher strikes first)
  flavorText?: string
}

/**
 * A card owned by the player, with acquisition metadata.
 * Extends Card with tracking information for the card pool slice.
 */
export interface OwnedCard extends Card {
  source: CardSource
  acquiredAt: string
  isLocked: boolean
  lockReason?: string
}

/**
 * How a card was acquired - important for tracking and
 * potentially for loss conditions.
 */
export type CardSource = 'starter' | 'quest' | 'alliance' | 'choice' | 'unlock'

// ----------------------------------------------------------------------------
// Battle Outcomes
// ----------------------------------------------------------------------------

/**
 * The three possible outcomes of a battle.
 * Used by battle-resolution and consequence slices.
 */
export type BattleOutcome = 'victory' | 'defeat' | 'draw'

/**
 * The three possible outcomes of a single combat round.
 */
export type RoundOutcome = 'player_won' | 'opponent_won' | 'draw'

// ----------------------------------------------------------------------------
// Reputation Change
// ----------------------------------------------------------------------------

/**
 * Represents a change to reputation with a faction.
 * Used across multiple slices: choices, alliances, battles, etc.
 */
export interface ReputationChange {
  faction: FactionId
  delta: number
}

// ----------------------------------------------------------------------------
// Base Event Data
// ----------------------------------------------------------------------------

/**
 * All events must include a timestamp. This base interface
 * ensures consistency across all event definitions.
 */
export interface BaseEventData {
  timestamp: string
}

/**
 * Create an ISO timestamp for events.
 */
export function createTimestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

/**
 * Deep partial - useful for test fixtures and partial updates.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Event type discriminator - all events have a type field.
 */
export interface TypedEvent<T extends string> {
  type: T
}
