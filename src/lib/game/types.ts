// ============================================================================
// SPACE FORTRESS - Core Type Definitions
// ============================================================================

// ----------------------------------------------------------------------------
// Factions
// ----------------------------------------------------------------------------

export type FactionId =
  | 'ironveil'
  | 'ashfall'
  | 'meridian'
  | 'void_wardens'
  | 'sundered_oath'

export interface Faction {
  id: FactionId
  name: string
  icon: string
  color: string
  description: string
  values: string[]
  cardProfile: string
  conflictsWith: FactionId[]
}

export type ReputationStatus =
  | 'devoted'    // 75+
  | 'friendly'   // 25 to 74
  | 'neutral'    // -24 to 24
  | 'unfriendly' // -74 to -25
  | 'hostile'    // -75 or below

export interface FactionReputation {
  faction: FactionId
  value: number
  status: ReputationStatus
}

// ----------------------------------------------------------------------------
// Cards (Ships) - Tactical Combat System
// ----------------------------------------------------------------------------

// Ability trigger timing
export type AbilityTrigger =
  | 'onDeploy'    // When card enters battlefield
  | 'onAttack'    // When card declares attack
  | 'onDefend'    // When card is attacked
  | 'onDestroyed' // When card's hull reaches 0
  | 'startTurn'   // At start of owner's turn
  | 'endTurn'     // At end of owner's turn
  | 'activated'   // Manual activation (costs energy)
  | 'passive'     // Always active while on field

// Target types for abilities
export type AbilityTargetType =
  | 'self'
  | 'ally'
  | 'enemy'
  | 'any_card'
  | 'all_enemies'
  | 'all_allies'
  | 'adjacent'
  | 'flagship'

// Ability effect definitions - discriminated union
export type AbilityEffect =
  // Damage effects
  | { type: 'deal_damage'; amount: number }
  | { type: 'area_damage'; amount: number; targets: 'all_enemies' | 'adjacent' }
  | { type: 'damage_flagship'; amount: number }
  // Defensive effects
  | { type: 'repair'; amount: number }
  | { type: 'shield'; amount: number; duration: number }
  | { type: 'redirect_damage'; to: 'attacker' | 'adjacent' }
  | { type: 'repair_flagship'; amount: number }
  // Control effects
  | { type: 'stun'; duration: number }
  | { type: 'disable_ability'; duration: number }
  | { type: 'force_attack'; target: 'ally' | 'flagship' }
  | { type: 'taunt'; duration: number }
  // Buff/Debuff effects
  | { type: 'boost_attack'; amount: number; duration: number }
  | { type: 'boost_defense'; amount: number; duration: number }
  | { type: 'reduce_attack'; amount: number; duration: number }
  | { type: 'reduce_defense'; amount: number; duration: number }
  | { type: 'energy_drain'; amount: number }
  | { type: 'energy_restore'; amount: number }
  // Utility effects
  | { type: 'draw_card'; amount: number }
  | { type: 'discard_random'; amount: number }
  | { type: 'return_to_hand'; target: 'self' | 'enemy' }
  | { type: 'destroy_card' }
  | { type: 'copy_stats' }
  // Favor effects (for liaison cards)
  | { type: 'gain_favor'; amount: number; faction: FactionId | 'same' }
  // Conditional effects
  | { type: 'conditional'; condition: AbilityCondition; effect: AbilityEffect }
  // Multi-effect
  | { type: 'multi'; effects: AbilityEffect[] }

// Conditions for conditional abilities
export type AbilityCondition =
  | { type: 'hull_below'; percentage: number }
  | { type: 'hull_above'; percentage: number }
  | { type: 'energy_above'; amount: number }
  | { type: 'allies_count'; comparison: 'gt' | 'lt' | 'eq'; count: number }
  | { type: 'enemies_count'; comparison: 'gt' | 'lt' | 'eq'; count: number }
  | { type: 'card_destroyed_this_turn' }
  | { type: 'first_card_played' }

// Card ability definition
export interface CardAbility {
  id: string
  name: string
  trigger: AbilityTrigger
  energyCost?: number        // Required for 'activated' trigger
  targetType: AbilityTargetType
  effect: AbilityEffect
  description: string
  cooldown?: number          // Turns between uses (for activated abilities)
}

