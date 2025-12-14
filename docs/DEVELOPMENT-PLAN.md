# Space Fortress: Development Plan

This document outlines the implementation roadmap for building Space Fortress as a playable MVP for itch.io release.

## Current State

The project has a **walking skeleton** with:
- Event sourcing architecture (command → event → projection)
- SQLite persistence via sql.js + IndexedDB
- Basic Svelte UI with save/load functionality
- Simplified types (4 commands, 5 events)

**What we need to build:**
- Full event system (42 events across 9 categories)
- 18+ read model projections
- 12 game screens
- 15+ reusable UI components
- Battle system with d20 combat
- Quest and reputation systems

---

## Development Phases

### Phase 1: Core Domain Foundation

Expand the type system and event infrastructure to support the full game.

#### 1.1 Define Complete Type System

**File: `src/lib/game/types.ts`**

```typescript
// Factions
type FactionId = 'ironveil' | 'ashfall' | 'meridian' | 'void_wardens' | 'sundered_oath'

// Cards (ships)
interface Card {
  id: string
  name: string
  faction: FactionId
  attack: number   // 1-6
  armor: number    // 1-7
  agility: number  // 1-5
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
- [ ] Define all faction types and constants
- [ ] Define Card interface with stats
- [ ] Define Quest and Dilemma structures
- [ ] Define Choice and Consequence types
- [ ] Define Battle-related types (BattleSetup, Round, RoundResult)
- [ ] Define Reputation thresholds and status types

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
- [ ] Create events.ts with all event type definitions
- [ ] Add payload types for each event
- [ ] Create discriminated union GameEvent type
- [ ] Add event factory functions for type safety

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
- [ ] Create commands.ts with all command types
- [ ] Add payload types for each command
- [ ] Create discriminated union GameCommand type

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
- [ ] Define complete GameState interface
- [ ] Define GamePhase enum (narrative, commitment, deployment, execution, consequence)
- [ ] Define BattleState interface
- [ ] Define GameStats interface for ending calculation

#### 2.2 Read Model Projections

**File: `src/lib/game/projections/`**

Create projection functions for each read model:

**Priority 1 (Core Loop):**
- [ ] `projectPlayerState(events): PlayerState` - Header display
- [ ] `projectQuestList(events): QuestList` - Quest hub
- [ ] `projectDilemmaView(events, dilemmaId): DilemmaView` - Narrative screen
- [ ] `projectCardPoolView(events, battleId?): CardPoolView` - Card selection
- [ ] `projectDeploymentView(events, battleId): DeploymentView` - Card ordering
- [ ] `projectRoundView(events, battleId, round): RoundView` - Battle display
- [ ] `projectBattleResultView(events, battleId): BattleResultView` - Battle summary
- [ ] `projectConsequenceView(events, battleId): ConsequenceView` - Outcome display

**Priority 2 (Extended Systems):**
- [ ] `projectActiveQuest(events): ActiveQuest` - Quest tracker
- [ ] `projectAllianceOptions(events, questId): AllianceOptions` - Alliance selection
- [ ] `projectAllianceTermsView(events, factionId): AllianceTermsView` - Alliance details
- [ ] `projectMediationView(events, mediationId): MediationView` - Mediation screen
- [ ] `projectReputationDashboard(events): ReputationDashboard` - Faction standings
- [ ] `projectFactionDetailView(events, factionId): FactionDetailView` - Faction details

**Priority 3 (Endgame):**
- [ ] `projectEndingView(events): EndingView` - Final evaluation
- [ ] `projectChoiceArchaeologyView(events): ChoiceArchaeologyView` - Choice history
- [ ] `projectPostBattleDilemmaView(events, battleId): PostBattleDilemmaView`

**Tasks:**
- [ ] Create projections directory with index.ts
- [ ] Implement each projection as a pure function
- [ ] Add unit tests for projections

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
- [ ] Implement quest command handlers
- [ ] Implement narrative command handlers
- [ ] Implement battle command handlers
- [ ] Implement alliance command handlers
- [ ] Implement mediation command handlers
- [ ] Add validation for all state transitions
- [ ] Write unit tests for decider logic

---

### Phase 3: Battle System

The core tactical gameplay.

#### 3.1 Combat Resolution Engine

**File: `src/lib/game/combat.ts`**

```typescript
interface CombatRoll {
  base: number        // d20 result (1-20)
  modifier: number    // attack stat
  total: number       // base + modifier
  target: number      // 10 + enemy armor
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
- To Hit: `d20 + Attack >= 10 + Enemy Armor`
- Initiative: Higher Agility strikes first (tie = simultaneous)
- Round Win: Hit opponent while not getting hit, OR opponent misses while you hit

**Tasks:**
- [ ] Implement d20 roll function with seeding option for tests
- [ ] Implement initiative resolution
- [ ] Implement attack resolution
- [ ] Implement round resolution
- [ ] Implement full battle resolution
- [ ] Generate battle events during resolution
- [ ] Add unit tests for combat edge cases

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
- [ ] Define opponent fleet templates
- [ ] Implement fleet generation based on battle context
- [ ] Add difficulty scaling
- [ ] Create scavenger/pirate generic card pools

---

### Phase 4: UI Components

Build reusable Svelte components.

#### 4.1 Core Components

**Directory: `src/lib/components/`**

**Card Display:**
- [ ] `Card.svelte` - Ship card with stats (attack/armor/agility)
- [ ] `CardMini.svelte` - Compact card for lists
- [ ] `CardSlot.svelte` - Empty slot for deployment

**Stats & Indicators:**
- [ ] `StatPill.svelte` - Single stat display (⚔5)
- [ ] `ReputationBar.svelte` - Faction reputation meter
- [ ] `BountyDisplay.svelte` - Currency display
- [ ] `PhaseIndicator.svelte` - Current game phase dots

**Narrative:**
- [ ] `NpcVoiceBox.svelte` - NPC dialogue with portrait
- [ ] `ChoiceButton.svelte` - Choice with consequences preview
- [ ] `SituationBox.svelte` - Narrative text container

**Layout:**
- [ ] `GameHeader.svelte` - Persistent header with quest/rep/bounty
- [ ] `Modal.svelte` - Generic modal container
- [ ] `Screen.svelte` - Screen wrapper with transitions

**Battle:**
- [ ] `DiceRoll.svelte` - Animated d20 display
- [ ] `CombatLog.svelte` - Round-by-round text log
- [ ] `BattleCard.svelte` - Card in battle context with health indicator

**Tasks:**
- [ ] Create component directory structure
- [ ] Implement each component with props interface
- [ ] Add CSS styling (dark theme, space aesthetic placeholders)
- [ ] Add component state variants (selected, locked, disabled)

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
- [ ] Define color palette for factions
- [ ] Define typography scale
- [ ] Create spacing system
- [ ] Build dark theme foundation
- [ ] Add placeholder image system (silhouettes for ships)

---

### Phase 5: Game Screens

Build the 12 main screens.

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

**Battle Screen (`src/routes/battle/+page.svelte`):**
- Round counter (1-5)
- Your card vs enemy card display
- Dice roll animation
- Combat log with results
- Round outcome indicator
- Continue button between rounds
- Final summary with all round results

**Consequence Screen (`src/routes/consequence/+page.svelte`):**
- Battle outcome (victory/defeat/draw)
- Narrative text describing what happened
- Bounty breakdown (base, shares, net)
- Reputation changes list
- Cards gained/lost
- Continue button to next phase

**Tasks:**
- [ ] Create route structure for each screen
- [ ] Implement screen components using read models
- [ ] Wire up command dispatching
- [ ] Add screen transitions
- [ ] Handle loading states

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
- [ ] Implement alliance screen with terms modal
- [ ] Implement mediation screen with position display
- [ ] Implement post-battle dilemma variations

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
- [ ] Implement reputation dashboard with faction expansion
- [ ] Implement fleet overview with filtering/sorting
- [ ] Implement ending screen with all ending types

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
- [ ] Create 4 cards per faction (20 total for MVP)
- [ ] Balance stat distributions (total ~10 per card)
- [ ] Add flavor text placeholders
- [ ] Create starter deck (3-4 generic cards)

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
- [ ] Write situation text for each dilemma
- [ ] Write NPC dialogue (3 voices per dilemma)
- [ ] Define choice consequences
- [ ] Create quest unlock requirements
- [ ] Balance reputation/bounty rewards

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
- [ ] Define all 5 factions with lore
- [ ] Set faction relationships (conflicts)
- [ ] Define reputation thresholds per faction
- [ ] Create faction leader NPCs

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
- [ ] Implement navigation state machine
- [ ] Add route guards (prevent accessing battle without fleet)
- [ ] Create smooth transitions between screens
- [ ] Add back button handling where appropriate

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
- [ ] Create derived stores for all read models
- [ ] Optimize projection calculations (memoization)
- [ ] Handle event persistence to SQLite
- [ ] Implement event replay on load

#### 7.3 Error Handling & Edge Cases

**Tasks:**
- [ ] Add error boundaries for UI crashes
- [ ] Handle invalid game states gracefully
- [ ] Add confirmation dialogs for destructive actions
- [ ] Implement undo for card selection (not choices)

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
- [ ] Create audio event constants
- [ ] Add audio hooks to key game moments
- [ ] Document audio requirements for future

---

### Phase 8: Testing & Launch Prep

#### 8.1 Unit Tests

**Directory: `src/lib/game/__tests__/`**

**Critical Test Coverage:**
- [ ] All decider command handlers
- [ ] Combat resolution (hit/miss, initiative, rounds)
- [ ] Reputation calculations (thresholds, card locks)
- [ ] All projection functions
- [ ] Event serialization/deserialization

#### 8.2 Integration Tests

- [ ] Full quest playthrough (happy path)
- [ ] Battle with all outcomes (victory, defeat, draw)
- [ ] Mediation path (diplomatic resolution)
- [ ] Reputation gating (locked quest, locked cards)
- [ ] Save/load cycle preservation

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

### Sprint 1: Foundation (Types & Events)
1. Complete type definitions
2. Implement all event types
3. Implement all command types
4. Expand decider for quest/narrative commands

### Sprint 2: Battle System
1. Combat resolution engine
2. Battle decider commands
3. Opponent generation
4. Battle projections

### Sprint 3: Core UI Components
1. Card component
2. NpcVoiceBox component
3. ChoiceButton component
4. GameHeader component
5. StatPill, ReputationBar, BountyDisplay

### Sprint 4: Core Loop Screens
1. Quest Hub screen
2. Narrative screen
3. Card Pool screen
4. Deployment screen
5. Battle screen
6. Consequence screen

### Sprint 5: Content & Extended Features
1. Card database (20 cards)
2. Quest 1 content (The Salvage Claim)
3. Alliance screen
4. Quest 2 content
5. Mediation screen
6. Quest 3 content

### Sprint 6: Polish & Launch
1. Reputation dashboard
2. Fleet overview
3. Ending screen (all variants)
4. Navigation polish
5. Testing & bug fixes
6. itch.io deployment

---

## Technical Notes

### Event Versioning
All events include a version field for future compatibility:
```typescript
interface BaseEvent {
  version: 1
  timestamp: string
}
```

### State Reconstruction
Game state is always rebuilt from events, never mutated:
```typescript
const state = events.reduce(evolveState, getInitialState())
```

### Performance Considerations
- Memoize projection calculations
- Use Svelte's reactive system, not manual subscriptions
- Consider event snapshots for long games (>1000 events)

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
