# Slice 04: Card Selection

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to select 5 cards from my fleet for the upcoming battle so that I can choose my best tactical composition.

---

## Given-When-Then Specifications

### Spec 1: Select Card for Battle
```gherkin
Given a player in card_selection phase
  And the player has 6 available cards
  And the player has selected 3 cards
When the player selects another card
Then CARD_SELECTED event is emitted
  And selection count increases to 4
```

### Spec 2: Deselect Card
```gherkin
Given a player in card_selection phase
  And the player has selected 4 cards
  And card "ironveil_hammerhead" is selected
When the player deselects that card
Then CARD_DESELECTED event is emitted
  And selection count decreases to 3
```

### Spec 3: Commit Fleet (Success)
```gherkin
Given a player in card_selection phase
  And the player has selected exactly 5 cards
When the player commits the fleet
Then FLEET_COMMITTED event is emitted
  And PHASE_CHANGED event is emitted (card_selection → deployment)
```

### Spec 4: Cannot Commit with Wrong Count
```gherkin
Given a player in card_selection phase
  And the player has selected 4 cards
When the player tries to commit the fleet
Then an error is thrown "Must select exactly 5 cards"
  And no events are emitted
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `CARD_SELECTED` | `{ timestamp, cardId, battleId }` | Card added to selection |
| `CARD_DESELECTED` | `{ timestamp, cardId, battleId }` | Card removed from selection |
| `FLEET_COMMITTED` | `{ timestamp, battleId, cardIds[] }` | Fleet finalized for battle |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'card_selection', toPhase: 'deployment' }` | Proceed to deployment |

### Events Consumed

| Event | Usage |
|-------|-------|
| `BATTLE_TRIGGERED` | Provides battleId context |
| `CARD_GAINED` | Determines available cards |
| `CARD_LOST` | Removes cards from pool |

---

## Read Model

```typescript
interface CardPoolView {
  battleId: string
  availableCards: Array<{
    id: string
    name: string
    faction: FactionId
    attack: number
    armor: number
    agility: number
    source: 'starter' | 'quest' | 'alliance' | 'choice'
    isSelected: boolean
    isLocked: boolean
    lockReason?: string
  }>
  selectedCardIds: string[]
  selectedCount: number
  requiredCount: 5
  canCommit: boolean  // selectedCount === 5
  opponentPreview?: {
    factionHint: string
    difficulty: string
  }
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handlers**: `src/lib/game/decider.ts`
  - `handleSelectCard()` lines ~870-910
  - `handleDeselectCard()` lines ~915-945
  - `handleCommitFleet()` lines ~950-990
- **Projection**: `src/lib/game/projections/cardPool.ts`
- **UI**: `src/routes/card-pool/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/card-selection/command.ts`
- **Read model**: `src/lib/slices/card-selection/read-model.ts`
- **Tests**: `src/lib/slices/card-selection/tests.ts`
- **UI**: `src/routes/card-pool/+page.svelte`

---

## Dependencies

### Consumes Events From
- Form Alliance slice (BATTLE_TRIGGERED provides context)
- Card events (CARD_GAINED determines available cards)

### Produces Events For
- Deployment slice (PHASE_CHANGED triggers deployment screen)
- Battle slice (FLEET_COMMITTED sets player fleet)

---

## Business Rules

1. **Must be in card_selection phase**: Commands rejected otherwise
2. **Card must be available**: Must be in ownedCards and not locked
3. **Cannot select same card twice**: Duplicate selection rejected
4. **Maximum 5 cards**: Cannot select more than 5
5. **Must select exactly 5**: Cannot commit with fewer or more
6. **Card cannot be locked**: Damaged or locked cards not selectable

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│              CARD SELECTION SCREEN                   │
│                                                      │
│  Select 5 cards for battle                          │
│  Selected: 3/5                                       │
│                                                      │
│  YOUR FLEET                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │Salvager │ │System   │ │Armed    │ │Scout    │    │
│  │ATK:3    │ │Runner   │ │Freighter│ │ATK:3    │    │
│  │ARM:3    │ │ATK:3    │ │ATK:2    │ │ARM:1    │    │
│  │AGI:2    │ │ARM:2    │ │ARM:4    │ │AGI:3    │    │
│  │[✓]      │ │[✓]      │ │[ ]      │ │[✓]      │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                      │
│  ALLIANCE CARDS (Ironveil)                          │
│  ┌─────────┐ ┌─────────┐                            │
│  │Hammer-  │ │Creditor │                            │
│  │head     │ │ATK:6    │                            │
│  │ATK:5    │ │ARM:3    │                            │
│  │ARM:4    │ │AGI:1    │                            │
│  │AGI:1    │ │[ ]      │                            │
│  │[ ]      │ └─────────┘                            │
│  └─────────┘                                        │
│                                                      │
│  [Commit Fleet] (disabled - need 5 cards)           │
└─────────────────────────────────────────────────────┘
         │
         │ Select 2 more cards
         │ Click [Commit Fleet]
         ▼
┌─────────────────────────────────────────────────────┐
│              DEPLOYMENT SCREEN                       │
│                                                      │
│  Position your cards for battle...                  │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/battle.test.ts`

### Key Test Cases
- Select card adds to selection
- Deselect card removes from selection
- Cannot select already-selected card
- Cannot select locked card
- Commit requires exactly 5 cards
- Commit emits FLEET_COMMITTED and PHASE_CHANGED