// Base card interface for tactical combat
export interface Card {
  id: string
  name: string
  faction: FactionId
  // Combat stats
  attack: number      // 1-6: Damage dealt when attacking
  defense: number     // 1-5: Damage reduction (was 'armor')
  hull: number        // 1-8: Hit points for this card
  agility: number     // 1-5: Initiative in combat (turn order)
  energyCost: number  // 1-4: Cost to deploy from hand
  // Abilities
  abilities: CardAbility[]
  // Metadata
  flavorText?: string
  // Liaison card properties
  isLiaison?: boolean
  favorGeneration?: number  // Bonus favor on kill/trigger
}

export interface OwnedCard extends Card {
  source: 'starter' | 'quest' | 'alliance' | 'choice' | 'unlock'
  acquiredAt: string
  isLocked: boolean
  lockReason?: string
}

export interface CardBattleHistory {
  cardId: string
  timesUsed: number
  wins: number
  losses: number
  draws: number
}

// ----------------------------------------------------------------------------
// Quests
// ----------------------------------------------------------------------------

export type QuestStatus =
  | 'available'
  | 'locked'
  | 'active'
  | 'completed'
  | 'failed'

export interface Quest {
  id: string
  faction: FactionId
  title: string
  briefDescription: string
  fullDescription: string
  questGiverName: string
  questGiverDialogue: string
  reputationRequired: number
  initialBounty: number
  initialCards: string[]  // Card IDs granted on acceptance
  dilemmaIds: string[]    // Ordered list of dilemma IDs
  warningText?: string    // e.g., "This will anger the Ashfall Remnants"
}

export interface ActiveQuest {
  questId: string
  factionId: FactionId
  currentDilemmaIndex: number
  dilemmasCompleted: number
  alliances: QuestAlliance[]
  battlesWon: number
  battlesLost: number
}

export interface CompletedQuest {
  questId: string
  outcome: 'completed' | 'full' | 'partial' | 'compromised' | 'failed'
  finalBounty: number
  completedAt: string
}

export interface QuestAlliance {
  faction: FactionId
  bountyShare: number
  isSecret: boolean
}

// ----------------------------------------------------------------------------
// Dilemmas & Choices
// ----------------------------------------------------------------------------

export interface Dilemma {
  id: string
  questId: string
  situation: string
  voices: Voice[]
  choices: Choice[]
}

export interface Voice {
  npcName: string
  faction: FactionId | 'crew' | 'other'
  dialogue: string
  position?: string  // Their stance on the issue
}

export interface Choice {
  id: string
  label: string
  description?: string
  consequences: ChoiceConsequences
}

export interface ChoiceConsequences {
  reputationChanges: ReputationChange[]
  cardsGained: string[]
  cardsLost: string[]
  bountyModifier?: number
  triggersBattle?: BattleTrigger
  triggersAlliance?: boolean
  triggersMediation?: boolean
  nextDilemmaId?: string
  flags?: Record<string, boolean>
  risk?: ChoiceRisk
  /** Choice-specific narrative text shown on the consequence screen */
  narrativeText?: string
}

export interface ReputationChange {
  faction: FactionId
  delta: number
}

export interface ChoiceRisk {
  description: string
  probability: number  // 0-1
  consequence: string
}

export interface BattleTrigger {
  opponentType: string
  context: string
  difficulty: 'easy' | 'medium' | 'hard'
}

// ----------------------------------------------------------------------------
// Alliance
// ----------------------------------------------------------------------------

export interface AllianceOption {
  faction: FactionId
  available: boolean
  unavailableReason?: string
  bountyShare: number
  cardsProvided: string[]
  battleRole: 'attacker' | 'defender'
  reputationEffect: ReputationChange
  conflictWarnings: ConflictWarning[]
}

export interface ConflictWarning {
  faction: FactionId
  delta: number
  reason: string
}

export interface FormedAlliance {
  faction: FactionId
  bountyShare: number
  cardsProvided: string[]
  isSecret: boolean
  discoveryRisk?: number
}

// ----------------------------------------------------------------------------
// Mediation (Diplomatic Resolution)
// ----------------------------------------------------------------------------

export interface Mediation {
  id: string
  questId: string
  facilitator: Voice
  parties: MediationParty[]
  leanOptions: LeanOption[]
}

export interface MediationParty {
  faction: FactionId
  representative: Voice
  position: string
  demands: string[]
}

export interface LeanOption {
  towardFaction: FactionId
  awayFromFaction: FactionId
  outcomePreview: string
  reputationEffects: ReputationChange[]
  bountyModifier: number
}

