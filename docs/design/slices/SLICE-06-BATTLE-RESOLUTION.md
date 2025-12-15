# Slice 06: Battle Resolution

## Pattern Type
**Automation Pattern**: Events → Logic → Events

## User Story
As a player, I want to watch battles resolve automatically in 5 rounds so that I can see my tactical decisions play out with dramatic d20 rolls.

---

## Given-When-Then Specifications

### Spec 1: Round Resolution - Initiative
```gherkin
Given a battle in progress
  And it's round 1
  And player card has agility 5
  And opponent card has agility 3
When the round resolves
Then player card strikes first (higher agility)
  And INITIATIVE_RESOLVED event shows player as first striker
```

### Spec 2: Round Resolution - Attack Roll
```gherkin
Given a battle round in progress
  And attacker has attack 4
  And defender has armor 3
When the attack is rolled
Then d20 + 4 (attack) vs 10 + 3 (armor) is calculated
  And ATTACK_ROLLED event records the result
  And hit or miss is determined
```

### Spec 3: Battle Victory
```gherkin
Given a battle with 5 rounds complete
  And player won 3 rounds
  And opponent won 2 rounds
When battle resolution is calculated
Then BATTLE_RESOLVED event is emitted with outcome: 'victory'
  And PHASE_CHANGED event transitions to consequence
```

### Spec 4: Battle Defeat
```gherkin
Given a battle with 5 rounds complete
  And player won 1 round
  And opponent won 4 rounds
When battle resolution is calculated
Then BATTLE_RESOLVED event is emitted with outcome: 'defeat'
  And PHASE_CHANGED event transitions to consequence
```

---

## Event Contract

### Events Produced

| Event | Payload | Description |
|-------|---------|-------------|
| `ROUND_STARTED` | `{ timestamp, battleId, roundNumber }` | Round begins |
| `CARDS_REVEALED` | `{ timestamp, roundNumber, playerCard, opponentCard }` | Both cards shown |
| `INITIATIVE_RESOLVED` | `{ timestamp, roundNumber, firstStriker: 'player' \| 'opponent' \| 'simultaneous' }` | Who attacks first |
| `ATTACK_ROLLED` | `{ timestamp, roundNumber, attacker, roll: d20, modifier, total, target, hit }` | Attack result |
| `ROUND_RESOLVED` | `{ timestamp, roundNumber, outcome: 'player_won' \| 'opponent_won' \| 'draw' }` | Round winner |
| `BATTLE_RESOLVED` | `{ timestamp, battleId, outcome: 'victory' \| 'defeat' \| 'draw', roundsSummary }` | Battle complete |
| `PHASE_CHANGED` | `{ timestamp, fromPhase: 'battle', toPhase: 'consequence' }` | Battle ends |

### Events Consumed

| Event | Usage |
|-------|-------|
| `ORDERS_LOCKED` | Triggers battle start |
| `ROUND_STARTED` | Triggers round processing |

---

## Read Model

```typescript
interface BattleView {
  battleId: string
  currentRound: number
  totalRounds: 5
  playerScore: number
  opponentScore: number
  rounds: Array<{
    roundNumber: number
    playerCard: Card
    opponentCard: Card
    initiative: 'player' | 'opponent' | 'simultaneous'
    playerRoll: { base: number; modifier: number; total: number }
    opponentRoll: { base: number; modifier: number; total: number }
    playerHit: boolean
    opponentHit: boolean
    outcome: 'player_won' | 'opponent_won' | 'draw'
  }>
  status: 'in_progress' | 'completed'
  finalOutcome?: 'victory' | 'defeat' | 'draw'
}
```

---

## Implementation Files

### Current Location (Layered)
- **Battle logic**: `src/lib/game/combat.ts`
- **Command handler**: `src/lib/game/decider.ts` `handleContinueBattle()`
- **Projection**: `src/lib/game/projections/battleView.ts`
- **UI**: `src/routes/battle/+page.svelte`

### Target Location (Sliced)
- **Automation**: `src/lib/slices/battle-resolution/automation.ts`
- **Read model**: `src/lib/slices/battle-resolution/read-model.ts`
- **Tests**: `src/lib/slices/battle-resolution/tests.ts`
- **UI**: `src/routes/battle/+page.svelte`

---

## Dependencies

### Consumes Events From
- Deployment slice (ORDERS_LOCKED triggers battle)
- Card Selection slice (FLEET_COMMITTED provides player fleet)

### Produces Events For
- Consequence slice (BATTLE_RESOLVED triggers consequences)
- Player State view (updates battle statistics)

---

## Combat Rules

### Initiative (Who Attacks First)
- Higher agility attacks first
- If tied, simultaneous attacks

### Attack Roll
- Roll: d20 + Attack stat
- Target: 10 + Defender's Armor
- Hit if roll >= target

### Round Resolution
- Higher initiative attacks first
- Both cards can attack in same round
- Winner determined by: more hits, or if tied, who survives

### Battle Outcome
- Best of 5 rounds
- 3+ round wins = Victory
- 3+ round losses = Defeat
- 2-2-1 split = Draw

---

## UI Flow

```
┌─────────────────────────────────────────────────────┐
│                 BATTLE SCREEN                        │
│                                                      │
│  ROUND 3 of 5                                        │
│  Score: You 2 - Enemy 0                             │
│                                                      │
│  ┌───────────────┐       ┌───────────────┐          │
│  │   YOUR CARD   │  VS   │  ENEMY CARD   │          │
│  │   Salvager    │       │   Rustbucket  │          │
│  │   ATK: 3      │       │   ATK: 4      │          │
│  │   ARM: 3      │       │   ARM: 2      │          │
│  │   AGI: 2      │       │   AGI: 2      │          │
│  └───────────────┘       └───────────────┘          │
│                                                      │
│  INITIATIVE: Simultaneous (both AGI 2)              │
│                                                      │
│  YOUR ATTACK                                         │
│  🎲 [17] + 3 (ATK) = 20                             │
│  Target: 10 + 2 (ARM) = 12                          │
│  ✓ HIT!                                             │
│                                                      │
│  ENEMY ATTACK                                        │
│  🎲 [8] + 4 (ATK) = 12                              │
│  Target: 10 + 3 (ARM) = 13                          │
│  ✗ MISS                                             │
│                                                      │
│  RESULT: You win this round!                        │
│                                                      │
│  [Continue to Round 4]                              │
└─────────────────────────────────────────────────────┘
         │
         │ After Round 5
         ▼
┌─────────────────────────────────────────────────────┐
│                BATTLE COMPLETE                       │
│                                                      │
│  🏆 VICTORY!                                         │
│  Final Score: 4 - 1                                 │
│                                                      │
│  [See Consequences]                                 │
└─────────────────────────────────────────────────────┘
```

---

## Test Coverage

### Unit Tests
- `src/lib/game/__tests__/combat.test.ts`
- `src/lib/game/__tests__/battle.test.ts`

### Key Test Cases
- Higher agility gets initiative
- Attack roll calculation is correct
- Round winner determined correctly
- Battle outcome based on round wins
- All battle events emitted in correct order
- Phase transitions to consequence after battle
