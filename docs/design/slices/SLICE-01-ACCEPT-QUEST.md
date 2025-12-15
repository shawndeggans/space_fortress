# Slice 01: Accept Quest

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to accept a quest from the Quest Hub so that I can begin a narrative adventure and earn bounty.

---

## Given-When-Then Specifications

### Spec 1: Accept Available Quest
```gherkin
Given a player in quest_hub phase
  And the quest "quest_salvage_claim" is available
  And the player has no active quest
When the player accepts the quest
Then QUEST_ACCEPTED event is emitted
  And PHASE_CHANGED event is emitted (quest_hub → narrative)
  And DILEMMA_PRESENTED event is emitted with first dilemma
```

### Spec 2: Cannot Accept When Quest Already Active
```gherkin
Given a player with an active quest
When the player tries to accept another quest
Then an error is thrown "Already have an active quest"
  And no events are emitted
```

### Spec 3: Cannot Accept Non-Existent Quest
```gherkin
Given a player in quest_hub phase
When the player tries to accept quest "invalid_quest_id"
Then an error is thrown "Quest not found: invalid_quest_id"
  And no events are emitted
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `QUEST_ACCEPTED` | `{ timestamp, questId, factionId, initialBounty, initialCardIds[] }` | Quest has been accepted by player |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'quest_hub', toPhase: 'narrative' }` | Game phase transitions to narrative |
| `DILEMMA_PRESENTED` | `{ timestamp, dilemmaId, questId }` | First dilemma of quest is presented |

### Events Consumed

| Event | Usage |
|-------|-------|
| `GAME_STARTED` | Determines quest_hub is accessible |
| `QUEST_COMPLETED` / `QUEST_FAILED` | Determines which quests are available |

---

## Read Model

```typescript
interface QuestAcceptanceView {
  // Quest list for display
  availableQuests: Array<{
    id: string
    title: string
    faction: FactionId
    description: string
    initialBounty: number
    reputationRequired: number
    isLocked: boolean
    lockReason?: string
  }>

  // Current state
  hasActiveQuest: boolean
  completedQuestIds: string[]
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handler**: `src/lib/game/decider.ts` lines 308-366
- **Projection**: `src/lib/game/projections/questList.ts`
- **UI**: `src/routes/quest-hub/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/accept-quest/command.ts`
- **Read model**: `src/lib/slices/accept-quest/read-model.ts`
- **Tests**: `src/lib/slices/accept-quest/tests.ts`
- **UI**: `src/routes/quest-hub/+page.svelte`

---

## Dependencies

### Consumes Events From
- Game initialization slice (GAME_STARTED)
- Consequence slice (QUEST_COMPLETED, QUEST_FAILED)

### Produces Events For
- Make Choice slice (DILEMMA_PRESENTED triggers narrative)
- Player State view (QUEST_ACCEPTED updates header)

---

## Business Rules

1. **One active quest at a time**: Cannot accept quest if `state.activeQuest` exists
2. **Quest must exist**: Quest ID must be in content/quests.ts
3. **Quest must have dilemmas**: Quest must have at least one dilemma defined
4. **Game must be in progress**: Cannot accept quest if game hasn't started

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│                    QUEST HUB                         │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Quest Card: The Salvage Claim              │    │
│  │  ─────────────────────────────────          │    │
│  │  Faction: Ironveil Syndicate               │    │
│  │  Bounty: 500 credits                       │    │
│  │                                             │    │
│  │  A derelict freighter drifts near the      │    │
│  │  contested zone...                         │    │
│  │                                             │    │
│  │  [Accept Quest]  [View Details]            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Quest Card: The Sanctuary Run              │    │
│  │  (locked - requires Friendly with Ashfall)  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
         │
         │ Click [Accept Quest]
         ▼
┌─────────────────────────────────────────────────────┐
│              NARRATIVE SCREEN                        │
│                                                      │
│  First dilemma of the quest is presented...         │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/quest.test.ts`

### Key Test Cases
- Accept quest emits correct events
- Cannot accept with active quest
- Cannot accept non-existent quest
- Cannot accept without started game
