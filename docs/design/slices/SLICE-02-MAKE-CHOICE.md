# Slice 02: Make Choice

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to make choices during narrative dilemmas so that I can shape my captain's story, affect faction relationships, and progress through quests.

---

## Given-When-Then Specifications

### Spec 1: Make Valid Choice with Consequences
```gherkin
Given a player in narrative phase
  And dilemma "dilemma_salvage_survivors" is presented
  And the player has reputation 0 with ironveil
When the player makes choice "hand_over_survivors"
Then CHOICE_MADE event is emitted
  And REPUTATION_CHANGED event is emitted (ironveil +20)
  And appropriate phase transition occurs
```

### Spec 2: Choice Triggers Alliance Phase
```gherkin
Given a player in narrative phase
  And choice has "triggersAlliance: true" or "triggersBattle: true"
When the player makes that choice
Then CHOICE_MADE event is emitted
  And PHASE_CHANGED event is emitted (narrative → alliance)
  And ALLIANCE_PHASE_STARTED event is emitted
```

### Spec 3: Choice Triggers Mediation
```gherkin
Given a player in narrative phase
  And choice has "triggersMediation: true"
When the player makes that choice
Then CHOICE_MADE event is emitted
  And PHASE_CHANGED event is emitted (narrative → mediation)
```

### Spec 4: Invalid Choice Rejected
```gherkin
Given a player in narrative phase
  And dilemma "dilemma_salvage_survivors" is presented
When the player makes choice "invalid_choice_id"
Then an error is thrown "Choice not found: invalid_choice_id"
  And no events are emitted
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `CHOICE_MADE` | `{ timestamp, dilemmaId, choiceId, questId }` | Player selected a choice |
| `REPUTATION_CHANGED` | `{ timestamp, factionId, delta, newValue, source: 'choice' }` | Reputation modified (0-many per choice) |
| `CARD_GAINED` | `{ timestamp, cardId, factionId, source: 'choice' }` | Card awarded (0-many per choice) |
| `CARD_LOST` | `{ timestamp, cardId, factionId, reason: 'choice' }` | Card removed (0-many per choice) |
| `BOUNTY_MODIFIED` | `{ timestamp, amount, newValue, source: 'choice', reason }` | Bounty changed (0-1 per choice) |
| `FLAG_SET` | `{ timestamp, flagName, value }` | Story flag set (0-many per choice) |
| `PHASE_CHANGED` | `{ timestamp, fromPhase, toPhase }` | Phase transition |
| `ALLIANCE_PHASE_STARTED` | `{ timestamp, questId, battleContext, availableFactionIds[] }` | Alliance options available |
| `DILEMMA_PRESENTED` | `{ timestamp, dilemmaId, questId }` | Next dilemma in sequence |

### Events Consumed

| Event | Usage |
|-------|-------|
| `DILEMMA_PRESENTED` | Determines which dilemma is current |
| `QUEST_ACCEPTED` | Provides quest context |

---

## Read Model

```typescript
interface DilemmaView {
  dilemmaId: string
  situation: string  // Narrative text
  voices: Array<{
    npcName: string
    factionId: FactionId
    dialogue: string
    position: string
  }>
  choices: Array<{
    choiceId: string
    label: string
    description: string
    reputationPreviews: Array<{ factionId: FactionId; delta: number }>
    cardsGained: string[]
    cardsLost: string[]
    bountyModifier?: number
    riskDescription?: string
    riskProbability?: number
    triggersBattle: boolean
    triggersAlliance: boolean
    triggersMediation: boolean
  }>
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handler**: `src/lib/game/decider.ts` lines 388-564
- **Projection**: `src/lib/game/projections/dilemmaView.ts`
- **UI**: `src/routes/narrative/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/make-choice/command.ts`
- **Read model**: `src/lib/slices/make-choice/read-model.ts`
- **Tests**: `src/lib/slices/make-choice/tests.ts`
- **UI**: `src/routes/narrative/+page.svelte`

---

## Dependencies

### Consumes Events From
- Accept Quest slice (DILEMMA_PRESENTED)
- Consequence slice (DILEMMA_PRESENTED for post-battle dilemmas)

### Produces Events For
- Form Alliance slice (ALLIANCE_PHASE_STARTED)
- Mediation slice (PHASE_CHANGED to mediation)
- Player State view (REPUTATION_CHANGED, CARD_GAINED, BOUNTY_MODIFIED)

---

## Business Rules

1. **Must be in narrative phase**: Command rejected if `currentPhase !== 'narrative'`
2. **Must have active quest**: Command rejected if no quest active
3. **Dilemma must exist**: Dilemma ID must be in content
4. **Choice must exist**: Choice ID must be in dilemma's choices array
5. **Reputation clamped**: New reputation clamped to [-100, 100]
6. **Card must exist**: Card grants/losses validated against content

---

## Consequence Application Order

When a choice is made, consequences are applied in this order:

1. `CHOICE_MADE` - Record the choice
2. `REPUTATION_CHANGED` - Apply all reputation changes
3. `CARD_GAINED` - Grant all cards
4. `CARD_LOST` - Remove all cards
5. `BOUNTY_MODIFIED` - Apply bounty change
6. `FLAG_SET` - Set all story flags
7. `PHASE_CHANGED` / `DILEMMA_PRESENTED` - Handle flow

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│                NARRATIVE SCREEN                      │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  SITUATION                                   │    │
│  │  ─────────────────────────────────           │    │
│  │  A distress signal crackles through your    │    │
│  │  comms. The derelict's crew is alive...     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  NPC VOICE: Castellan Vorn (Ironveil)        │    │
│  │  "The contract is clear. Salvage belongs    │    │
│  │   to Ironveil. Hand them over."             │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  CHOICE: Hand Over Survivors                 │    │
│  │  ───────────────────────────────             │    │
│  │  ▲ Ironveil +20  ▼ Ashfall -10              │    │
│  │  + Ironveil Cruiser card                    │    │
│  │  [Select This Choice]                        │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  CHOICE: Release Survivors                   │    │
│  │  ───────────────────────────────             │    │
│  │  ▼ Ironveil -15  ▲ Ashfall +15              │    │
│  │  [Select This Choice]                        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
         │
         │ Click choice
         ▼
    ┌────────────────────────────────────────┐
    │  Phase transitions based on triggers:  │
    │  - triggersAlliance → /alliance        │
    │  - triggersMediation → /mediation      │
    │  - nextDilemmaId → stay /narrative     │
    │  - default → /alliance                 │
    └────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/narrative.test.ts`

### Key Test Cases
- Make choice emits CHOICE_MADE event
- Reputation changes applied correctly
- Cards granted/lost correctly
- Phase transitions work for all trigger types
- Invalid dilemma/choice rejected
- Consequences applied in correct order
