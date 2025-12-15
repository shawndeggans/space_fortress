# Slice 07: Mediation

## Pattern Type
**Command Pattern**: UI → Command → Events

## User Story
As a player, I want to resolve faction disputes through diplomacy so that I can avoid battle and achieve compromise outcomes.

---

## Given-When-Then Specifications

### Spec 1: Lean Toward Faction
```gherkin
Given a player in mediation phase
  And two factions (ironveil, ashfall) are in dispute
When the player leans toward ironveil
Then MEDIATION_LEANED event is emitted
  And reputation with ironveil improves
  And reputation with ashfall decreases
```

### Spec 2: Refuse to Lean
```gherkin
Given a player in mediation phase
When the player refuses to lean toward either faction
Then MEDIATION_COLLAPSED event is emitted
  And PHASE_CHANGED to alliance (battle triggered)
```

### Spec 3: Accept Compromise
```gherkin
Given a player in mediation phase
  And player has leaned toward a faction
When the player accepts the compromise
Then COMPROMISE_ACCEPTED event is emitted
  And BOUNTY_MODIFIED reflects mediation outcome
  And PHASE_CHANGED to consequence
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `MEDIATION_STARTED` | `{ timestamp, questId, parties: [factionId, factionId] }` | Mediation begins |
| `POSITION_VIEWED` | `{ timestamp, factionId }` | Player viewed faction's position |
| `MEDIATION_LEANED` | `{ timestamp, towardFaction, awayFromFaction }` | Player showed preference |
| `MEDIATION_COLLAPSED` | `{ timestamp, reason }` | Mediation failed, battle triggers |
| `COMPROMISE_ACCEPTED` | `{ timestamp, terms, bountyModifier, reputationEffects[] }` | Diplomatic resolution |
| `REPUTATION_CHANGED` | `{ timestamp, factionId, delta, newValue, source: 'mediation' }` | Reputation from mediation |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'mediation', toPhase }` | Exit mediation |

### Events Consumed

| Event | Usage |
|-------|-------|
| `CHOICE_MADE` with triggersMediation | Determines mediation context |
| `REPUTATION_CHANGED` | Affects mediation options |

---

## Read Model

```typescript
interface MediationView {
  questId: string
  context: string  // "Two factions dispute the salvage rights..."
  parties: Array<{
    factionId: FactionId
    factionName: string
    representative: {
      name: string
      dialogue: string
    }
    position: string
    demands: string[]
    currentReputation: number
  }>
  leanOptions: Array<{
    towardFaction: FactionId
    outcomePreview: string
    reputationEffects: Array<{ faction: FactionId; delta: number }>
    bountyModifier: number  // percentage
  }>
  refuseOption: {
    warningText: string
    consequence: 'battle_triggered'
  }
  hasLeaned: boolean
  leanedToward?: FactionId
}
```

---

## Implementation Files

### Current Location (Layered)
- **Command handlers**: `src/lib/game/decider.ts`
  - `handleLeanTowardFaction()` lines ~850-890
  - `handleRefuseToLean()` lines ~895-920
  - `handleAcceptCompromise()` lines ~925-970
- **Projection**: `src/lib/game/projections/mediationView.ts`
- **UI**: `src/routes/mediation/+page.svelte`

### Target Location (Sliced)
- **Command handler**: `src/lib/slices/mediation/command.ts`
- **Read model**: `src/lib/slices/mediation/read-model.ts`
- **Tests**: `src/lib/slices/mediation/tests.ts`
- **UI**: `src/routes/mediation/+page.svelte`

---

## Dependencies

### Consumes Events From
- Make Choice slice (PHASE_CHANGED to mediation)

### Produces Events For
- Form Alliance slice (if mediation collapses)
- Consequence slice (if compromise accepted)
- Player State view (reputation changes)

---

## Business Rules

1. **Must be in mediation phase**: Commands rejected otherwise
2. **Can only lean once**: Cannot change lean after choosing
3. **Refusing triggers battle**: No peaceful resolution if refused
4. **Reputation affects terms**: Better reputation = better compromise terms

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│               MEDIATION SCREEN                       │
│                                                      │
│  FACTION DISPUTE                                     │
│  Two factions claim the salvage rights...           │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  IRONVEIL SYNDICATE                          │    │
│  │  Representative: Castellan Vorn              │    │
│  │  "The contract clearly states..."            │    │
│  │                                              │    │
│  │  Position: Salvage belongs to Ironveil       │    │
│  │  Demands: Full salvage rights, 40% bounty    │    │
│  │                                              │    │
│  │  Your Rep: Neutral (0)                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  ASHFALL REMNANTS                            │    │
│  │  Representative: Ember Kira                  │    │
│  │  "Those survivors are our people..."         │    │
│  │                                              │    │
│  │  Position: Survivors have priority           │    │
│  │  Demands: Survivor safety, 20% bounty        │    │
│  │                                              │    │
│  │  Your Rep: Unfriendly (-30)                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  YOUR OPTIONS:                                       │
│                                                      │
│  [Lean Toward Ironveil]                             │
│    ▲ Ironveil +15  ▼ Ashfall -10                   │
│    Bounty: -20%                                     │
│                                                      │
│  [Lean Toward Ashfall]                              │
│    ▲ Ashfall +20  ▼ Ironveil -15                   │
│    Bounty: -30%                                     │
│                                                      │
│  [Refuse to Mediate]                                │
│    ⚠️ Battle will be triggered                      │
│                                                      │
└─────────────────────────────────────────────────────┘
         │
         │ Lean toward faction
         │ Accept compromise
         ▼
┌─────────────────────────────────────────────────────┐
│             CONSEQUENCE SCREEN                       │
│                                                      │
│  Mediation resolved peacefully...                   │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/mediation.test.ts`

### Key Test Cases
- Lean toward faction emits correct events
- Reputation changes applied correctly
- Refuse to lean triggers battle path
- Accept compromise ends quest peacefully
- Cannot lean twice
