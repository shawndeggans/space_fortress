# Card Battle System: 3-Round Duel

> **Status:** Approved for Implementation
> **Updated:** 2025-12-21
> **Goal:** Simple, intuitive card battles with dice-roll excitement

---

## Executive Summary

Replace the complex tactical battle system with a simple 3-round duel:

- **3 cards per side**, all visible face-up
- **Best of 3 rounds** - play one card each round
- **Attack + dice roll** determines winner
- **~30 seconds per battle** - fast and fun

---

## Game Flow

```
┌─────────────────────────────────────────────────────────┐
│  CARD SELECTION (before battle)                         │
│  Player picks exactly 3 cards from owned cards          │
│  Opponent gets 3 cards based on difficulty              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DUEL START                                             │
│  All 6 cards displayed face-up                          │
│  Initiative: higher total agility goes first            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  ROUND 1                                                │
│  1. First player selects a card                         │
│  2. Second player selects a card to counter             │
│  3. Dice roll! Attack + 1d6 vs Attack + 1d6            │
│  4. Higher total wins, losing card eliminated           │
└─────────────────────────────────────────────────────────┘
                          ↓
         (Repeat for Rounds 2 and 3)
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DUEL RESOLVED                                          │
│  Player with 2+ round wins = Battle Winner              │
│  Proceed to consequences                                │
└─────────────────────────────────────────────────────────┘
```

---

## Combat Resolution

When two cards fight:

```
Player Score   = Player Card Attack + 1d6 (random 1-6)
Opponent Score = Opponent Card Attack + 1d6 (random 1-6)

Higher score wins the round.
Exact tie = both cards eliminated, round is a draw.
```

**Example:**
- Player plays Creditor (Attack 4) → rolls 3 → Score: 7
- Opponent plays Scout (Attack 2) → rolls 5 → Score: 7
- Tie! Both cards eliminated.

**Tie-breaker (if duel ends 1-1-1 with draws):**
- Compare total remaining stats (Attack + Defense + Agility)
- Higher total wins the battle

---

## Type Definitions

### DuelState

```typescript
interface DuelState {
  battleId: string
  questId: string
  context: string

  // Round tracking
  currentRound: 1 | 2 | 3
  phase: 'player_select' | 'opponent_select' | 'resolution' | 'resolved'

  // Cards (all visible)
  playerCards: DuelCard[]      // 3 cards
  opponentCards: DuelCard[]    // 3 cards

  // Current round selection
  playerSelectedIndex: number | null
  opponentSelectedIndex: number | null

  // Results
  roundResults: RoundResult[]
  winner: 'player' | 'opponent' | 'draw' | null

  // Initiative (who plays first)
  firstPlayer: 'player' | 'opponent'
}

interface DuelCard {
  id: string
  name: string
  faction: FactionId
  attack: number
  defense: number
  agility: number
  isEliminated: boolean
}

interface RoundResult {
  round: number
  playerCard: DuelCard
  opponentCard: DuelCard
  playerRoll: number
  opponentRoll: number
  playerTotal: number
  opponentTotal: number
  winner: 'player' | 'opponent' | 'draw'
}
```

---

## Events (4 total)

```typescript
// 1. Duel initialization
| { type: 'DUEL_STARTED'; data: {
    battleId: string
    questId: string
    context: string
    playerCards: DuelCard[]
    opponentCards: DuelCard[]
    firstPlayer: 'player' | 'opponent'
  }}

// 2. Card selection
| { type: 'DUEL_CARD_SELECTED'; data: {
    battleId: string
    player: 'player' | 'opponent'
    cardIndex: number
    round: number
  }}

// 3. Round resolution (with dice!)
| { type: 'DUEL_ROUND_RESOLVED'; data: {
    battleId: string
    round: number
    playerCard: DuelCard
    opponentCard: DuelCard
    playerRoll: number      // 1-6
    opponentRoll: number    // 1-6
    playerTotal: number     // attack + roll
    opponentTotal: number   // attack + roll
    winner: 'player' | 'opponent' | 'draw'
    playerWins: number
    opponentWins: number
  }}

// 4. Duel complete
| { type: 'DUEL_RESOLVED'; data: {
    battleId: string
    winner: 'player' | 'opponent' | 'draw'
    playerWins: number
    opponentWins: number
  }}
```

---

## Commands (3 total)

```typescript
// 1. Start the duel (after card selection)
| { type: 'START_DUEL'; data: {
    playerCardIds: [string, string, string]
  }}

// 2. Player selects a card for current round
| { type: 'SELECT_DUEL_CARD'; data: {
    cardIndex: number  // 0, 1, or 2
  }}

// 3. Process opponent's turn (AI picks + resolve)
| { type: 'PROCESS_OPPONENT_DUEL_TURN'; data: {} }
```

---

## UI Design

### Card Selection Phase
```
┌─────────────────────────────────────────────────────────┐
│  ROUND 1 of 3                        Score: 0 - 0      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   OPPONENT'S CARDS                                      │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│   │ Raider  │  │ Gunship │  │ Scout   │                │
│   │  ⚔4     │  │  ⚔5     │  │  ⚔2     │                │
│   └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
│   ─────────────── VS ───────────────                   │
│                                                         │
│   YOUR CARDS (Click to play)                           │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│   │Creditor │  │ Phoenix │  │Bulwark  │                │
│   │  ⚔4     │  │  ⚔3     │  │  ⚔2     │                │
│   └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
│   Select a card to play this round                     │
└─────────────────────────────────────────────────────────┘
```

### Combat Resolution (with dice!)
```
┌─────────────────────────────────────────────────────────┐
│  ROUND 1 COMBAT!                     Score: 0 - 0      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│        ┌─────────┐           ┌─────────┐               │
│        │ Raider  │    VS     │Creditor │               │
│        │  ⚔4     │           │  ⚔4     │               │
│        └─────────┘           └─────────┘               │
│                                                         │
│         ⚔4 + 🎲3 = 7    vs    ⚔4 + 🎲5 = 9            │
│                                                         │
│                   YOU WIN!                              │
│                                                         │
│                 [Continue]                              │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Files

| File | Changes |
|------|---------|
| `src/lib/game/types.ts` | Add DuelState, DuelCard, RoundResult |
| `src/lib/game/events.ts` | Add 4 duel events |
| `src/lib/game/commands.ts` | Add 3 duel commands |
| `src/lib/game/decider.ts` | Add duel handlers (~100 lines) |
| `src/lib/game/projections.ts` | Add duel projections |
| `src/lib/game/opponentAI.ts` | Add simple card selection |
| `src/routes/card-pool/+page.svelte` | Select exactly 3 cards |
| `src/routes/duel/+page.svelte` | New duel UI screen |
| `src/lib/navigation/router.ts` | Add duel route |

---

## Design Decisions

1. **Combat**: Attack + 1d6 dice roll (adds excitement!)
2. **Tie-breaker**: Total remaining stats wins
3. **Initiative**: Higher total agility goes first
4. **Cards**: Exactly 3 per side

---

## Comparison: Old vs New

| Aspect | Old (Tactical) | New (Duel) |
|--------|----------------|------------|
| Cards | 4-8 in hidden deck | 3 visible |
| Energy | Yes | No |
| Battlefield | 5 positions | None |
| Abilities | 20+ types | None |
| Events | 45+ | 4 |
| Commands | 10+ | 3 |
| Duration | 3-5 min | 30 sec |

---

## Future Enhancement (V2)

The complex tactical system (energy, abilities, positioning) is preserved in the codebase for potential future use as an "Advanced Battle Mode" for endgame content or hardcore players.

See git history for the full tactical system design.
