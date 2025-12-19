# Diplomacy System Redesign: The Favor System

> **Status:** Design Proposal
> **Created:** 2025-12-18
> **Related:** [Card Battle Redesign](./CARD-BATTLE-REDESIGN.md)
> **Inspiration:** Dominion: Allies

---

## Executive Summary

The current alliance system is transactional and disconnected from gameplay. This redesign integrates diplomacy directly into the card battle system using **Favors** - a resource earned by playing faction cards in battle and spent to unlock alliance benefits.

**Core Concept:** Your battle deck IS your diplomatic strategy.

**Key Changes:**
- **Favors** accumulate by using faction cards in combat
- **Ally Abilities** unlock when you reach Favor thresholds
- **Liaison Cards** generate bonus Favors (trade-off: slightly weaker stats)
- **One unified system** - no separate negotiation phase

---

## Current System Analysis

### What Works
- Five distinct factions with clear identities
- Conflict relationships (Ironveil ↔ Ashfall, Void Wardens ↔ Sundered Oath)
- Bounty share as alliance cost
- Cards come from faction you ally with

### What's Missing
- **No persistent relationships** - Alliances reset each quest
- **No battle integration** - Alliance choice disconnected from combat
- **No friction** - Forming alliances is too easy
- **No deck-building depth** - Card faction doesn't matter strategically

---

## Design Philosophy

### The Faction Web

Factions have relationships that create natural tension:

```
             IRONVEIL ←───RIVALS───→ ASHFALL
                ↑                       ↑
                │                       │
             TRADES                SYMPATHIZES
                │                       │
                ↓                       ↓
            MERIDIAN ←───NEUTRAL───→ VOID WARDENS
                ↑                       ↑
                │                       │
            DISTRUSTS                ENEMIES
                │                       │
                ↓                       ↓
                    SUNDERED OATH
                     (Outcasts)
```

**Key Dynamic:** Gaining Favors with one faction reduces Favors with their rival. You can't befriend everyone.

---

## The Favor System

### How Favors Work

Favors are earned through gameplay and spent on alliance benefits. Each faction tracks Favors separately.

```typescript
interface FavorState {
  favors: Record<FactionId, number>  // 0-20 per faction
}
```

**Design Decision:** Players see exact Favor numbers (not just thresholds). Clarity is more fun than mystery for a resource you're actively managing.

### Earning Favors

| Action | Favors Earned |
|--------|---------------|
| Deploy a faction's card in battle | +1 to that faction |
| Faction card survives battle | +1 to that faction |
| Faction card deals killing blow | +2 to that faction |
| Complete quest aligned with faction | +3 to that faction |
| Make narrative choice favoring faction | +1 to +3 |

### Losing Favors

| Action | Favors Lost |
|--------|-------------|
| Faction card destroyed in battle | -1 from that faction |
| Ally with rival faction | -2 from opposing faction |
| Make narrative choice against faction | -1 to -3 |
| Favor decay (per quest) | -1 from all factions |

**Design Decision:** Favors decay by 1 per faction per quest. This prevents hoarding and encourages active relationship maintenance. It also means you can't max out everyone - you have to choose.

### Rival Faction Tension

When you gain Favors with a faction, their rival loses Favors:

