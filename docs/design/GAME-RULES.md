# Space Fortress Game Rules

This document defines all business rules using the **Given-When-Then** format from event modeling. These rules are invariants that the decider must enforce to prevent invalid game states.

---

## Table of Contents

1. [Rule Format](#rule-format)
2. [Game Initialization](#game-initialization)
3. [Quest System](#quest-system)
4. [Narrative & Choices](#narrative--choices)
5. [Alliance System](#alliance-system)
6. [Card Economy](#card-economy)
7. [Battle System](#battle-system)
8. [Phase Transitions](#phase-transitions)
9. [Critical Invariants](#critical-invariants)

---

## Rule Format

Each rule follows this structure:

```
RULE: [Rule Name]
GIVEN: [Precondition - the current state]
WHEN:  [Command - what the player attempts]
THEN:  [Outcome - events generated OR error thrown]
```

Rules are grouped by game system. Each rule includes:
- **Invariant**: The business logic being enforced
- **Rationale**: Why this rule exists
- **Implementation**: Where in code this is enforced

---

## Game Initialization

### RULE: Start New Game
```
GIVEN: No active game exists
WHEN:  START_GAME command issued
THEN:
  - GAME_STARTED event emitted
  - CARD_GAINED events for 4 starter cards:
    - starter_salvager (attack: 2, armor: 3, agility: 2)
    - starter_runner (attack: 1, armor: 1, agility: 4)
    - starter_freighter (attack: 1, armor: 4, agility: 1)
    - starter_scout (attack: 3, armor: 1, agility: 3)
  - Phase set to 'quest_hub'
  - Player starts with 0 bounty
  - All faction reputations start at 0
```

**Invariant**: Player always starts with exactly 4 cards
**Rationale**: Provides base fleet, but not enough for battle (5 required)
**Implementation**: `decider.ts` START_GAME handler

---

## Quest System

### RULE: Accept Quest - Basic Validation
```
GIVEN: Player is in 'quest_hub' phase
       Player has no active quest
       Quest exists and is not completed
WHEN:  ACCEPT_QUEST command with questId
THEN:
  - QUEST_ACCEPTED event emitted
  - CARD_GAINED event for quest-specific card
  - Phase transitions to 'narrative'
```

**Invariant**: One active quest at a time
**Implementation**: `decider.ts` lines 45-67

### RULE: Accept Quest - Reputation Requirement
```
GIVEN: Quest requires minimum reputation with a faction
       Player's reputation with that faction < required
WHEN:  ACCEPT_QUEST command for that quest
THEN:  InvalidCommandError("Insufficient reputation with {faction}")
```

**Invariant**: Quests have reputation gates
**Rationale**: Creates progression through faction relationships
**Implementation**: `decider.ts` reputation check

### RULE: Accept Quest - Completed Quest
```
GIVEN: Player has already completed quest Q
WHEN:  ACCEPT_QUEST command for quest Q
THEN:  InvalidCommandError("Quest already completed")
```

**Invariant**: Quests cannot be replayed
**Implementation**: `decider.ts` completedQuests check

### RULE: Quest Card Grants
```
Quest ID          | Card Granted
------------------|------------------
salvage_run       | salvage_cutter
pirate_hunt       | hunter_corvette
escort_mission    | escort_frigate
```

**Invariant**: Each quest provides exactly 1 card
**Rationale**: Ensures player has 5 cards (4 starter + 1 quest) minimum before first battle
**Implementation**: `content/quests.ts` questCards mapping

---

## Narrative & Choices

### RULE: Make Choice - Valid Phase
```
GIVEN: Player is in 'narrative' or 'post_battle_dilemma' phase
       Dilemma is currently active
       Choice exists in current dilemma
WHEN:  MAKE_CHOICE command with dilemmaId and choiceId
THEN:
  - CHOICE_MADE event emitted
  - Consequence events based on choice:
    - REPUTATION_CHANGED (0 to many)
    - CARD_GAINED (0 to many)
    - CARD_LOST (0 to many)
    - BOUNTY_CHANGED (0 or 1)
  - Phase may transition based on quest flow
```

**Implementation**: `decider.ts` MAKE_CHOICE handler

### RULE: Make Choice - Invalid Dilemma
```
GIVEN: Current dilemma ID !== command.dilemmaId
WHEN:  MAKE_CHOICE command
THEN:  InvalidCommandError("Invalid dilemma")
```

**Invariant**: Choices must match current dilemma
**Implementation**: `decider.ts` dilemma validation

### RULE: Make Choice - Invalid Choice
```
GIVEN: Choice ID not in current dilemma's options
WHEN:  MAKE_CHOICE command
THEN:  InvalidCommandError("Invalid choice")
```

**Invariant**: Can only select available choices
**Implementation**: `decider.ts` choice validation

### RULE: Choice Consequences - Card Grants
```
Choice consequences may grant cards:
- 0 cards: Most choices
- 1-2 cards: Significant choices
- 3 cards: Exceptional choices (rare)

Example from salvage_run quest:
- Choice "share_with_survivors" → grants 'survivor_shuttle'
- Choice "take_everything" → grants nothing, reputation penalty
```

**Invariant**: Card grants are deterministic per choice
**Implementation**: `content/quests.ts` choice consequences

### RULE: Choice Consequences - Card Loss
```
GIVEN: Choice consequence includes cardLoss
       Player owns the specified card
WHEN:  MAKE_CHOICE command selecting that choice
THEN:  CARD_LOST event emitted for that card
```

**Invariant**: Cannot lose cards you don't own
**Rationale**: Prevents negative card counts
**Implementation**: `decider.ts` card loss validation

---

## Alliance System

### RULE: Form Alliance - Reputation Threshold
```
GIVEN: Player is in 'alliance' phase
       Player reputation with faction >= -20 (not hostile)
WHEN:  FORM_ALLIANCE command with factionId
THEN:
  - ALLIANCE_FORMED event emitted
  - 2 faction-specific cards become available
  - Bounty share percentage set based on reputation
  - Phase transitions to 'card_selection'
```

**Invariant**: Cannot ally with hostile factions
**Implementation**: `decider.ts` FORM_ALLIANCE handler

### RULE: Form Alliance - Hostile Faction
```
GIVEN: Player reputation with faction < -20
WHEN:  FORM_ALLIANCE command with that factionId
THEN:  InvalidCommandError("Faction is hostile")
```

**Invariant**: Reputation gates alliance availability
**Implementation**: `decider.ts` reputation check

### RULE: Alliance Card Provision
```
Faction        | Cards Provided (2 each)
---------------|-------------------------
ironveil       | Hammerhead, The Creditor
ashfall        | Phoenix Rising, Redhawk
meridian       | Negotiator, Deal Broker
void_wardens   | Bulwark, Sentinel
sundered_oath  | Oathbreaker, Betrayer's Edge
```

**Invariant**: Each alliance provides exactly 2 cards
**Rationale**: Supplements player deck for battle variety
**Implementation**: `content/factions.ts` allianceCards

### RULE: Alliance Bounty Share
```
Reputation Level | Bounty Share
-----------------|-------------
Revered (80+)    | 10%
Friendly (40+)   | 15%
Neutral (0+)     | 20%
Suspicious (-20+)| 25%
```

**Invariant**: Better reputation = better alliance terms
**Implementation**: `decider.ts` bounty calculation

### RULE: Decline All Alliances
```
GIVEN: Player is in 'alliance' phase
WHEN:  DECLINE_ALL_ALLIANCES command
THEN:
  - ALLIANCE_DECLINED event emitted
  - No alliance cards available
  - Phase transitions to 'card_selection'
```

**Invariant**: Alliance is optional
**Rationale**: Player may prefer full bounty over alliance cards
**Implementation**: `decider.ts` DECLINE_ALL_ALLIANCES handler

---

## Card Economy

### RULE: Card Pool Composition
```
GIVEN: Player entering card_selection phase
THEN:  Available cards = owned cards + alliance cards (if any)

Card Sources:
- Starter cards: 4 (always)
- Quest cards: 1 per accepted quest
- Choice rewards: 0-3 per quest
- Alliance cards: 0 or 2
```

**Invariant**: Card pool includes all available sources
**Implementation**: `projections/cardPool.ts`

### RULE: Minimum Cards for Battle
```
GIVEN: Player attempting to enter card_selection phase
WHEN:  Total available cards < 5
THEN:  Player cannot proceed to battle
```

**CRITICAL INVARIANT**: Player must have >= 5 cards to battle
**Rationale**: Battle requires exactly 5 cards; fewer = deadlock
**Current Status**: NOT FULLY IMPLEMENTED - See Critical Invariants section

### RULE: Card Ownership Tracking
```
GIVEN: Card granted via CARD_GAINED event
THEN:  Card added to state.ownedCards

GIVEN: Card removed via CARD_LOST event
THEN:  Card removed from state.ownedCards
```

**Invariant**: Owned cards accurately reflect event history
**Implementation**: `projections.ts` evolveState

---

## Battle System

### RULE: Select Card for Battle
```
GIVEN: Player is in 'card_selection' phase
       Card is in available pool (owned OR alliance)
       Card is not locked
       Current selection count < 5
WHEN:  SELECT_CARD command with cardId
THEN:  CARD_SELECTED event emitted
```

**Implementation**: `decider.ts` SELECT_CARD handler

### RULE: Select Card - Already Selected
```
GIVEN: Card is already in current selection
WHEN:  SELECT_CARD command for same card
THEN:  InvalidCommandError("Card already selected")
```

**Invariant**: No duplicate selections
**Implementation**: `decider.ts` selection check

### RULE: Select Card - Fleet Full
```
GIVEN: Player has already selected 5 cards
WHEN:  SELECT_CARD command
THEN:  InvalidCommandError("Fleet is full")
```

**Invariant**: Maximum 5 cards per battle
**Implementation**: `decider.ts` MAX_FLEET_SIZE check

### RULE: Select Card - Card Locked
```
GIVEN: Card has isLocked = true (e.g., damaged)
WHEN:  SELECT_CARD command for that card
THEN:  InvalidCommandError("Card is locked")
```

**Invariant**: Locked cards cannot be selected
**Implementation**: `decider.ts` lock check

### RULE: Deselect Card
```
GIVEN: Player is in 'card_selection' phase
       Card is currently selected
WHEN:  DESELECT_CARD command with cardId
THEN:  CARD_DESELECTED event emitted
```

**Implementation**: `decider.ts` DESELECT_CARD handler

### RULE: Commit Fleet
```
GIVEN: Player is in 'card_selection' phase
       Exactly 5 cards are selected
WHEN:  COMMIT_FLEET command with cardIds array
THEN:
  - FLEET_COMMITTED event emitted
  - Phase transitions to 'deployment'
```

**Implementation**: `decider.ts` lines 909-911

### RULE: Commit Fleet - Insufficient Cards
```
GIVEN: Player has < 5 cards selected
WHEN:  COMMIT_FLEET command
THEN:  InvalidCommandError("Must select exactly 5 cards")
```

**CRITICAL INVARIANT**: Battle requires exactly 5 cards
**Implementation**: `decider.ts` selection count check

### RULE: Lock Orders (Deployment)
```
GIVEN: Player is in 'deployment' phase
       All 5 cards assigned to positions 1-5
WHEN:  LOCK_ORDERS command with positions array
THEN:
  - ORDERS_LOCKED event emitted
  - Phase transitions to 'battle'
  - Battle execution begins
```

**Implementation**: `decider.ts` LOCK_ORDERS handler

### RULE: Battle Resolution
```
GIVEN: Player is in 'battle' phase
       Orders are locked
WHEN:  Battle executes automatically
THEN:
  - 5 rounds execute (position 1 vs 1, 2 vs 2, etc.)
  - Each round: ROUND_RESOLVED event
  - BATTLE_RESOLVED event with outcome (victory/defeat/draw)
  - Phase transitions to 'consequence'
```

**Invariant**: Battle is deterministic given card positions
**Implementation**: `combat.ts` resolveBattle

### RULE: Round Resolution
```
Each round compares cards:
1. Higher agility attacks first
2. Damage = attacker.attack - defender.armor (minimum 0)
3. If damage > 0, defending card takes hit
4. Winner = card that survives or deals more damage
```

**Invariant**: Combat math is deterministic
**Implementation**: `combat.ts` resolveRound

---

## Phase Transitions

### RULE: Valid Phase Transitions
```
quest_hub → narrative (ACCEPT_QUEST)
narrative → alliance (after pre-battle choices)
narrative → post_battle_dilemma (after battle, more choices)
alliance → card_selection (FORM_ALLIANCE or DECLINE_ALL_ALLIANCES)
card_selection → deployment (COMMIT_FLEET)
deployment → battle (LOCK_ORDERS)
battle → consequence (BATTLE_RESOLVED)
consequence → narrative (ACKNOWLEDGE_OUTCOME, more dilemmas)
consequence → quest_hub (ACKNOWLEDGE_OUTCOME, quest complete)
consequence → ending (ACKNOWLEDGE_OUTCOME, game complete)
```

### RULE: Phase-Gated Commands
```
Command               | Valid Phase(s)
----------------------|----------------------------------
START_GAME            | (no game)
ACCEPT_QUEST          | quest_hub
MAKE_CHOICE           | narrative, post_battle_dilemma
FORM_ALLIANCE         | alliance
DECLINE_ALL_ALLIANCES | alliance
SELECT_CARD           | card_selection
DESELECT_CARD         | card_selection
COMMIT_FLEET          | card_selection
LOCK_ORDERS           | deployment
ACKNOWLEDGE_OUTCOME   | consequence
```

**Invariant**: Commands only valid in specific phases
**Implementation**: `decider.ts` phase checks on each handler

### RULE: Invalid Phase Command
```
GIVEN: Player is in phase P
       Command C is not valid in phase P
WHEN:  Command C issued
THEN:  InvalidCommandError("Invalid command for current phase")
```

**Invariant**: Phase gates prevent invalid state transitions
**Implementation**: `decider.ts` phase validation

---

## Critical Invariants

These are the highest-priority rules that prevent game-breaking states.

### INVARIANT 1: No Deadlocks from Insufficient Cards

```
RULE: Minimum Card Guarantee Before Battle
GIVEN: Player is about to transition to card_selection phase
WHEN:  Total available cards (owned + potential alliance) < 5
THEN:  System must prevent this state OR provide escape route

Current State: ✅ IMPLEMENTED
Solution: FINALIZE_ALLIANCES command validates minimum 5 cards before transitioning
Implementation: decider.ts handleFinalizeAlliances() checks ownedCards.length >= 5
```

**How it works**:
- Player stays in alliance phase until they have enough cards
- Error message guides player: "Need 5 cards for battle but only have X. Form more alliances to continue."

### INVARIANT 2: Alliance Cards Must Be Available

```
RULE: Alliance Cards in Card Pool
GIVEN: Player has formed alliance with faction F
WHEN:  Entering card_selection phase
THEN:  Alliance cards from faction F must be in available pool

Current State: ✅ IMPLEMENTED
Solution: FORM_ALLIANCE command emits CARD_GAINED events for each alliance card
Implementation: decider.ts handleFormAlliance() generates CARD_GAINED for 2 faction cards
```

**How it works**:
- Alliance cards are added to ownedCards via CARD_GAINED events
- Cards appear in card pool projection automatically
- Source tracked as 'alliance' for display purposes

### INVARIANT 3: Card Loss Cannot Create Unwinnable State

```
RULE: Safe Card Loss
GIVEN: Choice consequence would remove card(s)
       Resulting card count would be < 5
       Player has no way to gain more cards before battle
WHEN:  MAKE_CHOICE command selecting that choice
THEN:  Either prevent card loss OR guarantee card replacement

Current State: NOT IMPLEMENTED
Problem: Choices can reduce cards below battle minimum
Impact: Creates unwinnable state if too many cards lost
```

**Required Fix Options**:
1. Validate card count after loss before allowing choice
2. Ensure every card loss choice also grants replacement
3. Add warning UI and confirmation for risky choices

### INVARIANT 4: Quest Structure Must Guarantee Progression

```
RULE: Quest Minimum Card Guarantee
GIVEN: Player starts with 4 cards
       Quest grants 1 card on acceptance
       Choices may grant/lose cards
THEN:  Every quest path must result in >= 5 available cards before battle

Analysis of Current Quests:
- salvage_run: 4 + 1 = 5 ✓ (if no card loss choices)
- pirate_hunt: 4 + 1 = 5 ✓ (if no card loss choices)
- escort_mission: 4 + 1 = 5 ✓ (if no card loss choices)

With Alliance: 4 + 1 + 2 = 7 ✓
Without Alliance: 4 + 1 = 5 (exactly minimum, no margin for loss)
```

**Required**: Audit all choice paths for card balance

### INVARIANT 5: Save/Load State Integrity

```
RULE: Saveable State Validity
GIVEN: Game state at any point
WHEN:  Save and reload
THEN:  Reloaded state must be valid and playable

Current State: ✅ IMPLEMENTED
Solution: Event-based persistence with localStorage
Implementation: gameStore.ts saveGame/loadGame using event replay
```

**How it works**:
- Save stores events + metadata (phase, bounty, etc.)
- Load replays events through evolveState to rebuild state
- Main menu shows save previews with phase, bounty info

---

## Appendix: Card Inventory by Source

### Starter Cards (4)
| Card ID | Name | Attack | Armor | Agility |
|---------|------|--------|-------|---------|
| starter_salvager | Salvage Barge | 2 | 3 | 2 |
| starter_runner | Blockade Runner | 1 | 1 | 4 |
| starter_freighter | Heavy Freighter | 1 | 4 | 1 |
| starter_scout | Scout Vessel | 3 | 1 | 3 |

### Quest Cards (1 per quest)
| Quest | Card ID | Name |
|-------|---------|------|
| salvage_run | salvage_cutter | Salvage Cutter |
| pirate_hunt | hunter_corvette | Hunter Corvette |
| escort_mission | escort_frigate | Escort Frigate |

### Alliance Cards (2 per faction)
| Faction | Cards |
|---------|-------|
| ironveil | Hammerhead, The Creditor |
| ashfall | Phoenix Rising, Redhawk |
| meridian | Negotiator, Deal Broker |
| void_wardens | Bulwark, Sentinel |
| sundered_oath | Oathbreaker, Betrayer's Edge |

### Choice Reward Cards (variable)
Documented per quest in `content/quests.ts`

---

## Implementation Checklist

- [x] Add minimum card check before `card_selection` phase transition (FINALIZE_ALLIANCES)
- [x] Include alliance cards in `cardPool.ts` projection (via CARD_GAINED events)
- [ ] Add card count validation to choice consequences
- [ ] Audit all quest paths for card balance
- [ ] Add "forfeit" option as escape valve
- [x] Implement save/load system with state validation
- [ ] Add UI warnings for risky card-losing choices

---

*Document Version: 1.1*
*Last Updated: 2025-12-15*
*Reference: Event Modeling methodology from designdoc.md*
