// ============================================================================
// SPACE FORTRESS - Component Types
// ============================================================================

import type { FactionId, ReputationStatus, Card as GameCard } from '$lib/game/types'

// Re-export game types for convenience
export type { FactionId, ReputationStatus, GameCard }

// Stat types
export type StatType = 'attack' | 'armor' | 'agility'

// Card states
export type CardState = 'default' | 'selected' | 'committed' | 'revealed' | 'destroyed' | 'locked'

// Card sizes
export type CardSize = 'full' | 'compact' | 'mini'

// Extended faction type including enemy factions
export type ExtendedFactionId = FactionId | 'scavengers' | 'pirates' | 'crew' | 'other'

// Faction display data
export interface FactionDisplayData {
  id: ExtendedFactionId
  name: string
  icon: string
  color: string
}

// Card display props
export interface CardDisplayData {
  id: string
  name: string
  faction: FactionId | 'scavengers' | 'pirates'
  attack: number
  armor: number
  agility: number
  flavorText?: string
}

// NPC data for voice boxes
export interface NpcData {
  name: string
  faction: ExtendedFactionId
  portrait?: string
}

// Choice consequence previews
export interface ChoiceConsequence {
  reputation?: Array<{ faction: FactionId; delta: number }>
  cards?: Array<{ action: 'gain' | 'lose'; cardName: string; faction: FactionId }>
  bounty?: { modifier: number; reason: string }
  risk?: { description: string; probability: number }
}

// Choice data for buttons
export interface ChoiceData {
  id: string
  label: string
  description?: string
  consequences: ChoiceConsequence
  nextStep?: string
  triggersBattle?: boolean
  triggersAlliance?: boolean
  triggersMediation?: boolean
}

// Quest display data
export interface QuestDisplayData {
  id: string
  title: string
  faction: FactionId
  brief: string
  bountyLevel: number // 1-5
  reputationRequired?: number
}

// Quest states
export type QuestState = 'available' | 'active' | 'locked' | 'completed' | 'failed'

// Battle slot result
export type SlotResult = 'won' | 'lost' | 'draw' | null

// Phase types
export type BattlePhase = 'narrative' | 'commitment' | 'deployment' | 'execution' | 'consequence'

// Dice roll data
export interface DiceRollData {
  roll: number
  attackBonus: number
  total: number
  targetArmor: number
  targetValue: number
  result: 'hit' | 'miss'
}

// Bounty share data
export interface BountyShare {
  faction: FactionId
  percent: number
  amount: number
}

// Consequence item types
export type ConsequenceType =
  | 'card_gained'
  | 'card_lost'
  | 'rep_up'
  | 'rep_down'
  | 'bounty'
  | 'risk'
  | 'flag'