// ----------------------------------------------------------------------------
// Battle System
// ----------------------------------------------------------------------------

export type BattleOutcome = 'victory' | 'defeat' | 'draw'
export type RoundOutcome = 'player_won' | 'opponent_won' | 'draw'

export interface BattleSetup {
  battleId: string
  questId: string
  context: string
  opponentName: string
  opponentFaction: FactionId | 'scavengers' | 'pirates'
  opponentFleet: Card[]
  playerFleet: Card[]
  playerPositions: (string | null)[]  // Card IDs in positions 1-5
}

export interface BattleState {
  battleId: string
  questId?: string
  phase: 'selection' | 'deployment' | 'execution' | 'resolved'
  selectedCardIds: string[]
  positions: (string | null)[]
  currentRound: number
  rounds: RoundResult[]
  outcome?: BattleOutcome
  // Opponent info (from BATTLE_TRIGGERED)
  opponentType?: string
  opponentFactionId?: FactionId | 'scavengers' | 'pirates'
  difficulty?: 'easy' | 'medium' | 'hard'
  context?: string
}

export interface RoundResult {
  roundNumber: number
  playerCard: Card
  opponentCard: Card
  initiative: 'player' | 'opponent' | 'simultaneous'
  playerRoll: CombatRoll
  opponentRoll: CombatRoll
  outcome: RoundOutcome
}

export interface CombatRoll {
  base: number      // d20 result (1-20)
  modifier: number  // attack stat
  total: number     // base + modifier
  target: number    // 10 + enemy armor
  hit: boolean      // total >= target
}

export interface BattleResult {
  battleId: string
  outcome: BattleOutcome
  playerWins: number
  opponentWins: number
  draws: number
  rounds: RoundResult[]
}

// ----------------------------------------------------------------------------
// Tactical Battle System (Turn-Based Combat)
// ----------------------------------------------------------------------------

export type TacticalBattlePhase =
  | 'setup'           // Initial setup, deck selection
  | 'mulligan'        // Optional card redraw
  | 'playing'         // Active turn-based combat
  | 'resolved'        // Battle complete

export type TacticalVictoryCondition =
  | 'flagship_destroyed'  // Primary: destroy enemy flagship
  | 'fleet_eliminated'    // Secondary: no ships and no cards
  | 'timeout'             // Tertiary: round limit reached

// Energy system for deploying cards and abilities
export interface EnergyState {
  current: number       // Available energy this turn
  maximum: number       // Cap (starts at 3, can increase)
  regeneration: number  // Gained each turn (default: 2)
}

// Status effects that can be applied to ships
export type StatusEffectType =
  | 'stunned'       // Cannot attack or use abilities
  | 'burning'       // Take damage at start of turn
  | 'shielded'      // Block next damage instance
  | 'energized'     // Abilities cost 1 less energy
  | 'marked'        // Next attack deals +2 damage
  | 'taunting'      // Enemies must attack this ship

export interface StatusEffect {
  type: StatusEffectType
  duration: number      // Turns remaining (0 = permanent until removed)
  source: string        // Card ID that applied this
  stacks?: number       // For stackable effects
}

// A deployed ship on the battlefield
export interface ShipState {
  cardId: string
  card: Card            // Full card data
  position: 1 | 2 | 3 | 4 | 5
  currentHull: number   // Current HP
  maxHull: number       // Maximum HP (from card.hull)
  isExhausted: boolean  // Can't attack until readied
  statusEffects: StatusEffect[]
  abilityCooldowns: Record<string, number>  // abilityId -> turns until ready
}

// Flagship (main objective)
export interface FlagshipState {
  currentHull: number
  maxHull: number       // 10 + (2 × difficulty level)
}

// State for one combatant (player or opponent)
export interface CombatantState {
  flagship: FlagshipState

  energy: EnergyState

  // Battlefield - 5 slots, null = empty
  battlefield: (ShipState | null)[]

  // Cards
  hand: string[]        // Card IDs in hand
  deck: string[]        // Card IDs remaining in deck (shuffled)
  discard: string[]     // Card IDs in discard pile

  // Tracking
  shipsDestroyedThisTurn: number
  cardsPlayedThisTurn: string[]
}

// Initiative determination
export interface InitiativeState {
  firstPlayer: 'player' | 'opponent'
  reason: 'agility' | 'tiebreaker'
  playerAgility: number
  opponentAgility: number
  // Second player compensation
  secondPlayerBonus: {
    extraStartingEnergy: number   // +1
    emergencyReserves: {
      available: boolean
      expiresOnTurn: number       // Turn 3
      energyGrant: number         // +2
    }
  }
}

