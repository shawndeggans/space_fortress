# Slice 08: Consequence

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to see the consequences of battle (bounty earned, reputation changes) and continue to the next phase of my quest.

---

## Given-When-Then Specifications

### Spec 1: Acknowledge Victory Outcome
```gherkin
Given a battle just ended
  And the outcome was 'victory'
  And bounty was 500 credits
  And alliance share was 15% (75 credits)
When the player acknowledges the outcome
Then OUTCOME_ACKNOWLEDGED event is emitted
  And net bounty (425) is recorded
  And phase transitions based on quest flow
```

### Spec 2: Continue After Battle (More Dilemmas)
```gherkin
Given player has acknowledged battle outcome
  And quest has more dilemmas
When player continues to next phase
Then PHASE_CHANGED event is emitted (consequence → narrative)
  And DILEMMA_PRESENTED event is emitted
```

### Spec 3: Quest Complete After Final Battle
```gherkin
Given player has acknowledged battle outcome
  And quest has no more dilemmas
When player continues
Then QUEST_COMPLETED event is emitted
  And PHASE_CHANGED event is emitted (consequence → quest_hub)
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `OUTCOME_ACKNOWLEDGED` | `{ timestamp, battleId }` | Player reviewed consequences |
| `BOUNTY_CALCULATED` | `{ timestamp, base, shares[], net }` | Final bounty computed |
| `QUEST_COMPLETED` | `{ timestamp, questId, outcome, finalBounty }` | Quest finished |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'consequence', toPhase }` | Exit consequence |
| `DILEMMA_PRESENTED` | `{ timestamp, dilemmaId, questId }` | Next dilemma (if any) |

### Events Consumed

| Event | Usage |
|-------|-------|
| `BATTLE_RESOLVED` | Determines victory/defeat/draw |
| `ALLIANCE_FORMED` | Calculates bounty share |
| `REPUTATION_CHANGED` (from battle) | Shows reputation consequences |

---

## Read Model

```typescript
interface ConsequenceView {
  battleId: string
  battleOutcome: 'victory' | 'defeat' | 'draw'
  bounty: {
    base: number
    allianceShares: Array<{
      factionId: FactionId
      percentage: number
      amount: number
    }>
    net: number
  }
  reputationChanges: Array<{
    factionId: FactionId
    delta: number
    newValue: number
    newStatus: ReputationStatus
    reason: string
  }>
  cardsChanged: Array<{
    action: 'gained' | 'lost'
    card: Card
    reason: string
  }>
  narrativeText: string  // Contextual description
  nextStep: 'continue_quest' | 'quest_complete' | 'game_over'
  questProgress?: {
    dilemmasCompleted: number
    totalDilemmas: number
  }
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handlers**: `src/lib/game/decider.ts`
  - `handleAcknowledgeOutcome()` lines ~1100-1140
  - `handleContinueToNextPhase()` lines ~1145-1200
- **Projection**: `src/lib/game/projections/consequenceView.ts`
- **UI**: `src/routes/consequence/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/consequence/command.ts`
- **Read model**: `src/lib/slices/consequence/read-model.ts`
- **Tests**: `src/lib/slices/consequence/tests.ts`
- **UI**: `src/routes/consequence/+page.svelte`

---

## Dependencies

### Consumes Events From
- Battle Resolution slice (BATTLE_RESOLVED triggers consequence screen)
- Mediation slice (COMPROMISE_ACCEPTED triggers consequence)
- Form Alliance slice (ALLIANCE_FORMED for bounty share calculation)

### Produces Events For
- Make Choice slice (DILEMMA_PRESENTED for next narrative)
- Accept Quest slice (QUEST_COMPLETED returns to quest hub)
- Game End slice (GAME_ENDED if all quests complete)

---

## Business Rules

1. **Must acknowledge outcome**: Cannot proceed without viewing consequences
2. **Bounty share is automatic**: Alliance shares deducted automatically
3. **Defeat has penalties**: May lose reputation, cards, or bounty
4. **Quest flow determined by content**: Next step depends on quest structure

---

## Bounty Calculation

```
Base Bounty: Quest base + battle bonus
- Alliance 1 share: Base × share%
- Alliance 2 share: Base × share%
= Net Bounty
```

Example:
- Base: 500 credits
- Ironveil alliance (15%): -75 credits
- Net: 425 credits

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│             CONSEQUENCE SCREEN                       │
│                                                      │
│  🏆 BATTLE VICTORY                                   │
│                                                      │
│  The enemy fleet is scattered. You've secured       │
│  the salvage and the survivors are safe.            │
│                                                      │
│  BOUNTY                                              │
│  ─────────────────────────────────────              │
│  Base Reward:           500 credits                 │
│  Ironveil Share (15%): -75 credits                  │
│  ─────────────────────────────────────              │
│  Net Bounty:            425 credits                 │
│                                                      │
│  REPUTATION                                          │
│  ─────────────────────────────────────              │
│  Ironveil:  ▲ +15 (Neutral → Friendly)             │
│  Ashfall:   ▼ -5  (Neutral)                        │
│                                                      │
│  CARDS                                               │
│  ─────────────────────────────────────              │
│  No cards changed                                   │
│                                                      │
│  QUEST PROGRESS                                      │
│  Dilemma 1 of 3 complete                            │
│                                                      │
│  [Continue Quest]                                   │
└─────────────────────────────────────────────────────┘
         │
         │ Click [Continue Quest]
         ▼
    ┌────────────────────────────────────────┐
    │  If more dilemmas → /narrative         │
    │  If quest complete → /quest-hub        │
    │  If game complete → /ending            │
    └────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/consequence.test.ts`

### Key Test Cases
- Acknowledge outcome records event
- Bounty share calculated correctly
- Victory shows positive narrative
- Defeat shows negative narrative
- Continue goes to next dilemma if available
- Continue completes quest if no more dilemmas
