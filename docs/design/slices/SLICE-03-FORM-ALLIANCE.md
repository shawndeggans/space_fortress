# Slice 03: Form Alliance

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to form alliances with factions before battle so that I can gain additional cards for my fleet and share in the bounty rewards.

---

## Given-When-Then Specifications

### Spec 1: Form Alliance with Friendly Faction
```gherkin
Given a player in alliance phase
  And the player has neutral or better reputation with ironveil
When the player forms alliance with ironveil
Then ALLIANCE_FORMED event is emitted with bounty share percentage
  And CARD_GAINED events are emitted for 2 faction cards
  And player remains in alliance phase (can form more alliances)
```

### Spec 2: Cannot Ally with Hostile Faction
```gherkin
Given a player in alliance phase
  And the player has hostile reputation (-75 or below) with ironveil
When the player tries to form alliance with ironveil
Then an error is thrown "Faction is hostile and will not ally with you"
  And no events are emitted
```

### Spec 3: Finalize Alliances (Proceed to Battle)
```gherkin
Given a player in alliance phase
  And the player has at least 5 cards (owned + alliance)
When the player finalizes alliances
Then BATTLE_TRIGGERED event is emitted
  And PHASE_CHANGED event is emitted (alliance → card_selection)
```

### Spec 4: Cannot Finalize with Insufficient Cards
```gherkin
Given a player in alliance phase
  And the player has only 4 cards
When the player tries to finalize alliances
Then an error is thrown "Need 5 cards for battle but only have 4"
  And player must form more alliances to continue
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `ALLIANCE_FORMED` | `{ timestamp, factionId, bountyShare, cardIdsProvided[], isSecret }` | Alliance established |
| `CARD_GAINED` | `{ timestamp, cardId, factionId, source: 'alliance' }` | 2 cards per alliance |
| `ALLIANCE_REJECTED` | `{ timestamp, factionId }` | Player declined specific faction |
| `ALLIANCES_DECLINED` | `{ timestamp, questId }` | Player proceeds without allies |
| `BATTLE_TRIGGERED` | `{ timestamp, battleId, questId, context, opponentType, difficulty }` | Battle is imminent |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'alliance', toPhase: 'card_selection' }` | Transition to card selection |

### Events Consumed

| Event | Usage |
|-------|-------|
| `ALLIANCE_PHASE_STARTED` | Determines alliance options available |
| `REPUTATION_CHANGED` | Determines faction availability and terms |
| `CARD_GAINED` | Tracks total cards for minimum validation |

---

## Read Model

```typescript
interface AllianceOptionsView {
  context: string  // "Battle ahead - choose your allies wisely"
  factionOptions: Array<{
    factionId: FactionId
    factionName: string
    available: boolean
    unavailableReason?: string  // "Reputation too low" or "Faction is hostile"
    currentReputation: number
    reputationStatus: ReputationStatus
    bountyShare: number  // Percentage of bounty to share
    cards: Array<{
      id: string
      name: string
      attack: number
      armor: number
      agility: number
    }>
  }>
  currentAlliances: Array<{
    factionId: FactionId
    bountyShare: number
    cardsProvided: string[]
  }>
  canProceedAlone: boolean
  canFinalize: boolean  // true if ownedCards >= 5
  cardCount: number
  minimumRequired: number  // 5
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handlers**: `src/lib/game/decider.ts`
  - `handleFormAlliance()` lines 607-665
  - `handleFinalizeAlliances()` lines 733-778
  - `handleDeclineAllAlliances()` lines 682-730
- **Projection**: `src/lib/game/projections/allianceView.ts`
- **UI**: `src/routes/alliance/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/form-alliance/command.ts`
- **Read model**: `src/lib/slices/form-alliance/read-model.ts`
- **Tests**: `src/lib/slices/form-alliance/tests.ts`
- **UI**: `src/routes/alliance/+page.svelte`

---

## Dependencies

### Consumes Events From
- Make Choice slice (ALLIANCE_PHASE_STARTED triggers alliance screen)
- Previous game events (REPUTATION_CHANGED determines availability)
- Card events (CARD_GAINED determines if minimum met)

### Produces Events For
- Card Selection slice (PHASE_CHANGED triggers card pool)
- Battle slice (BATTLE_TRIGGERED sets up battle)
- Player State view (CARD_GAINED updates header)

---

## Business Rules

### Alliance Availability
| Reputation Status | Can Ally? | Bounty Share |
|-------------------|-----------|--------------|
| Devoted (75+) | Yes | 15% |
| Friendly (25-74) | Yes | 25% |
| Neutral (-24 to 24) | Yes | 30% |
| Unfriendly (-74 to -25) | Yes | 30% |
| Hostile (-75 or below) | **No** | N/A |

### Card Provision
- Each alliance provides exactly 2 cards
- Cards are faction-specific (see `content/cards.ts`)
- Cards are added to `ownedCards` via `CARD_GAINED` events

### Minimum Card Requirement
- Player must have at least 5 cards to proceed to battle
- If player has < 5 cards, they must form alliances
- Error message guides player: "Need 5 cards for battle but only have X"

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│                 ALLIANCE SCREEN                      │
│                                                      │
│  Context: Battle ahead - choose your allies wisely  │
│  Cards: 4/5 minimum (need 1 more)                   │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Ironveil Syndicate                          │    │
│  │  ─────────────────────────────────           │    │
│  │  Reputation: Neutral (0)                     │    │
│  │  Bounty Share: 30%                          │    │
│  │  Cards: Hammerhead, The Creditor            │    │
│  │                                              │    │
│  │  [Form Alliance]                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Ashfall Remnants                            │    │
│  │  ─────────────────────────────────           │    │
│  │  Reputation: Hostile (-80)                  │    │
│  │  ⚠️ Will not ally with you                   │    │
│  │                                              │    │
│  │  [Unavailable]                               │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Current Alliances: None                            │
│                                                      │
│  [Continue to Battle] (disabled - need more cards)  │
│  [Proceed Alone] (disabled - need 5 cards)          │
└─────────────────────────────────────────────────────┘
         │
         │ Form alliance → Cards: 6/5 minimum ✓
         │ Click [Continue to Battle]
         ▼
┌─────────────────────────────────────────────────────┐
│              CARD SELECTION SCREEN                   │
│                                                      │
│  Select 5 cards for battle...                       │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/alliance.test.ts`

### Key Test Cases
- Form alliance emits correct events with bounty share
- Alliance cards granted via CARD_GAINED events
- Cannot ally with hostile faction
- Cannot finalize with < 5 cards
- Finalize triggers BATTLE_TRIGGERED and PHASE_CHANGED
- Multiple alliances can be formed before finalizing
