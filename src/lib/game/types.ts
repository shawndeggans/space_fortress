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
// Cards (Ships)
// ----------------------------------------------------------------------------

export interface Card {
  id: string
  name: string
  faction: FactionId
  attack: number   // 1-6: Offensive power
  armor: number    // 1-7: Defensive strength
  agility: number  // 1-5: Initiative in combat
  flavorText?: string
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
  | 'battle'
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

  // Current battle (when in battle phases)
  currentBattle: BattleState | null

  // Current mediation (when in mediation phase)
  currentMediationId: string | null

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