| If you gain with... | Rival loses... |
|---------------------|----------------|
| Ironveil | Ashfall -1 |
| Ashfall | Ironveil -1 |
| Void Wardens | Sundered Oath -1 |
| Sundered Oath | Void Wardens -1 |
| Meridian | (no rival - they're neutral) |

This creates meaningful choices: going all-in on Ironveil makes Ashfall increasingly hostile.

---

## Favor Thresholds & Benefits

| Favor Level | Status | Alliance Benefit |
|-------------|--------|------------------|
| 0-4 | Neutral | Cannot request alliance |
| 5-9 | Friendly | 2 cards; 30% bounty share |
| 10-14 | Trusted | 3 cards; 20% bounty share; basic abilities |
| 15+ | Devoted | 3 enhanced cards (+1 stat); 10% share; all abilities |

**Design Decision:** Three meaningful thresholds (5, 10, 15) are easy to remember and create clear goals.

---

## Ally Cards (Persistent Benefits)

Each faction has an **Ally Card** that sits in a "Diplomacy Zone" during battle. When you reach 5+ Favors, the Ally Card activates and you can spend Favors to trigger its ability.

### Faction Ally Abilities

| Faction | Ally Ability | Cost | Effect |
|---------|--------------|------|--------|
| **Ironveil** | Debt Leverage | 3 Favors | Enemy discards 1 card at battle start |
| **Ashfall** | Smuggler's Cache | 2 Favors | Draw 1 extra card this turn |
| **Meridian** | Trade Connections | 4 Favors | Gain 150 bounty; draw 1 card next battle |
| **Void Wardens** | Shield Protocol | 3 Favors | One ship gains +2 armor this battle |
| **Sundered Oath** | Desperate Strike | 2 Favors | One ship gains +3 attack, -1 armor this turn |

**Design Decision:** Ally abilities can be used mid-battle (not just pre-battle). This creates more tactical decisions and dramatic moments.

### Diplomacy Zone UI

```
┌─────────────────────────────────────────────────────────────┐
│                      DIPLOMACY ZONE                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  IRONVEIL   │  │   ASHFALL   │  │  MERIDIAN   │          │
│  │   ★ ALLY    │  │    (dim)    │  │    (dim)    │          │
│  │             │  │             │  │             │          │
│  │ Favors: 8   │  │ Favors: 2   │  │ Favors: 4   │          │
│  │ ▓▓▓▓▓▓▓▓░░  │  │ ▓▓░░░░░░░░  │  │ ▓▓▓▓░░░░░░  │          │
│  │             │  │             │  │             │          │
│  │ [USE: -3]   │  │  (locked)   │  │  (locked)   │          │
│  │ Enemy -1    │  │             │  │             │          │
│  │ card        │  │             │  │             │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │ VOID WARDEN │  │  SUNDERED   │  Ally abilities available │
│  │    (dim)    │  │    (dim)    │  when Favors ≥ 5          │
│  │ Favors: 3   │  │ Favors: 0   │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Liaison Cards

Some battle cards have the **Liaison** keyword - they generate bonus Favors when played. The trade-off: Liaison cards have slightly lower combat stats.

```typescript
interface LiaisonCard extends BattleCard {
  liaison: {
    faction: FactionId
    favorsGenerated: number
    trigger: 'deploy' | 'survive' | 'kill' | 'attack'
  }
}
```

### Example Liaison Cards

| Card | Stats (Atk/Hull/Agi) | Cost | Liaison Effect |
|------|----------------------|------|----------------|
| Ironveil Envoy | 3/4/2 | 2 | +2 Ironveil Favors on deploy |
| Ashfall Courier | 3/3/5 | 2 | +1 Ashfall Favor per attack |
| Meridian Broker | 2/4/3 | 2 | +1 Favor to ANY faction on deploy |
| Void Delegate | 2/6/2 | 2 | +2 Void Warden Favors if survives |
| Oath Messenger | 4/3/3 | 2 | +2 Sundered Oath Favors on kill |

**Design Decision:** Liaison cards are roughly 1-2 stat points weaker than pure combat cards of the same cost. This makes the trade-off meaningful but not punishing.

### Deck-Building Strategy

Your deck composition becomes your diplomatic strategy:

| Deck Type | Combat Power | Diplomatic Power | Strategy |
|-----------|--------------|------------------|----------|
| Pure Combat | High | Low | Win battles, few alliance options |
| Single Faction Focus | Medium | High (one faction) | Strong single ally |
| Mixed Factions | Medium | Medium (spread) | Flexible but shallow alliances |
| Liaison Heavy | Low | Very High | Diplomatic focus, rely on ally abilities |

```
┌───────────────────────────────────────────────────────────────┐
│                       DECK BUILDER                            │
├───────────────────────────────────────────────────────────────┤
│  Your Deck (10 cards)                                         │
│                                                               │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐│
│  │ IV ││ IV ││ IV ││ AF ││ AF ││ MC ││ VW ││ VW ││ L  ││ L  ││
│  │    ││    ││ L  ││    ││ L  ││    ││    ││    ││ MC ││ IV ││
│  └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘│
│                                                               │
│  Faction Balance:              Liaison Cards: 4               │
│  ├─ Ironveil:  ███░░░ 3+1L    (generates ~6-8 bonus Favors   │
│  ├─ Ashfall:   ██░░░░ 1+1L     per battle)                   │
│  ├─ Meridian:  █░░░░░ 1+1L                                    │
│  ├─ Void W.:   ██░░░░ 2                                       │
│  └─ Sundered:  ░░░░░░ 0                                       │
│                                                               │
│  Diplomatic Forecast:                                         │
│  "Strong Ironveil focus. Moderate Ashfall. Sundered hostile." │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Integration with Battle

### Pre-Battle Phase

Before battle begins:
1. **Check Favor Thresholds** - See which alliances are available
2. **Request Alliance Cards** - Factions with 5+ Favors can provide cards
3. **View Ally Abilities** - See what you can activate during battle

### During Battle

- **Earn Favors** by deploying faction cards
- **Activate Ally Abilities** by spending Favors (mid-battle allowed)
- **Liaison triggers** generate bonus Favors based on conditions

### Post-Battle

- **Surviving cards** grant +1 Favor each
- **Destroyed cards** cost -1 Favor each
- **Ally abilities used** already spent those Favors

### Battle → Diplomacy Feedback

| Battle Outcome | Diplomatic Effect |
|----------------|-------------------|
| Win with faction cards | Bonus Favor with those factions |
| Allied cards deal killing blow | +2 Favor with that faction |
| Allied cards all destroyed | -3 Favor ("you sacrificed us") |
| Decisive victory (5-0) | +1 Fear from all factions |
| Close victory | No bonus/penalty |

---

## Events

### Favor Events

```typescript
// Favor changes
| { type: 'FAVOR_GAINED'; data: { faction: FactionId; amount: number; source: string; newTotal: number } }
| { type: 'FAVOR_LOST'; data: { faction: FactionId; amount: number; reason: string; newTotal: number } }
| { type: 'FAVOR_THRESHOLD_CROSSED'; data: { faction: FactionId; newStatus: 'neutral' | 'friendly' | 'trusted' | 'devoted'; direction: 'up' | 'down' } }

// Ally abilities
| { type: 'ALLY_ABILITY_UNLOCKED'; data: { faction: FactionId } }
| { type: 'ALLY_ABILITY_ACTIVATED'; data: { faction: FactionId; abilityName: string; favorCost: number } }
| { type: 'ALLY_ABILITY_RESOLVED'; data: { faction: FactionId; effect: string } }

// Alliance requests
| { type: 'ALLIANCE_REQUESTED'; data: { faction: FactionId; cardsOffered: number; bountyShare: number } }
| { type: 'ALLIANCE_CARDS_RECEIVED'; data: { faction: FactionId; cardIds: string[] } }

// Liaison triggers
| { type: 'LIAISON_TRIGGERED'; data: { cardId: string; faction: FactionId; favorsGenerated: number; trigger: string } }

// Decay
| { type: 'FAVOR_DECAYED'; data: { changes: Array<{ faction: FactionId; oldValue: number; newValue: number }> } }
```

### Commands

```typescript
// Alliance management
| { type: 'REQUEST_ALLIANCE'; data: { battleId: string; factionId: FactionId } }
| { type: 'DECLINE_ALLIANCE'; data: { battleId: string; factionId: FactionId } }

// Ally abilities (during battle)
| { type: 'ACTIVATE_ALLY_ABILITY'; data: { battleId: string; factionId: FactionId } }
```

---

## Implementation Roadmap

### Phase 1: Core Favor System
- [ ] Add `favors: Record<FactionId, number>` to GameState
- [ ] Implement Favor gain on card deploy/survive/kill
- [ ] Implement Favor loss on card destroyed
- [ ] Implement Favor decay between quests
- [ ] Implement rival faction tension (gain one, lose rival)
- [ ] Add Favor threshold checks for alliance availability
- [ ] Update alliance card quality based on threshold

### Phase 2: Ally Abilities
- [ ] Define Ally Card data structure
- [ ] Implement Diplomacy Zone in battle UI
- [ ] Add Ally ability activation command
- [ ] Implement each faction's ability effect
- [ ] Deduct Favors when ability used

### Phase 3: Liaison Cards
- [ ] Add `liaison` property to BattleCard interface
- [ ] Create 2-3 Liaison cards per faction (10-15 total)
- [ ] Implement Liaison trigger detection in battle flow
- [ ] Generate LIAISON_TRIGGERED events
- [ ] Update deck builder to show Liaison cards

### Phase 4: UI & Polish
- [ ] Favor display in battle UI
- [ ] Diplomacy Zone visual design
- [ ] Deck builder faction balance preview
- [ ] Favor threshold notifications
- [ ] Alliance request flow with new thresholds
- [ ] Tutorial tooltips for new mechanics

---

## Balancing Guidelines

### Favor Economy

**Per Battle (estimated):**
- Cards deployed: 5-8 → Favors earned: 5-8
- Cards surviving: 2-4 → Favors earned: 2-4
- Killing blows: 1-3 → Favors earned: 2-6
- Liaison bonuses: 0-8 (depends on deck)
- **Total potential per battle: 10-25 Favors (spread across factions)**

**Per Quest:**
- 2-3 battles average
- Decay: -1 per faction (total -5)
- **Net gain: Depends on deck focus**

**Thresholds:**
- Reaching Friendly (5): ~1-2 battles with faction focus
- Reaching Trusted (10): ~3-4 battles with faction focus
- Reaching Devoted (15): ~5-6 battles OR heavy Liaison use

### Liaison Card Balance

Liaison cards should be ~15% weaker in raw stats than equivalent combat cards:

| Energy Cost | Combat Card Stats | Liaison Card Stats |
|-------------|-------------------|-------------------|
| 1 | 3/3/3 (9 total) | 2/3/3 or 3/2/3 (8 total) |
| 2 | 4/4/3 (11 total) | 3/4/3 or 4/3/3 (10 total) |
| 3 | 5/5/3 (13 total) | 4/5/3 or 5/4/3 (12 total) |

This makes them viable but not auto-includes.

---

## Example Battle Flow

```
═══════════════════════════════════════════════════════════════
                    QUEST 2: SANCTUARY RUN
                  Pre-Battle Diplomacy Check
═══════════════════════════════════════════════════════════════

Current Favors:
├─ Ironveil: 8 (Friendly ★) - Alliance available!
├─ Ashfall: 6 (Friendly ★) - Alliance available!
├─ Meridian: 3 (Neutral)
├─ Void Wardens: 4 (Neutral)
└─ Sundered Oath: 1 (Neutral)

>> REQUEST ALLIANCE: Ironveil
   └─ Receiving 2 cards (Friendly tier)
   └─ Bounty share: 30%
   └─ Ironveil Ally ability now active

>> DECLINE ALLIANCE: Ashfall (saving Favors for ability use)

═══════════════════════════════════════════════════════════════
                       BATTLE START
═══════════════════════════════════════════════════════════════

DIPLOMACY ZONE:
┌─────────────┐ ┌─────────────┐
│  IRONVEIL   │ │   ASHFALL   │
│  Favors: 8  │ │  Favors: 6  │
│  [USE: -3]  │ │  [USE: -2]  │
│  Enemy -1   │ │  Draw +1    │
└─────────────┘ └─────────────┘

>> TURN 1 (You)
   └─ Deploy: Ironveil Envoy (Liaison)
      └─ +2 Ironveil Favors (8 → 10!)
      └─ THRESHOLD CROSSED: Ironveil now TRUSTED
      └─ Ashfall -1 Favor (rival tension: 6 → 5)

   └─ Deploy: Ashfall Interceptor
      └─ +1 Ashfall Favor (5 → 6)

>> TURN 2 (You)
   └─ Ashfall Interceptor attacks → KILL
      └─ +2 Ashfall Favors (6 → 8)

   └─ Activate IRONVEIL ALLY ABILITY
      └─ Spend 3 Favors (10 → 7)
      └─ Enemy discards 1 card!

>> TURN 3 (You)
   └─ Ironveil Envoy destroyed!
      └─ -1 Ironveil Favor (7 → 6)

═══════════════════════════════════════════════════════════════
                     BATTLE RESOLVED
                       VICTORY!
═══════════════════════════════════════════════════════════════

Surviving Cards: 3
└─ +3 Favors distributed (1 to each surviving card's faction)

Final Favor Changes This Battle:
├─ Ironveil: 8 → 10 → 7 → 8 (net: 0)
├─ Ashfall: 6 → 5 → 6 → 8 → 9 (net: +3)
└─ Others: unchanged

>> PROCEEDING TO CONSEQUENCES...
```

---

## Migration from Current System

### Converting Reputation to Favors

```typescript
function migrateToFavorSystem(oldState: GameState): GameState {
  return {
    ...oldState,
    favors: Object.entries(oldState.reputation).reduce(
      (acc, [faction, rep]) => ({
        ...acc,
        // Convert -100 to +100 scale to 0-20 Favor scale
        // Neutral (0) = 5 Favors
        // Max positive (100) = 15 Favors
        // Max negative (-100) = 0 Favors
        [faction]: Math.max(0, Math.min(20, Math.floor((rep + 100) / 10)))
      }),
      {} as Record<FactionId, number>
    )
  }
}
```

---

## Summary

The Favor System transforms diplomacy from a menu-based transaction into an emergent consequence of your battle choices:

1. **Build your deck** with faction focus and Liaison cards
2. **Fight battles** earning Favors for the factions you use
3. **Unlock Ally abilities** and better alliance terms
4. **Spend Favors** on powerful mid-battle abilities
5. **Manage relationships** as Favors decay and rivals grow hostile

**One deck. One system. Diplomacy through combat.**

---

*This design integrates seamlessly with the [Card Battle Redesign](./CARD-BATTLE-REDESIGN.md). Both systems share the same cards, energy costs, and battle flow.*