// Full tactical battle state
export interface TacticalBattleState {
  battleId: string
  questId: string
  context: string       // Battle narrative context

  // Phase tracking
  phase: TacticalBattlePhase
  turnNumber: number
  activePlayer: 'player' | 'opponent'
  roundLimit: number    // Default: 5 rounds (10 turns)

  // Combatants
  player: CombatantState
  opponent: CombatantState

  // Initiative
  initiative: InitiativeState

  // Victory tracking
  victoryCondition?: TacticalVictoryCondition
  winner?: 'player' | 'opponent' | 'draw'

  // Opponent metadata
  opponentName: string
  opponentFactionId: FactionId | 'scavengers' | 'pirates'
  difficulty: 'easy' | 'medium' | 'hard'

  // Action tracking for current turn
  actionsThisTurn: TacticalAction[]
}

// Actions that can be taken during a turn
export type TacticalActionType =
  | 'deploy'          // Play a card from hand
  | 'attack'          // Attack with a ship
  | 'activate'        // Activate an ability
  | 'move'            // Move ship to different position
  | 'draw'            // Draw extra card (costs energy)
  | 'end_turn'        // End current turn

export interface TacticalAction {
  type: TacticalActionType
  cardId?: string
  targetId?: string
  position?: number
  timestamp: string
}

// Configuration for tactical battles
export const TACTICAL_BATTLE_CONFIG = {
  // Energy
  startingMaxEnergy: 3,
  energyRegeneration: 2,
  firstTurnBonus: 1,        // Start with 3 energy on turn 1
  secondPlayerExtraEnergy: 1,
  drawCardCost: 2,

  // Hand
  startingHandSize: 3,
  maxHandSize: 5,
  deckSize: { min: 4, max: 8 },  // Lowered to match realistic card counts

  // Flagship
  baseFlagshipHull: 10,
  flagshipHullPerDifficulty: 2,  // +2 per difficulty level

  // Victory
  roundLimit: 5,            // 5 rounds = 10 turns
  attritionDamage: 2,       // Damage to flagship when no ships/cards

  // Positioning
  battlefieldSlots: 5,
  moveCost: 1,              // Energy to move between slots
} as const

// ----------------------------------------------------------------------------
// Consequences & Bounty
// ----------------------------------------------------------------------------

export interface BountyCalculation {
  base: number
  shares: BountyShare[]
  modifiers: BountyModifier[]
  net: number
}

export interface BountyShare {
  faction: FactionId
  amount: number
  reason: string
}

export interface BountyModifier {
  amount: number
  reason: string
}

// ----------------------------------------------------------------------------
// Post-Battle Dilemmas
// ----------------------------------------------------------------------------

export type PostBattleDilemmaType =
  | 'spoils'      // Victory: what to do with spoils/captives
  | 'retreat'     // Defeat: how to handle failure
  | 'discovery'   // Secret alliance exposed
  | 'complication' // Unexpected outcome

export interface PostBattleDilemma {
  id: string
  battleId: string
  type: PostBattleDilemmaType
  situation: string
  voices: Voice[]
  choices: Choice[]
}

// ----------------------------------------------------------------------------
// Game Endings
// ----------------------------------------------------------------------------

export type EndingType =
  | 'faction_commander'  // High single faction rep
  | 'broker'             // Balanced reputation
  | 'opportunist'        // High deception count
  | 'conqueror'          // High combat victories
  | 'negotiator'         // Diplomatic preference

export interface EndingEvaluation {
  endingType: EndingType
  title: string
  subtitle: string
  summary: string
  primaryFaction?: FactionId
  fleetComposition: Record<FactionId, number>
  reputationFinal: Record<FactionId, number>
  choicePatterns: ChoicePatterns
  battleRecord: BattleRecord
}

export interface ChoicePatterns {
  combatVsDiplomacy: number  // -1 to 1, negative = diplomacy
  loyaltyVsOpportunism: number
  betrayalCount: number
  secretsKept: number
  secretsExposed: number
}

export interface BattleRecord {
  total: number
  wins: number
  losses: number
  draws: number
  avoided: number  // Diplomatic resolutions
}

// ----------------------------------------------------------------------------
// Game Phase Tracking
// ----------------------------------------------------------------------------

