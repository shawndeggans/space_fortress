# Space Fortress: Development Plan

This document outlines the implementation roadmap for building Space Fortress as a playable MVP for itch.io release.

## Current State

The project has a **functional core game loop** with:
- Event sourcing architecture (command → event → projection) with 70+ event types
- SQLite persistence via sql.js + IndexedDB with automatic snapshots
- Command serialization via async-mutex to prevent race conditions
- Navigation guards keeping URL in sync with game phase
- Fat events for self-contained state reconstruction
- Graceful degradation for corrupted event data
- 390+ unit tests covering all game systems

**What's implemented:**
- ✅ Full event system (70+ events across 10 categories including tactical battle)
- ✅ Core read model projections
- ✅ 11 game screens (quest-hub, narrative, card-pool, deployment, battle, alliance, mediation, consequence, choice-consequence, quest-summary, ending)
- ✅ 17 reusable UI components
- ✅ Classic battle system with d20 combat
- ✅ Tactical battle system foundation (turn-based, energy management, ~65% complete)
- ✅ Quest and reputation systems
- ✅ Alliance and mediation systems
- ✅ Vertical slice architecture for command handlers
- ✅ Card system with hull, defense, energyCost, abilities
- ✅ **All 3 quests fully implemented** (The Salvage Claim, The Sanctuary Run, The Broker's Gambit)

**What remains for MVP:**
- Tactical battle: UI screen (`/tactical-battle` route)
- Tactical battle: Complete remaining command handlers (5 of 10)
- Tactical battle: Complete remaining projection handlers (~9 missing)
- Tactical battle: Abilities system implementation
- Tactical battle: AI opponent behavior
- Balance tuning
- Polish and playtesting
- itch.io deployment

---

## Development Phases

### Phase 1: Core Domain Foundation

Expand the type system and event infrastructure to support the full game.

#### 1.1 Define Complete Type System

**File: `src/lib/game/types.ts`**

```typescript
// Factions
type FactionId = 'ironveil' | 'ashfall' | 'meridian' | 'void_wardens' | 'sundered_oath'

// Cards (ships) - Updated for tactical battle system
interface Card {
  id: string
  name: string
  faction: FactionId
  attack: number      // 1-6, damage dealt
  defense: number     // 1-7, damage reduction (renamed from armor)
  hull: number        // 2-8, health points (NEW)
  agility: number     // 1-5, initiative order
  energyCost: number  // 1-4, cost to deploy (NEW)
  abilities?: CardAbility[]  // 0-2 special abilities (NEW)
  flavorText?: string
}

// Quest structure
interface Quest {
  id: string
  faction: FactionId
  title: string
  description: string
  reputationRequired: number
  initialBounty: number
  dilemmas: string[]  // dilemma IDs in order
}

// Dilemma structure
interface Dilemma {
  id: string
  questId: string
  situation: string
  voices: Voice[]
  choices: Choice[]
}

interface Voice {
  npcName: string
  faction: FactionId | 'crew'
  dialogue: string
}

interface Choice {
  id: string
  label: string
  consequences: ChoiceConsequences
}

interface ChoiceConsequences {
  reputationChanges: { faction: FactionId; delta: number }[]
  cardsGained: string[]
  cardsLost: string[]
  triggersBattle: boolean
  nextDilemma?: string
  flags?: Record<string, boolean>
}
```

**Tasks:**
- [x] Define all faction types and constants
- [x] Define Card interface with stats
- [x] Define Quest and Dilemma structures
- [x] Define Choice and Consequence types
- [x] Define Battle-related types (BattleSetup, Round, RoundResult)
- [x] Define Reputation thresholds and status types

#### 1.2 Implement Full Event Catalog

**File: `src/lib/game/events.ts`**

Implement all 42 events organized by category:

**Quest Events (6):**
- `QuestsGenerated`
- `QuestViewed`
- `QuestAccepted`
- `QuestDeclined`
- `QuestCompleted`
- `QuestFailed`

**Narrative Events (3):**
- `DilemmaPresented`
- `ChoiceMade`
- `FlagSet`

**Alliance Events (7):**
- `AlliancePhaseStarted`
- `AllianceTermsViewed`
- `AllianceFormed`
- `AllianceRejected`
- `AlliancesDeclined`
- `SecretAllianceFormed`
- `AllianceDiscovered`

**Battle Events (13):**
- `BattleTriggered`
- `CardSelected`
- `CardDeselected`
- `FleetCommitted`
- `CardPositioned`
- `OrdersLocked`
- `BattleStarted`
- `RoundStarted`
- `CardsRevealed`
- `InitiativeResolved`
- `AttackRolled`
- `RoundResolved`
- `BattleResolved`

**Consequence Events (3):**
- `BountyCalculated`
- `BountyShared`
- `OutcomeAcknowledged`

**Reputation Events (4):**
- `ReputationChanged`
- `ReputationThresholdCrossed`
- `CardsUnlocked`
- `CardsLocked`

**Card Events (2):**
- `CardGained`
- `CardLost`

**Game End Events (3):**
- `GameEndTriggered`
- `EndingDetermined`
- `NewGameStarted`

**Mediation Events (5):**
- `MediationStarted`
- `PositionViewed`
- `MediationLeaned`
- `MediationCollapsed`
- `CompromiseAccepted`

**Tasks:**
- [x] Create events.ts with all event type definitions (51 events)
- [x] Add payload types for each event
- [x] Create discriminated union GameEvent type
- [x] Add event factory functions for type safety

#### 1.3 Implement Full Command Catalog

**File: `src/lib/game/commands.ts`**

**Quest Commands:**
- `ViewQuestDetails`
- `AcceptQuest`
- `DeclineQuest`

**Narrative Commands:**
- `MakeChoice`
- `MakePostBattleChoice`

**Alliance Commands:**
- `ViewAllianceTerms`
- `FormAlliance`
- `RejectAllianceTerms`
- `DeclineAllAlliances`
- `FormSecretAlliance`

**Battle Commands:**
- `SelectCard`
- `DeselectCard`
- `CommitFleet`
- `SetCardPosition`
- `LockOrders`
- `AcknowledgeOutcome`

**Mediation Commands:**
- `ViewPosition`
- `LeanTowardFaction`
- `RefuseToLean`
- `AcceptCompromise`

**System Commands:**
- `StartNewGame`
- `ViewChoiceHistory`
- `ViewFactionDetails`
- `ViewCardDetails`

**Tasks:**
- [x] Create commands.ts with all command types
- [x] Add payload types for each command
- [x] Create discriminated union GameCommand type

---

### Phase 2: State Management & Projections

Build the read models that power the UI.

#### 2.1 Core Game State

**File: `src/lib/game/state.ts`**

```typescript
interface GameState {
  // Player identity
  playerId: string
  gameStatus: 'not_started' | 'in_progress' | 'ended'

  // Reputation with factions (-100 to +100)
  reputation: Record<FactionId, number>

  // Cards owned by player
  ownedCards: Card[]
  lockedCards: { card: Card; reason: string }[]

  // Current quest state
  activeQuest: ActiveQuest | null
  completedQuests: CompletedQuest[]
  availableQuests: Quest[]

  // Current phase tracking
  currentPhase: GamePhase

  // Battle state (when in battle)
  currentBattle: BattleState | null

  // Story flags for branching narrative
  flags: Record<string, boolean>

  // Economy
  bounty: number

  // Statistics for ending calculation
  stats: GameStats
}
```

**Tasks:**
- [x] Define complete GameState interface
- [x] Define GamePhase enum (13 phases including mediation, alliance, choice_consequence)
- [x] Define BattleState interface
- [x] Define GameStats interface for ending calculation

#### 2.2 Read Model Projections

**File: `src/lib/game/projections/`**

Create projection functions for each read model:

**Priority 1 (Core Loop):**
- [x] `projectNavigationView(state): NavigationView` - Header display
- [x] `projectQuestHubView(state): QuestHubView` - Quest hub
- [x] `projectNarrativeView(state): NarrativeView` - Narrative screen
- [x] `projectCardPoolView(state): CardPoolView` - Card selection
- [x] `projectDeploymentView(state): DeploymentView` - Card ordering
- [x] `projectBattleView(state): BattleView` - Battle display
- [x] `projectConsequenceView(state): ConsequenceView` - Outcome display

**Priority 2 (Extended Systems):**
- [x] `projectAllianceView(state): AllianceView` - Alliance selection
- [x] `projectMediationView(state): MediationView` - Mediation screen
- [x] `projectChoiceConsequenceView(state): ChoiceConsequenceView` - Choice feedback
- [x] `projectQuestSummaryView(state): QuestSummaryView` - Quest completion

**Priority 3 (Endgame):**
- [x] `projectEndingView(state): EndingView` - Final evaluation
- [ ] `projectChoiceArchaeologyView(events): ChoiceArchaeologyView` - Choice history (optional)

**Tasks:**
- [x] Create projections directory with index.ts
- [x] Implement each projection as a pure function
- [x] Add unit tests for projections

#### 2.3 Decider Logic

**File: `src/lib/game/decider.ts`**

Expand the decide function to handle all commands:

```typescript
export function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    case 'ACCEPT_QUEST':
      return handleAcceptQuest(command, state)
    case 'MAKE_CHOICE':
      return handleMakeChoice(command, state)
    case 'SELECT_CARD':
      return handleSelectCard(command, state)
    // ... etc
  }
}
```

**Key Business Logic:**
- Quest acceptance validation (reputation requirements)
- Choice consequences calculation
- Battle triggering conditions
- Reputation threshold calculations
- Card unlock/lock logic
- Bounty calculation with ally shares

**Tasks:**
- [x] Implement quest command handlers (via slices/accept-quest/)
- [x] Implement narrative command handlers (via slices/make-choice/)
- [x] Implement battle command handlers (via slices/card-selection/, deployment/, battle-resolution/)
- [x] Implement alliance command handlers (via slices/form-alliance/)
- [x] Implement mediation command handlers (via slices/mediation/)
- [x] Add validation for all state transitions
- [x] Write unit tests for decider logic (482+ tests)

---

### Phase 3: Battle System (Classic)

The original d20-based combat system (still functional, may be deprecated).

#### 3.1 Combat Resolution Engine (Classic)

**File: `src/lib/game/combat.ts`**

```typescript
interface CombatRoll {
  base: number        // d20 result (1-20)
  modifier: number    // attack stat
  total: number       // base + modifier
  target: number      // 10 + enemy defense
  hit: boolean        // total >= target
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

function resolveRound(
  playerCard: Card,
  opponentCard: Card
): RoundResolution {
  // 1. Determine initiative (higher agility strikes first)
  // 2. First striker attacks
  // 3. If defender survives, counter-attack
  // 4. Determine round winner
}

function resolveBattle(
  playerFleet: Card[],
  opponentFleet: Card[],
  positions: number[]
): BattleResolution {
  // Run 5 rounds, each card vs opposing card at same position
  // Track wins/losses/draws
  // Determine overall victor (best of 5)
}
```

**Combat Formula:**
- To Hit: `d20 + Attack >= 10 + Enemy Defense`
- Initiative: Higher Agility strikes first (tie = simultaneous)
- Round Win: Hit opponent while not getting hit, OR opponent misses while you hit

**Tasks:**
- [x] Implement d20 roll function with seeding option for tests
- [x] Implement initiative resolution
- [x] Implement attack resolution
- [x] Implement round resolution
- [x] Implement full battle resolution
- [x] Generate battle events during resolution
- [x] Add unit tests for combat edge cases

#### 3.2 Opponent Fleet Generation

**File: `src/lib/game/opponents.ts`**

```typescript
interface OpponentFleet {
  name: string
  faction: FactionId | 'scavengers' | 'pirates'
  cards: Card[]
  difficulty: 'easy' | 'medium' | 'hard'
}

function generateOpponentFleet(
  context: BattleContext,
  playerStrength: number
): OpponentFleet {
  // Generate contextually appropriate enemy fleet
  // Scale difficulty based on quest progression
}
```

**Tasks:**
- [x] Define opponent fleet templates
- [x] Implement fleet generation based on battle context
- [x] Add difficulty scaling
- [x] Create scavenger/pirate generic card pools

---

### Phase 3B: Tactical Battle System (NEW)

Turn-based combat system replacing the automated d20 system. See `docs/design/CARD-BATTLE-REDESIGN.md` for full design.

**Key Features:**
- Energy-based resource management
- Turn-based with player decisions each round
- 5-slot battlefield with positioning
- Card abilities and synergies
- Flagship health victory condition
- Hand management (draw, discard, mulligan)

#### 3B.1 Core Battle Mechanics (PARTIALLY COMPLETE ~65%)

**Files:**
- `src/lib/game/types.ts` - TacticalBattleState, CombatantState, ShipState, EnergyState ✅
- `src/lib/game/events.ts` - 21 tactical battle events ✅
- `src/lib/game/commands.ts` - 10 tactical battle commands ✅
- `src/lib/game/decider.ts` - 5 of 10 command handlers implemented
- `src/lib/game/projections.ts` - 8 of ~17 event handlers implemented
- `src/routes/tactical-battle/` - **NOT YET CREATED**

**Tasks:**
- [x] Card structure with hull and energy cost
- [x] Turn-based flow (start → main → end phases)
- [x] Energy system (gain, spend, regenerate)
- [x] Basic attack/damage/destroy loop
- [x] Flagship health tracking
- [x] Victory conditions (flagship destroyed, timeout)
- [x] Battle events for new system (21 events)
- [x] Unit tests (13 tactical battle tests)
- [x] Command handlers: START_TACTICAL_BATTLE, MULLIGAN_CARDS, SKIP_MULLIGAN, DEPLOY_SHIP, ATTACK_WITH_SHIP
- [ ] Command handlers: MOVE_SHIP, ACTIVATE_ABILITY, DRAW_EXTRA_CARD, END_TURN, USE_EMERGENCY_RESERVES
- [ ] Projection handlers: ENERGY_SPENT, ENERGY_GAINED, SHIP_DESTROYED, SHIP_MOVED, ABILITY_*, STATUS_*, FLAGSHIP_DAMAGED
- [ ] **UI Screen: `/tactical-battle` route**

#### 3B.2 Abilities System

**Tasks:**
- [ ] Ability data structure and types (CardAbility interface exists)
- [ ] Ability timing system (triggers: deploy, attack, defend, destroyed, etc.)
- [ ] 4-5 abilities per faction (20 total)
- [ ] Ability targeting system
- [ ] UI for ability activation
- [ ] Ability effects engine

#### 3B.3 Hand Management

**Tasks:**
- [x] Battle deck selection (8-10 cards)
- [x] Draw system (TACTICAL_CARD_DRAWN event)
- [ ] Hand limit enforcement (max 5, discard excess)
- [x] Mulligan at battle start (MULLIGAN_CARDS command)
- [x] Discard mechanics (TACTICAL_CARD_DISCARDED event)
- [x] Deck/discard tracking

#### 3B.4 Positioning & Movement

**Tasks:**
- [x] 5-slot battlefield per side
- [x] Position-based targeting
- [x] Move action (MOVE_SHIP command, costs energy)
- [ ] Lane-based abilities
- [x] Empty slot → Flagship attack rules

#### 3B.5 Status Effects

**Tasks:**
- [x] Status effect data structure (StatusEffect, StatusEffectType in types.ts)
- [ ] Application and expiration logic
- [ ] Visual indicators
- [ ] 6-8 core status types (Exhausted, Stunned, Burning, Shielded, etc.)
- [ ] Status interaction rules

#### 3B.6 AI & Polish

**Tasks:**
- [ ] AI opponent decision making
- [ ] Difficulty scaling behavior
- [ ] Battle animations (optional)
- [ ] Tutorial/help tooltips

---

### Phase 4: UI Components

Build reusable Svelte components.

#### 4.1 Core Components

**Directory: `src/lib/components/`**

**Card Display:**
- [x] `Card.svelte` - Ship card with stats (attack/armor/agility)
- [x] `CardMini.svelte` - Compact card for lists
- [x] `CardSlot.svelte` - Empty slot for deployment

**Stats & Indicators:**
- [x] `StatPill.svelte` - Single stat display (⚔5)
- [x] `ReputationBar.svelte` - Faction reputation meter
- [x] `BountyDisplay.svelte` - Currency display
- [x] `PhaseIndicator.svelte` - Current game phase dots

**Narrative:**
- [x] `NpcVoiceBox.svelte` - NPC dialogue with portrait
- [x] `ChoiceButton.svelte` - Choice with consequences preview
- [x] `SituationBox.svelte` - Narrative text container

**Layout:**
- [x] `GameHeader.svelte` - Persistent header with quest/rep/bounty
- [x] `Modal.svelte` - Generic modal container
- [x] `DebugPanel.svelte` - Development debugging tools

**Battle:**
- [x] `DiceRoll.svelte` - Animated d20 display
- [x] `CombatLog.svelte` - Round-by-round text log
- [x] `BattleCard.svelte` - Card in battle context with health indicator

**Tasks:**
- [x] Create component directory structure
- [x] Implement each component with props interface
- [x] Add CSS styling (dark theme, space aesthetic)
- [x] Add component state variants (selected, locked, disabled)

#### 4.2 Component Styling System

**File: `src/lib/styles/`**

```css
/* Design tokens */
:root {
  --faction-ironveil: #c9a227;
  --faction-ashfall: #e85d04;
  --faction-meridian: #00b4d8;
  --faction-void-wardens: #7209b7;
  --faction-sundered: #6c757d;

  --bg-primary: #0a0a0f;
  --bg-secondary: #1a1a2e;
  --text-primary: #e0e0e0;
  --text-muted: #888888;

  --stat-attack: #ef476f;
  --stat-armor: #06d6a0;
  --stat-agility: #ffd166;
}
```

**Tasks:**
- [x] Define color palette for factions (tokens.css)
- [x] Define typography scale
- [x] Create spacing system
- [x] Build dark theme foundation
- [x] Add placeholder image system (emoji/unicode for ships)

---

### Phase 5: Game Screens

Build the 12 main screens. (11 of 12 implemented - tactical-battle UI pending)

#### 5.1 Priority 1: Core Loop Screens

**Quest Hub (`src/routes/quest-hub/+page.svelte`):**
- Display available quests with faction, title, requirements
- Show locked quests with unlock requirements
- Show completed quests section
- Handle quest selection → detail modal → accept/decline

**Narrative Screen (`src/routes/narrative/+page.svelte`):**
- Display situation text
- Show 3 NPC voice boxes with dialogue
- Present choices with consequence previews
- Handle choice selection → emit command → transition

**Card Pool Screen (`src/routes/card-pool/+page.svelte`):**
- Display owned cards in grid
- Show faction groupings
- Handle card selection (max 5)
- Show selected count, commit button
- Display enemy fleet preview (partial intel)

**Deployment Screen (`src/routes/deployment/+page.svelte`):**
- 5 numbered slots for card positioning
- Drag-and-drop or tap-to-assign
- Show unassigned cards
- Lock orders button when all 5 placed

**Battle Screen (`src/routes/battle/+page.svelte`):** ✅
- Round counter (1-5)
- Your card vs enemy card display
- Dice roll animation
- Combat log with results
- Round outcome indicator
- Continue button between rounds
- Final summary with all round results

**Tactical Battle Screen (`src/routes/tactical-battle/+page.svelte`):** ❌ NOT IMPLEMENTED
- Energy display and management
- 5-slot battlefield per side
- Hand display with deployable cards
- Ship status (hull, abilities, status effects)
- Action buttons (deploy, attack, move, end turn)
- Turn indicator and phase display

**Consequence Screen (`src/routes/consequence/+page.svelte`):**
- Battle outcome (victory/defeat/draw)
- Narrative text describing what happened
- Bounty breakdown (base, shares, net)
- Reputation changes list
- Cards gained/lost
- Continue button to next phase

**Tasks:**
- [x] Create route structure for each screen
- [x] Implement screen components using read models
- [x] Wire up command dispatching
- [x] Add navigation guards for phase-route sync
- [x] Handle loading states
- [ ] **Implement tactical-battle screen** (blocking for tactical battle feature)

#### 5.2 Priority 2: Extended Screens

**Alliance Screen (`src/routes/alliance/+page.svelte`):**
- Available faction options with availability status
- View terms modal with NPC dialogue
- Form/reject alliance actions
- Proceed alone option with warning

**Mediation Screen (`src/routes/mediation/+page.svelte`):**
- Facilitator NPC introduction
- Two-column faction positions
- Lean toward options with previews
- Refuse to lean (battle trigger) option

**Post-Battle Dilemma (`src/routes/post-battle/+page.svelte`):**
- Context text based on battle outcome
- 3 NPC voices with positions
- Choices with risk indicators
- Special handling for discovery events

**Tasks:**
- [x] Implement alliance screen with terms modal
- [x] Implement mediation screen with position display
- [x] Implement post-battle dilemma variations

#### 5.3 Priority 3: Information Screens

**Reputation Dashboard (`src/routes/reputation/+page.svelte`):**
- All 5 factions with reputation bars
- Current status (friendly/neutral/hostile)
- Trend indicators (rising/falling/stable)
- Tap to expand faction details

**Fleet Overview (`src/routes/fleet/+page.svelte`):**
- All owned cards in grid
- Filter by faction
- Sort by stats
- Card detail modal with battle history

**Ending Screen (`src/routes/ending/+page.svelte`):**
- Title and subtitle based on ending type
- Summary narrative text
- Final reputation bars
- Statistics (quests, battles, diplomacy)
- Choice history link
- New game button

**Tasks:**
- [x] Implement reputation display in header
- [ ] Implement fleet overview with filtering/sorting (optional enhancement)
- [x] Implement ending screen with all ending types

---

### Phase 6: Game Content

Populate the game with actual content.

#### 6.1 Card Database

**File: `src/lib/data/cards.ts`**

Create cards for each faction with stat distributions:

| Faction | Profile | Attack | Armor | Agility |
|---------|---------|--------|-------|---------|
| Ironveil | Siege | High | Medium | Low |
| Ashfall | Interceptor | Medium | Low | High |
| Meridian | Balanced | Medium | Medium | Medium |
| Void Wardens | Tank | Low | High | Medium |
| Sundered Oath | Glass Cannon | Very High | Low | Medium |

**Tasks:**
- [x] Create 4 cards per faction (20+ total)
- [x] Balance stat distributions (total ~10 per card)
- [x] Add flavor text
- [x] Create starter deck (3-4 generic cards)

#### 6.2 Quest Content

**File: `src/lib/data/quests.ts`**

Three quest arcs for MVP:

**Quest 1: The Salvage Claim (Ironveil)**
- Dilemma 1: Choose alliance for escort mission
- Dilemma 2: Approach strategy
- Battle: Scavengers at derelict
- Dilemma 3: Survivor question (post-battle)

**Quest 2: The Sanctuary Run (Ashfall)**
- Dilemma 1: Accept refugee mission
- Dilemma 2: Blockade approach (fight vs negotiate)
- Optional: Mediation with Void Wardens
- Battle: Blockade breakthrough
- Dilemma 3: Delivery completion

**Quest 3: The Broker's Gambit (Meridian)**
- Dilemma 1: Accept mediation contract
- Dilemma 2: Secret alliance offer
- Dilemma 3: Betrayal or loyalty
- Battle: Faction conflict resolution
- Dilemma 4: Final disposition

**Tasks:**
- [x] Write situation text for each dilemma
- [x] Write NPC dialogue (3 voices per dilemma)
- [x] Define choice consequences
- [x] Create quest unlock requirements
- [x] Balance reputation/bounty rewards
- [x] Quest 1 content (The Salvage Claim) - 3 dilemmas, 10+ choices
- [x] Quest 2 content (The Sanctuary Run) - 3 dilemmas, 13+ choices
- [x] Quest 3 content (The Broker's Gambit) - 4 dilemmas, 14+ choices

#### 6.3 Faction Data

**File: `src/lib/data/factions.ts`**

```typescript
const factions: Record<FactionId, Faction> = {
  ironveil: {
    id: 'ironveil',
    name: 'Ironveil Syndicate',
    icon: '▣',
    color: '#c9a227',
    values: ['Profit', 'Contracts', 'Order'],
    cardProfile: 'Siege specialists - high attack, low agility',
    conflictsWith: ['ashfall']
  },
  // ... etc
}
```

**Tasks:**
- [x] Define all 5 factions with lore
- [x] Set faction relationships (conflicts)
- [x] Define reputation thresholds per faction
- [x] Create faction leader NPCs

---

### Phase 7: Polish & Integration

#### 7.1 Navigation & Routing

**File: `src/lib/navigation.ts`**

```typescript
type GameRoute =
  | 'quest-hub'
  | 'narrative'
  | 'alliance'
  | 'mediation'
  | 'card-pool'
  | 'deployment'
  | 'battle'
  | 'consequence'
  | 'post-battle'
  | 'ending'
  | 'reputation'
  | 'fleet'

function getNextRoute(state: GameState, lastEvent: GameEvent): GameRoute {
  // Determine next screen based on game state and events
}
```

**Tasks:**
- [x] Implement navigation state machine (router.ts with PHASE_ROUTES)
- [x] Add route guards (beforeNavigate in +layout.svelte)
- [x] Create smooth transitions between screens ($effect for phase changes)
- [x] Add back button handling where appropriate

#### 7.2 Svelte Store Integration

**File: `src/lib/stores/gameStore.ts`**

Expand the existing store:

```typescript
// Derived stores for each read model
export const playerState = derived(events, projectPlayerState)
export const questList = derived(events, projectQuestList)
export const currentDilemma = derived([events, currentDilemmaId], projectDilemmaView)
// ... etc
```

**Tasks:**
- [x] Create derived stores for all read models
- [x] Optimize projection calculations (snapshots after 50 events)
- [x] Handle event persistence to SQLite
- [x] Implement event replay on load (with snapshot support)

#### 7.3 Error Handling & Edge Cases

**Tasks:**
- [x] Add error toast for game errors
- [x] Handle invalid game states gracefully (pending state validation)
- [x] Handle corrupted event data gracefully (try-catch in JSON parsing)
- [x] Implement card deselection for card selection phase

#### 7.4 Audio Hooks (Placeholder)

**File: `src/lib/audio.ts`**

```typescript
// Placeholder audio system for future implementation
export const AudioEvents = {
  CARD_SELECT: 'card_select',
  DICE_ROLL: 'dice_roll',
  HIT: 'hit',
  MISS: 'miss',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  CHOICE_MADE: 'choice_made'
}

export function playSound(event: string) {
  // No-op for MVP, hook for future audio
  console.log(`[Audio] ${event}`)
}
```

**Tasks:**
- [ ] Create audio event constants (future)
- [ ] Add audio hooks to key game moments (future)
- [ ] Document audio requirements for future (out of MVP scope)

---

### Phase 8: Testing & Launch Prep

#### 8.1 Unit Tests

**Directory: `src/lib/game/__tests__/`**

**Critical Test Coverage:**
- [x] All decider command handlers (390+ tests across 32 test files)
- [x] Combat resolution (hit/miss, initiative, rounds)
- [x] Reputation calculations (thresholds, card locks)
- [x] All projection functions
- [x] Event serialization/deserialization

#### 8.2 Integration Tests

- [x] Full quest playthrough (happy path) - gameplay-simulation.test.ts
- [x] Battle with all outcomes (victory, defeat, draw)
- [x] Mediation path (diplomatic resolution)
- [x] Reputation gating (locked quest, locked cards)
- [x] Save/load cycle preservation

#### 8.3 Playtesting Checklist

- [ ] Complete one full game (3 quests) without crashes
- [ ] Verify all endings are reachable
- [ ] Check balance (is any strategy dominant?)
- [ ] Verify save/load works mid-quest
- [ ] Test on target browsers (Chrome, Firefox, Safari)

#### 8.4 itch.io Deployment

**Tasks:**
- [ ] Build static site (`npm run build`)
- [ ] Test built version locally
- [ ] Create itch.io game page
- [ ] Upload build to itch.io
- [ ] Configure embed settings
- [ ] Write game description and controls
- [ ] Add cover image and screenshots

---

## Implementation Order

For efficient development, implement in this order:

### ~~Sprint 1: Foundation (Types & Events)~~ ✅ COMPLETE
1. ~~Complete type definitions~~
2. ~~Implement all event types~~
3. ~~Implement all command types~~
4. ~~Expand decider for quest/narrative commands~~

### ~~Sprint 2: Battle System~~ ✅ COMPLETE (Classic)
1. ~~Combat resolution engine~~
2. ~~Battle decider commands~~
3. ~~Opponent generation~~
4. ~~Battle projections~~

### ~~Sprint 3: Core UI Components~~ ✅ COMPLETE
1. ~~Card component~~
2. ~~NpcVoiceBox component~~
3. ~~ChoiceButton component~~
4. ~~GameHeader component~~
5. ~~StatPill, ReputationBar, BountyDisplay~~

### ~~Sprint 4: Core Loop Screens~~ ✅ COMPLETE
1. ~~Quest Hub screen~~
2. ~~Narrative screen~~
3. ~~Card Pool screen~~
4. ~~Deployment screen~~
5. ~~Battle screen~~
6. ~~Consequence screen~~

### ~~Sprint 5: Content & Extended Features~~ ✅ COMPLETE
1. ~~Card database (20 cards)~~
2. ~~Quest 1 content (The Salvage Claim)~~
3. ~~Alliance screen~~
4. ~~Quest 2 content (The Sanctuary Run)~~
5. ~~Mediation screen~~
6. ~~Quest 3 content (The Broker's Gambit)~~

### Sprint 6: Tactical Battle Completion (CURRENT)
1. Complete remaining command handlers (5 of 10)
2. Complete remaining projection handlers (~9 missing)
3. **Create tactical-battle UI screen**
4. Implement ability effects engine
5. AI opponent behavior
6. Integration testing

### Sprint 7: Polish & Launch
1. Balance tuning
2. Playtesting all 3 quests
3. Bug fixes
4. itch.io deployment

---

## Technical Notes

### Event Versioning
All events include a timestamp for debugging. Fat events include all relevant data:
```typescript
interface CardGainedEvent {
  type: 'CARD_GAINED'
  data: {
    cardId: string
    factionId: FactionId
    name: string
    attack: number
    armor: number
    agility: number
    source: 'starter' | 'quest' | 'alliance' | 'choice' | 'unlock'
    timestamp: string
  }
}
```

### State Reconstruction
Game state is rebuilt from events using snapshots for performance:
```typescript
// BrowserEventStore.loadStateWithSnapshot handles this automatically
const state = await eventStore.loadStateWithSnapshot(
  streamId,
  evolveState,
  getInitialState()
)
```

### Performance Considerations
- **Snapshots**: Automatic snapshots after 50 events (SNAPSHOT_THRESHOLD)
- **Schema versioning**: SCHEMA_VERSION invalidates old snapshots when GameState changes
- **Command mutex**: async-mutex prevents race conditions from rapid UI actions
- **Graceful degradation**: Corrupted events are skipped, not fatal

### Navigation Guards
URL stays in sync with game phase via router.ts:
```typescript
export const PHASE_ROUTES: Record<GamePhase, string | null> = {
  quest_hub: '/quest-hub',
  narrative: '/narrative',
  battle: '/battle',
  tactical_battle: '/tactical-battle',  // NEW
  // ...
}
```
Layout uses beforeNavigate to block invalid routes and $effect to auto-navigate on phase changes.

### Placeholder Assets
Use text/emoji placeholders for all visual elements:
- Ship silhouettes: Unicode box characters
- Faction icons: ▣ ◈ ⬡ ⛊ ✕
- Stat icons: ⚔ 🛡 ⚡

---

## Success Criteria

MVP is complete when:

1. **Playable**: Complete 3 quests in ~45-60 minutes
2. **Functional**: All core loop phases work (narrative → battle → consequence)
3. **Persistent**: Save/load preserves full game state
4. **Replayable**: Different choices lead to different outcomes
5. **Stable**: No crashes during normal gameplay
6. **Deployable**: Runs in browser via itch.io embed

---

## Out of Scope for MVP

- Real ship artwork (use placeholders)
- Sound effects and music
- Animations beyond basic transitions
- Tutorial/onboarding flow
- Settings screen
- Achievements
- Multiple save slots
- Steam integration
- Mobile optimization
- Localization
