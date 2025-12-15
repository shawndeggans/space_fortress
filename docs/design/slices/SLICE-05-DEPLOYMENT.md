# Slice 05: Deployment

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to position my 5 cards in battle slots so that I can strategically match them against enemy positions.

---

## Given-When-Then Specifications

### Spec 1: Set Card Position
```gherkin
Given a player in deployment phase
  And card "ironveil_hammerhead" is in the committed fleet
  And position 3 is empty
When the player positions that card in slot 3
Then CARD_POSITIONED event is emitted
  And card appears in position 3
```

### Spec 2: Reposition Card
```gherkin
Given a player in deployment phase
  And card "ironveil_hammerhead" is in position 3
When the player moves it to position 1
Then CARD_POSITIONED event is emitted (position 1)
  And position 3 becomes empty
  And card appears in position 1
```

### Spec 3: Lock Orders (Success)
```gherkin
Given a player in deployment phase
  And all 5 positions are filled
When the player locks orders
Then ORDERS_LOCKED event is emitted
  And PHASE_CHANGED event is emitted (deployment → battle)
  And ROUND_STARTED event is emitted for round 1
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `CARD_POSITIONED` | `{ timestamp, cardId, position: 1-5 }` | Card placed in battle slot |
| `ORDERS_LOCKED` | `{ timestamp, battleId, positions[] }` | All positions finalized |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'deployment', toPhase: 'battle' }` | Begin battle |
| `ROUND_STARTED` | `{ timestamp, battleId, roundNumber: 1 }` | First round begins |

### Events Consumed

| Event | Usage |
|-------|-------|
| `FLEET_COMMITTED` | Determines which cards are available for positioning |
| `BATTLE_TRIGGERED` | Provides battleId context |

---

## Read Model

```typescript
interface DeploymentView {
  battleId: string
  slots: Array<{
    position: 1 | 2 | 3 | 4 | 5
    card: Card | null
  }>
  unpositionedCards: Card[]
  canLock: boolean  // true when all 5 slots filled
  enemyPositions?: Array<{
    position: 1 | 2 | 3 | 4 | 5
    hint?: string  // "Heavy ship detected" etc.
  }>
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handlers**: `src/lib/game/decider.ts`
  - `handleSetCardPosition()` lines ~1000-1040
  - `handleLockOrders()` lines ~1045-1100
- **Projection**: `src/lib/game/projections/deploymentView.ts`
- **UI**: `src/routes/deployment/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/deployment/command.ts`
- **Read model**: `src/lib/slices/deployment/read-model.ts`
- **Tests**: `src/lib/slices/deployment/tests.ts`
- **UI**: `src/routes/deployment/+page.svelte`

---

## Dependencies

### Consumes Events From
- Card Selection slice (FLEET_COMMITTED provides committed cards)

### Produces Events For
- Battle Resolution slice (ORDERS_LOCKED + ROUND_STARTED trigger battle)

---

## Business Rules

1. **Must be in deployment phase**: Commands rejected otherwise
2. **Card must be in committed fleet**: Cannot position cards not selected
3. **Position must be 1-5**: Invalid positions rejected
4. **All 5 positions required to lock**: Cannot proceed with empty slots

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│               DEPLOYMENT SCREEN                      │
│                                                      │
│  Position your fleet for battle                     │
│                                                      │
│  YOUR POSITIONS           ENEMY POSITIONS            │
│  ┌───────────────┐       ┌───────────────┐          │
│  │ 1: [Salvager] │  VS   │ 1: [???]      │          │
│  │    ATK:3/ARM:3│       │    Heavy ship │          │
│  └───────────────┘       └───────────────┘          │
│  ┌───────────────┐       ┌───────────────┐          │
│  │ 2: [Runner]   │  VS   │ 2: [???]      │          │
│  │    ATK:3/ARM:2│       │    Fast ship  │          │
│  └───────────────┘       └───────────────┘          │
│  ┌───────────────┐       ┌───────────────┐          │
│  │ 3: [empty]    │  VS   │ 3: [???]      │          │
│  │    drag here  │       │               │          │
│  └───────────────┘       └───────────────┘          │
│  ┌───────────────┐       ┌───────────────┐          │
│  │ 4: [empty]    │  VS   │ 4: [???]      │          │
│  └───────────────┘       └───────────────┘          │
│  ┌───────────────┐       ┌───────────────┐          │
│  │ 5: [empty]    │  VS   │ 5: [???]      │          │
│  └───────────────┘       └───────────────┘          │
│                                                      │
│  UNPOSITIONED: Scout, Freighter, Hammerhead         │
│                                                      │
│  [Lock Orders] (disabled - fill all positions)      │
└─────────────────────────────────────────────────────┘
         │
         │ Fill all positions
         │ Click [Lock Orders]
         ▼
┌─────────────────────────────────────────────────────┐
│               BATTLE SCREEN                          │
│                                                      │
│  Round 1 begins...                                  │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/battle.test.ts`

### Key Test Cases
- Position card emits CARD_POSITIONED
- Cannot position card not in fleet
- Cannot lock with empty positions
- Lock orders emits ORDERS_LOCKED and PHASE_CHANGED
- Lock orders starts round 1