export type GamePhase =
  | 'not_started'
  | 'quest_hub'
  | 'narrative'
  | 'choice_consequence'
  | 'alliance'
  | 'mediation'
  | 'card_selection'
  | 'deployment'
  | 'battle'              // Classic automated battle
  | 'tactical_battle'     // New turn-based tactical battle
  | 'consequence'
  | 'post_battle_dilemma'
  | 'quest_summary'
  | 'ending'

// ----------------------------------------------------------------------------
// Game Statistics
// ----------------------------------------------------------------------------

export interface GameStats {
  questsCompleted: number
  questsFailed: number
  battlesWon: number
  battlesLost: number
  battlesDraw: number
  battlesAvoided: number
  choicesMade: number
  alliancesFormed: number
  secretAlliancesFormed: number
  betrayals: number
  totalBountyEarned: number
  totalBountyShared: number
  totalBountyLost: number  // Bounty lost to penalties, choices, etc.
  cardsAcquired: number
  cardsLost: number
  playTimeSeconds: number
}

// ----------------------------------------------------------------------------
// Flags (Story State)
// ----------------------------------------------------------------------------

export type GameFlags = Record<string, boolean>

// ----------------------------------------------------------------------------
// Complete Game State
// ----------------------------------------------------------------------------

export interface GameState {
  // Identity
  playerId: string
  gameStatus: 'not_started' | 'in_progress' | 'ended'
  startedAt: string | null

  // Current phase
  currentPhase: GamePhase

  // Reputation with all factions (-100 to +100)
  reputation: Record<FactionId, number>

  // Cards
  ownedCards: OwnedCard[]
  cardHistory: CardBattleHistory[]

  // Quests
  availableQuestIds: string[]
  activeQuest: ActiveQuest | null
  completedQuests: CompletedQuest[]

  // Current dilemma (when in narrative phase)
  currentDilemmaId: string | null

  // Current battle (when in battle phases) - classic system
  currentBattle: BattleState | null

  // Current tactical battle (when in tactical_battle phase) - new turn-based system
  currentTacticalBattle: TacticalBattleState | null

  // Current mediation (when in mediation phase)
  currentMediationId: string | null
  // Mediation state tracking
  mediationParties: [FactionId, FactionId] | null
  hasLeaned: boolean
  leanedToward: FactionId | null

  // Economy
  bounty: number

  // Story flags for branching narrative
  flags: GameFlags

  // Statistics
  stats: GameStats

  // Choices made (for ending evaluation)
  choiceHistory: ChoiceHistoryEntry[]

  // Pending choice consequence (when in choice_consequence phase)
  pendingChoiceConsequence: PendingChoiceConsequence | null

  // Pending quest summary (when in quest_summary phase)
  pendingQuestSummary: PendingQuestSummary | null
}

export interface PendingChoiceConsequence {
  questId: string
  dilemmaId: string
  choiceId: string
  choiceLabel: string
  narrativeText: string
  triggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete'
  consequences: {
    reputationChanges: Array<{
      factionId: FactionId
      delta: number
      newValue: number
    }>
    cardsGained: string[]
    cardsLost: string[]
    bountyChange: {
      amount: number
      newValue: number
    } | null
    flagsSet: string[]
  }
}

export interface PendingQuestSummary {
  questId: string
  questTitle: string
  outcome: 'completed' | 'failed' | 'abandoned'
}

export interface ChoiceHistoryEntry {
  questId: string
  dilemmaId: string
  choiceId: string
  madeAt: string
}

// ----------------------------------------------------------------------------
// Stored Event Structure (Database)
// ----------------------------------------------------------------------------

export interface StoredEvent {
  event_id: string
  stream_id: string
  event_type: string
  event_data: string
  metadata: string | null
  sequence: number
  created_at: string
}

// ----------------------------------------------------------------------------
// Save Game Preview
// ----------------------------------------------------------------------------

export interface SaveGamePreview {
  save_name: string
  player_id: string
  phase: GamePhase
  activeQuestTitle?: string
  bounty: number
  questsCompleted: number
  saved_at: string
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Helper to get reputation status from value
export function getReputationStatus(value: number): ReputationStatus {
  if (value >= 75) return 'devoted'
  if (value >= 25) return 'friendly'
  if (value >= -24) return 'neutral'
  if (value >= -74) return 'unfriendly'
  return 'hostile'
}

// Helper to check if faction is available for alliance
export function canFormAlliance(status: ReputationStatus): boolean {
  return status !== 'hostile'
}
