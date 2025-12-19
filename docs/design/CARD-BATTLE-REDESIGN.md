# Card Battle System Redesign

> **Status:** Design Proposal
> **Created:** 2025-12-18
> **Goal:** Transform automated battles into an engaging, player-driven tactical experience

---

## Executive Summary

The current battle system is functional but passive—players select cards, then watch an automated resolution. This redesign proposes a turn-based tactical system inspired by modern card games (Hearthstone, Magic: The Gathering, Balatro) while maintaining our event-sourcing architecture and space bounty hunter theme.

**Core Changes:**
1. **Turn-Based Combat** - Players make decisions each round
2. **Energy System** - Resource management adds strategic depth
3. **Card Abilities** - Unique effects create synergies and counterplay
4. **Targeting System** - Choose which enemy to engage
5. **Hand Management** - Draw, discard, and timing matter

---

## Current System Analysis

### What Works
- Event-sourcing architecture is solid and extensible
- Card selection and fleet commitment flow well
- Faction identity through stat profiles (Ironveil = heavy hitters, Ashfall = fast strikers)
- Combat log provides good narrative feedback
- Deterministic combat enables replay and testing

### What's Missing
- **No player agency during combat** - Watch, don't play
- **No card abilities** - Cards are just stat blocks
- **No resource management** - No meaningful trade-offs
- **No targeting decisions** - Battles are lane-locked
- **No synergies** - Cards don't interact with each other
- **Predictable outcomes** - Higher stats usually win

---

## Proposed System: "Tactical Engagement"

### Design Pillars

1. **Meaningful Choices Every Turn** - No autopilot rounds
2. **Risk vs Reward** - Aggressive plays should feel dangerous
3. **Faction Identity Through Abilities** - Not just stats
4. **Comeback Mechanics** - Losing shouldn't feel hopeless
5. **Quick Resolution** - 3-5 minutes per battle max

---

## Core Mechanics

### 1. Energy System

Energy fuels all combat actions. It creates tension between doing everything you want and making hard choices.

```typescript
interface EnergyState {
  current: number      // Available this turn
  maximum: number      // Cap (starts at 3, can increase)
  regeneration: number // Gained each turn (default: 2)
}
```

**Starting Values:**
- Maximum Energy: 3
- Energy per Turn: 2
- First Turn Bonus: +1 (start with 3)

**Energy Costs:**
| Action | Cost |
|--------|------|
| Deploy a card | 1-3 (based on card power) |
| Activate ability | 1-2 |
| Attack with a card | 0 (but card is "exhausted") |
| Draw extra card | 2 |
| Pass turn | Gain +1 next turn |

**Strategic Implications:**
- Can't deploy your whole fleet at once
- Saving energy enables explosive future turns
- Cheap cards enable wide boards; expensive cards enable tall boards
- Faction playstyles emerge (Ashfall = cheap swarm, Ironveil = expensive anchors)

### 2. Turn Structure

Each round has clear phases with decision points.

```
┌─────────────────────────────────────────────┐
│                PLAYER TURN                   │
├─────────────────────────────────────────────┤
│  1. START PHASE                              │
│     • Gain energy (regeneration amount)      │
│     • Draw 1 card from deck                  │
│     • "Start of turn" abilities trigger      │
│                                              │
│  2. MAIN PHASE                               │
│     • Deploy cards from hand (costs energy)  │
│     • Activate abilities (costs energy)      │
│     • Attack with ready ships                │
│     • Use tactical maneuvers                 │
│     • (Can do in any order)                  │
│                                              │
│  3. END PHASE                                │
│     • Discard down to hand limit (5)         │
│     • "End of turn" abilities trigger        │
│     • Ready all exhausted ships              │
└─────────────────────────────────────────────┘
```

**Alternating Turns:**
1. First player's turn (determined at battle start)
2. Second player's turn
3. Repeat until victory condition

#### Turn Order Determination

Going first is an advantage (deploy threats, control tempo), so we balance with compensation:

**Who Goes First?**
- Compare total Agility of starting hands (sum of all 4 cards)
- Higher agility fleet strikes first (thematic: faster ships get initiative)
- Ties broken randomly

**Second Player Compensation: "Salvage Protocol"**
The player who goes second receives:
- **+1 Starting Energy** (4 instead of 3 on turn 1)
- **"Emergency Reserves"** - A one-time-use ability that grants +2 energy on any turn (use it or lose it by turn 3)

This mirrors Hearthstone's "The Coin" while fitting our theme. The second player can either:
- Deploy a more expensive ship on turn 1 (aggressive catch-up)
- Save Emergency Reserves for a power turn later

```typescript
interface InitiativeState {
  firstPlayer: 'player' | 'opponent'
  reason: 'agility' | 'tiebreaker'
  playerAgility: number
  opponentAgility: number
  secondPlayerBonus: {
    extraStartingEnergy: number  // +1
    emergencyReserves: {
      available: boolean
      expiresOnTurn: number      // Turn 3
      energyGrant: number        // +2
    }
  }
}
```

#### Card Visibility Rules

**Hidden Information (Fog of War):**
- Opponent's hand is hidden (you see card backs and count only)
- Opponent's deck is hidden (you see remaining count only)
- Your own hand, deck, and discard are fully visible to you

**Revealed Information:**
- All ships on the battlefield are visible with full stats and abilities
- Flagships and their current hull are always visible
- Energy totals for both players are visible
- Discard piles can be inspected (know what's been played)

**Reveal Mechanics:**
- Cards are revealed when deployed (enter battlefield)
- Some abilities may "scout" (peek at opponent's hand)
- Some abilities may "reveal" (force opponent to show a card)

```
┌─────────────────────────────────────────────────────┐
│  ENEMY HAND: [?][?][?]  (3 cards)   DECK: 5 cards  │
│                                                     │
│  ... battlefield (fully visible) ...                │
│                                                     │
│  YOUR HAND: [Creditor][Phoenix][Bulwark]  DECK: 4  │
└─────────────────────────────────────────────────────┘
```

**Strategic Implications:**
- You must remember/track what opponent has played
- Bluffing is possible (they don't know your hand)
- Scouting abilities become valuable
- Counting cards matters (if they've played 5 Ashfall cards, no more Ashfall coming)

### 3. Victory Conditions

Multiple paths to victory create strategic diversity.

**Primary: Destroy the Flagship**
- Each side has a Flagship with hull points
- Flagship Hull = 10 + (2 × difficulty level)
- Direct attacks on Flagship only when no Taunt ships block
- Destroying enemy Flagship = Victory

**Secondary: Fleet Elimination**
- Destroy all enemy ships
- If no ships remain and no cards in hand, Flagship takes 2 damage per turn

**Tertiary: Attrition (5 Round Limit)**
- After Round 5, compare remaining total hull points
- Higher total wins
- Encourages decisive play, prevents stalls

### 4. The Battlefield

A spatial board adds positioning decisions.

```
       ╔═══════════════════════════════════════╗
       ║         ENEMY FLAGSHIP (Hull: 12)      ║
       ╠═══════════════════════════════════════╣
       ║  [E1]    [E2]    [E3]    [E4]    [E5]  ║  ← Enemy Fleet
       ║  Scout   Raider  ---     Gunship ---   ║
       ╠═══════════════════════════════════════╣
       ║        ═══ ENGAGEMENT ZONE ═══        ║
       ╠═══════════════════════════════════════╣
       ║  [P1]    [P2]    [P3]    [P4]    [P5]  ║  ← Player Fleet
       ║  Tank    ---     Striker ---    Sniper ║
       ╠═══════════════════════════════════════╣
       ║        YOUR FLAGSHIP (Hull: 10)        ║
       ╚═══════════════════════════════════════╝

       HAND: [Card A] [Card B] [Card C]
       ENERGY: ●●○○○ (2/5)   DECK: 7 cards
```

**Positioning Rules:**
- 5 slots per side
- Ships attack the ship directly opposite them (if any)
- Empty opposing slot = attack goes to Flagship
- Some abilities allow cross-lane attacks
- Moving between slots costs 1 energy

### 5. Card Abilities

The heart of the redesign. Every card gets 0-2 abilities based on faction and rarity.

#### Ability Timing Categories

| Timing | When It Triggers |
|--------|------------------|
| **Deploy** | When card enters battlefield |
| **Attack** | When this card attacks |
| **Defend** | When this card is attacked |
| **Destroyed** | When this card is destroyed |
| **Start of Turn** | At beginning of your turn |
| **End of Turn** | At end of your turn |
| **Activated** | Player manually triggers (costs energy) |

#### Faction Ability Themes

**IRONVEIL SYNDICATE** - Control & Suppression
- *Lockdown*: Enemy in this lane can't attack next turn
- *Siege Protocol*: +2 damage to Flagships
- *Debt Collection*: When destroyed, enemy loses 1 energy next turn
- *Armored Hull*: First damage each turn is reduced by 2

**ASHFALL CORSAIRS** - Speed & Disruption
- *First Strike*: Deal damage before enemy can retaliate
- *Hit and Run*: After attacking, may move to adjacent empty slot
- *Raider*: Can attack any lane (ignore positioning)
- *Evasion*: 50% chance to dodge attacks (roll ≥ 11)

**MERIDIAN COLLECTIVE** - Utility & Flexibility
- *Repair Drone*: Start of turn, heal 1 to adjacent ally
- *Trade Routes*: Draw a card when deployed
- *Adaptable*: Choose +2 Attack or +2 Armor when deployed
- *Diplomat*: Cannot be targeted by abilities (only attacks)

**VOID WARDENS** - Defense & Endurance
- *Taunt*: Enemies must attack this ship if able
- *Shield Generator*: Adjacent allies have +1 Armor
- *Regenerate*: Heal 1 hull at end of turn
- *Stalwart*: Cannot be destroyed by a single attack (survives with 1 hull)

**SUNDERED OATH** - Aggression & Risk
- *Berserker*: +2 Attack when below half hull
- *Overkill*: Excess damage hits Flagship
- *Blood Price*: Deal 2 damage to target ship. Take 1 damage.
- *Death Wish*: When destroyed, deal 3 damage to opposing ship

#### Example Redesigned Cards

```typescript
// Current: Just stats
const currentCard = {
  id: 'ironveil_creditor',
  name: 'Ironveil Creditor',
  faction: 'ironveil',
  attack: 6,
  armor: 3,
  agility: 2
}

// Proposed: Stats + Abilities + Hull + Cost
const proposedCard = {
  id: 'ironveil_creditor',
  name: 'Ironveil Creditor',
  faction: 'ironveil',

  // Combat stats
  attack: 4,           // Reduced from 6 (abilities compensate)
  hull: 5,             // NEW: Health points
  agility: 2,          // Determines attack order within turn

  // Resource cost
  energyCost: 2,       // NEW: Cost to deploy

  // Abilities
  abilities: [
    {
      id: 'debt_collection',
      name: 'Debt Collection',
      type: 'destroyed',
      description: 'When destroyed, enemy loses 1 energy next turn.',
      effect: { type: 'DRAIN_ENERGY', target: 'opponent', amount: 1 }
    },
    {
      id: 'siege_protocol',
      name: 'Siege Protocol',
      type: 'passive',
      description: '+2 damage to Flagships.',
      effect: { type: 'BONUS_DAMAGE', target: 'flagship', amount: 2 }
    }
  ],

  flavorText: 'Payment is always collected. One way or another.'
}
```

### 6. Hull Points (HP) System

Replace single-hit elimination with health pools.

```typescript
interface ShipState {
  cardId: string
  position: 1 | 2 | 3 | 4 | 5
  currentHull: number    // Current HP
  maxHull: number        // Maximum HP
  isExhausted: boolean   // Can't attack until readied
  statusEffects: StatusEffect[]
}
```

**Hull Ranges by Faction:**
| Faction | Hull Range | Profile |
|---------|------------|---------|
| Ironveil | 4-6 | Moderate health, high attack |
| Ashfall | 2-4 | Low health, high evasion |
| Meridian | 3-5 | Balanced |
| Void Wardens | 5-8 | High health tanks |
| Sundered Oath | 2-4 | Glass cannons |

**Damage Calculation:**
```
Damage Dealt = Attacker's Attack - Defender's Armor (minimum 1)
```

Example: 4 Attack vs 2 Armor = 2 damage to hull

### 7. Hand and Deck Management

Strategic card flow replaces static fleet selection.

**Pre-Battle Setup:**
1. Select 8-10 cards for your "Battle Deck" (from owned cards)
2. Deck is shuffled
3. Draw opening hand of 4 cards

**During Battle:**
- Draw 1 card per turn (automatic)
- Maximum hand size: 5 (discard excess at end of turn)
- Spend 2 energy to draw additional card
- When deck is empty, no more draws (but no penalty)

**Strategic Elements:**
- Mulligan: Redraw 1-2 cards at game start (one time)
- Card order matters: Save powerful cards for right moment
- Hand reading: Track what opponent has played

### 8. Status Effects

Temporary modifiers add tactical layers.

| Effect | Duration | Description |
|--------|----------|-------------|
| **Exhausted** | Until end of turn | Cannot attack (auto-cleared) |
| **Stunned** | 1 turn | Cannot attack or use abilities |
| **Burning** | 2 turns | Take 1 damage at start of turn |
| **Shielded** | Until hit | Block next damage instance |
| **Energized** | 1 turn | Abilities cost 1 less energy |
| **Marked** | Until attacked | Next attack deals +2 damage |

---

## Revised Card Structure

### Full Card Interface

```typescript
interface BattleCard {
  // Identity
  id: string
  name: string
  faction: FactionId
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'

  // Combat Stats
  attack: number        // Damage dealt when attacking
  hull: number          // Health points
  armor: number         // Damage reduction
  agility: number       // Attack order priority

  // Resource
  energyCost: number    // Cost to deploy (1-4)

  // Abilities (0-2 per card)
  abilities: CardAbility[]

  // Metadata
  flavorText?: string
  artId?: string
}

interface CardAbility {
  id: string
  name: string
  type: AbilityTiming
  description: string
  energyCost?: number   // For activated abilities
  cooldown?: number     // Turns between uses
  effect: AbilityEffect
}

type AbilityTiming =
  | 'deploy'      // When played from hand
  | 'attack'      // When this card attacks
  | 'defend'      // When this card is attacked
  | 'destroyed'   // When this card dies
  | 'start_turn'  // Start of owner's turn
  | 'end_turn'    // End of owner's turn
  | 'activated'   // Manual activation
  | 'passive'     // Always active

interface AbilityEffect {
  type: EffectType
  target: TargetType
  amount?: number
  duration?: number
}

type EffectType =
  | 'DEAL_DAMAGE'
  | 'HEAL'
  | 'DRAW_CARD'
  | 'GAIN_ENERGY'
  | 'DRAIN_ENERGY'
  | 'APPLY_STATUS'
  | 'REMOVE_STATUS'
  | 'MOVE_SHIP'
  | 'BUFF_STAT'
  | 'DEBUFF_STAT'
  | 'SUMMON'

type TargetType =
  | 'self'
  | 'opponent'
  | 'adjacent_ally'
  | 'adjacent_enemy'
  | 'all_allies'
  | 'all_enemies'
  | 'flagship'
  | 'random_enemy'
  | 'chosen'  // Player selects
```

---

## New Event Types

Following event-sourcing patterns, here are the new events needed:

### Battle Flow Events

```typescript
// Phase Transitions
| { type: 'TURN_STARTED'; data: { turnNumber: number; activePlayer: 'player' | 'opponent'; energyGained: number } }
| { type: 'TURN_ENDED'; data: { turnNumber: number; player: 'player' | 'opponent' } }

// Energy System
| { type: 'ENERGY_GAINED'; data: { player: 'player' | 'opponent'; amount: number; source: string } }
| { type: 'ENERGY_SPENT'; data: { player: 'player' | 'opponent'; amount: number; action: string } }

// Card Actions
| { type: 'CARD_DRAWN'; data: { player: 'player' | 'opponent'; cardId: string; deckRemaining: number } }
| { type: 'CARD_DEPLOYED'; data: { player: 'player' | 'opponent'; cardId: string; position: number; energyCost: number } }
| { type: 'CARD_DISCARDED'; data: { player: 'player' | 'opponent'; cardId: string; reason: 'hand_limit' | 'ability' | 'cost' } }

// Combat Actions
| { type: 'ATTACK_DECLARED'; data: { attackerId: string; targetId: string | 'flagship'; position: number } }
| { type: 'DAMAGE_DEALT'; data: { sourceId: string; targetId: string; amount: number; damageType: 'attack' | 'ability' } }
| { type: 'SHIP_DESTROYED'; data: { cardId: string; destroyedBy: string; position: number } }
| { type: 'FLAGSHIP_DAMAGED'; data: { player: 'player' | 'opponent'; amount: number; newHull: number } }

// Abilities
| { type: 'ABILITY_TRIGGERED'; data: { cardId: string; abilityId: string; trigger: AbilityTiming } }
| { type: 'ABILITY_ACTIVATED'; data: { cardId: string; abilityId: string; energyCost: number; targets: string[] } }
| { type: 'ABILITY_RESOLVED'; data: { cardId: string; abilityId: string; effects: ResolvedEffect[] } }

// Status Effects
| { type: 'STATUS_APPLIED'; data: { targetId: string; status: StatusEffect; duration: number; source: string } }
| { type: 'STATUS_EXPIRED'; data: { targetId: string; status: string } }
| { type: 'STATUS_TRIGGERED'; data: { targetId: string; status: string; effect: string } }

// Victory
| { type: 'FLAGSHIP_DESTROYED'; data: { player: 'player' | 'opponent' } }
| { type: 'FLEET_ELIMINATED'; data: { player: 'player' | 'opponent' } }
| { type: 'BATTLE_TIMEOUT'; data: { rounds: number; playerHull: number; opponentHull: number } }
```

### New Commands

```typescript
// Turn Actions
| { type: 'END_TURN'; data: { battleId: string } }
| { type: 'DEPLOY_CARD'; data: { battleId: string; cardId: string; position: number } }
| { type: 'ATTACK_WITH_SHIP'; data: { battleId: string; shipId: string; targetPosition?: number } }
| { type: 'ACTIVATE_ABILITY'; data: { battleId: string; shipId: string; abilityId: string; targetId?: string } }
| { type: 'MOVE_SHIP'; data: { battleId: string; shipId: string; newPosition: number } }
| { type: 'DRAW_EXTRA_CARD'; data: { battleId: string } }
| { type: 'DISCARD_CARD'; data: { battleId: string; cardId: string } }
| { type: 'MULLIGAN'; data: { battleId: string; cardIds: string[] } }
```

---

## New Battle State

```typescript
interface TacticalBattleState {
  battleId: string
  turnNumber: number
  activePlayer: 'player' | 'opponent'
  phase: 'setup' | 'mulligan' | 'playing' | 'resolved'

  player: CombatantState
  opponent: CombatantState

  // History for replay
  eventLog: BattleEvent[]
}

interface CombatantState {
  flagship: {
    currentHull: number
    maxHull: number
  }

  energy: {
    current: number
    maximum: number
    regeneration: number
  }

  battlefield: (ShipState | null)[]  // 5 slots

  hand: string[]           // Card IDs in hand
  deck: string[]           // Card IDs remaining in deck
  discard: string[]        // Card IDs in discard pile

  hasActedThisTurn: Set<string>  // Ships that attacked/used abilities
}
```

---

## UI Redesign

### Main Battle Screen Layout

```
┌────────────────────────────────────────────────────────┐
│  TURN 3                          [COMBAT LOG] [MENU]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│     ENEMY FLAGSHIP  ████████████░░ 10/14              │
│                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │RAIDER│ │EMPTY │ │GUNSHP│ │SCOUT │ │EMPTY │        │
│  │ 3/2  │ │      │ │ 4/5  │ │ 2/3  │ │      │        │
│  │ ⚔3🛡1│ │      │ │ ⚔4🛡2│ │ ⚔2🛡1│ │      │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│                                                        │
│  ═══════════════ ENGAGEMENT ZONE ═══════════════════  │
│                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │CRDITR│ │EMPTY │ │BULWRK│ │EMPTY │ │INTCPT│        │
│  │ 4/5  │ │      │ │ 3/7  │ │      │ │ 2/2 ★│        │
│  │ ⚔4🛡2│ │      │ │ ⚔2🛡3│ │      │ │ ⚔3🛡1│  Ready │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│                                                        │
│     YOUR FLAGSHIP   ██████████████░░ 8/10             │
│                                                        │
├────────────────────────────────────────────────────────┤
│  HAND (3/5)                         ENERGY: ●●●○ 3/4  │
│  ┌──────┐ ┌──────┐ ┌──────┐                           │
│  │PHEONX│ │ENFORC│ │TRADER│  [DRAW +1]  [END TURN]   │
│  │Cost:2│ │Cost:3│ │Cost:1│                           │
│  └──────┘ └──────┘ └──────┘                           │
└────────────────────────────────────────────────────────┘
```

### Card Detail View (on hover/select)

```
╔══════════════════════════════════╗
║  IRONVEIL CREDITOR          [2]  ║  ← Energy cost
╠══════════════════════════════════╣
║                                  ║
║         [CARD ART]               ║
║                                  ║
╠══════════════════════════════════╣
║  ⚔ 4 Attack    🛡 2 Armor        ║
║  ♥ 5 Hull      ⚡ 2 Agility      ║
╠══════════════════════════════════╣
║  ▸ SIEGE PROTOCOL (Passive)      ║
║    +2 damage to Flagships        ║
║                                  ║
║  ▸ DEBT COLLECTION (Destroyed)   ║
║    Enemy loses 1 energy next     ║
║    turn                          ║
╠══════════════════════════════════╣
║  "Payment is always collected.   ║
║   One way or another."           ║
╚══════════════════════════════════╝
```

### Combat Log Panel

```
┌─ COMBAT LOG ──────────────────────┐
│                                   │
│ Turn 3 - Your Turn               │
│ ├─ Drew: Ashfall Phoenix          │
│ ├─ Gained 2 energy (2→4)          │
│ │                                 │
│ ├─ Deployed: Void Bulwark [3]     │
│ │   └─ Taunt activated            │
│ │                                 │
│ ├─ Interceptor → Raider           │
│ │   └─ 3 atk - 1 arm = 2 dmg     │
│ │   └─ Raider: 2/2 → 0/2 ☠       │
│ │   └─ First Strike: No counter! │
│ │                                 │
│ └─ Creditor → Enemy Flagship     │
│     └─ 4 + 2 (Siege) = 6 dmg     │
│     └─ Flagship: 14 → 10         │
│                                   │
│ [Scroll for more...]              │
└───────────────────────────────────┘
```

---

## AI Opponent Behavior

Opponents need strategic AI to make battles feel rewarding.

### Difficulty Levels

| Level | Behavior | Example Patterns |
|-------|----------|-----------------|
| **Scavenger** | Random/suboptimal | Plays cards in hand order, attacks randomly |
| **Raider** | Basic tactics | Prioritizes low-health targets, saves some energy |
| **Enforcer** | Smart targeting | Focuses threats, uses abilities well |
| **Elite** | Advanced strategy | Plans 2-3 turns ahead, baits abilities |
| **Boss** | Near-optimal | Reads player patterns, holds counters |

### AI Decision Tree

```
1. EVALUATE THREATS
   - Which enemy ships can destroy mine?
   - Is my Flagship in danger?

2. EVALUATE OPPORTUNITIES
   - Can I destroy any enemy ship this turn?
   - Is enemy Flagship vulnerable?

3. PRIORITIZE ACTIONS
   - Deploy defenders if Flagship threatened
   - Remove dangerous enemies first
   - Press advantage if winning
   - Go for Flagship if path clear

4. RESOURCE MANAGEMENT
   - Save energy for key abilities
   - Don't overcommit to empty board
```

---

## Balancing Considerations

### Stat Budget System

Each card has a "power budget" based on rarity:

| Rarity | Stat Budget | Ability Slots |
|--------|-------------|---------------|
| Common | 8-10 points | 0-1 |
| Uncommon | 10-12 points | 1 |
| Rare | 12-14 points | 1-2 |
| Legendary | 14-16 points | 2 |

**Stat Costs:**
- +1 Attack = 2 points
- +1 Hull = 1 point
- +1 Armor = 1.5 points
- +1 Agility = 1 point
- Powerful ability = 2-3 points
- Utility ability = 1 point

### Energy Cost Guidelines

| Total Stats | Energy Cost |
|-------------|-------------|
| 8-9 | 1 |
| 10-11 | 2 |
| 12-13 | 3 |
| 14+ | 4 |

Abilities can modify costs:
- Strong deploy effect: +1 cost
- Drawback ability: -1 cost

---

## Implementation Roadmap

### Phase 1: Core Battle Mechanics (Foundation)
- [ ] New card structure with hull and energy cost
- [ ] Turn-based flow (start → main → end phases)
- [ ] Energy system (gain, spend, regenerate)
- [ ] Basic attack/damage/destroy loop
- [ ] Flagship health tracking
- [ ] Victory conditions
- [ ] Update battle events for new system

### Phase 2: Abilities System
- [ ] Ability data structure and types
- [ ] Ability timing system (triggers)
- [ ] 4-5 abilities per faction (20 total)
- [ ] Ability targeting system
- [ ] UI for ability activation
- [ ] Ability effects engine

### Phase 3: Hand Management
- [ ] Battle deck selection (8-10 cards)
- [ ] Draw system
- [ ] Hand limit enforcement
- [ ] Mulligan at battle start
- [ ] Discard mechanics
- [ ] Deck/discard tracking

### Phase 4: Positioning & Movement
- [ ] 5-slot battlefield per side
- [ ] Position-based targeting
- [ ] Move action
- [ ] Lane-based abilities
- [ ] Empty slot → Flagship rules

### Phase 5: Status Effects
- [ ] Status effect data structure
- [ ] Application and expiration
- [ ] Visual indicators
- [ ] 6-8 core status types
- [ ] Status interaction rules

### Phase 6: AI & Polish
- [ ] AI opponent decision making
- [ ] Difficulty scaling
- [ ] Battle animations (optional)
- [ ] Sound effects (optional)
- [ ] Tutorial/help tooltips

---

## Migration Strategy

### Backward Compatibility

The new system should coexist with existing cards:

```typescript
// Migration helper
function migrateCard(oldCard: Card): BattleCard {
  return {
    ...oldCard,
    hull: oldCard.armor + 2,           // Convert armor to starting hull
    energyCost: calculateCost(oldCard), // Derive from stats
    abilities: getFactionAbilities(oldCard.faction, 'common'),
    rarity: 'common'
  }
}
```

### Feature Flag Approach

```typescript
const BATTLE_SYSTEM_VERSION =
  import.meta.env.VITE_BATTLE_SYSTEM ?? 'classic'

// In decider.ts
case 'LOCK_ORDERS':
  if (BATTLE_SYSTEM_VERSION === 'tactical') {
    return startTacticalBattle(state, command)
  } else {
    return startClassicBattle(state, command)  // Current system
  }
```

This allows:
- A/B testing both systems
- Gradual rollout
- Easy rollback if needed

---

## Example Battle Transcript

```
═══════════════════════════════════════════════
         TACTICAL ENGAGEMENT BEGIN
   You vs. Crimson Fang Pirates (Difficulty: 2)
═══════════════════════════════════════════════

>> SETUP PHASE
   Your Flagship Hull: 10
   Enemy Flagship Hull: 14
   Your Deck: 8 cards | Enemy Deck: 8 cards

>> OPENING HANDS DRAWN
   You drew: Ironveil Creditor, Ashfall Phoenix,
             Void Bulwark, Meridian Trader

>> MULLIGAN PHASE
   > Keep all? [Y/n]: n
   > Select cards to mulligan: Meridian Trader
   > Drew: Sundered Berserker

═══════════════════════════════════════════════
                   TURN 1 (You)
           Energy: 3/3 | Hand: 4 cards
═══════════════════════════════════════════════

Your battlefield: [ ][ ][ ][ ][ ]
Enemy battlefield: [ ][ ][ ][ ][ ]

>> MAIN PHASE
   > Action: deploy Ashfall Phoenix to position 3
     └─ Spent 2 energy (3→1)
     └─ DEPLOY ABILITY: Draw 1 card
        └─ Drew: Void Sentinel

   Your battlefield: [ ][ ][Phoenix 2/4][ ][ ]

   > Action: end turn

>> END PHASE
   └─ Phoenix readied

═══════════════════════════════════════════════
                TURN 1 (Enemy)
           Energy: 3/3 | Hand: 4 cards
═══════════════════════════════════════════════

>> MAIN PHASE
   └─ Enemy deployed Scavenger Scout to position 2
   └─ Enemy deployed Pirate Gunner to position 4

   Enemy battlefield: [ ][Scout 2/3][ ][Gunner 3/4][ ]

   └─ Scout attacks → YOUR FLAGSHIP
      └─ No opposing ship! Direct hit!
      └─ 2 damage to Flagship (10→8)

   └─ Gunner attacks → YOUR FLAGSHIP
      └─ No opposing ship! Direct hit!
      └─ 3 damage to Flagship (8→5)

>> END PHASE

   ⚠️ YOUR FLAGSHIP: 5/10

═══════════════════════════════════════════════
                   TURN 2 (You)
           Energy: 3/4 | Hand: 4 cards
═══════════════════════════════════════════════

Your battlefield: [ ][ ][Phoenix 2/4][ ][ ]
Enemy battlefield: [ ][Scout 2/3][ ][Gunner 3/4][ ]

>> MAIN PHASE
   > Action: deploy Void Bulwark to position 2
     └─ Spent 2 energy (3→1)
     └─ TAUNT active: Enemies must attack Bulwark

   > Action: Phoenix attacks Scout
     └─ 3 attack - 1 armor = 2 damage
     └─ Scout: 3→1 hull
     └─ FIRST STRIKE: Scout cannot counter-attack!
     └─ Phoenix exhausted

   Your battlefield: [ ][Bulwark 2/7][Phoenix 2/4][ ][ ]
   Enemy battlefield: [ ][Scout 2/1][ ][Gunner 3/4][ ]

   > Action: end turn

═══════════════════════════════════════════════
                TURN 2 (Enemy)
           Energy: 4/4 | Hand: 3 cards
═══════════════════════════════════════════════

>> MAIN PHASE
   └─ Enemy deployed Pirate Captain to position 3
      └─ RALLY ability: All allies gain +1 attack this turn

   └─ Scout attacks → Void Bulwark (TAUNT)
      └─ 2+1 attack - 3 armor = 0 damage (minimum 1)
      └─ Bulwark: 7→6 hull

   └─ Gunner attacks → Void Bulwark (TAUNT)
      └─ 3+1 attack - 3 armor = 1 damage
      └─ Bulwark: 6→5 hull

   └─ Captain attacks → Void Bulwark (TAUNT)
      └─ 4+1 attack - 3 armor = 2 damage
      └─ Bulwark: 5→3 hull

>> END PHASE
   └─ Rally bonus expired

═══════════════════════════════════════════════
                   TURN 3 (You)
═══════════════════════════════════════════════

... [battle continues] ...

═══════════════════════════════════════════════
              BATTLE RESOLVED
═══════════════════════════════════════════════

   🏆 VICTORY - Enemy Flagship Destroyed!

   Turn 5: Your Creditor dealt final blow
           └─ Siege Protocol +2 damage sealed the win

   ┌─────────────────────────────────────┐
   │  Your Flagship:    3/10 (survived)  │
   │  Enemy Flagship:   0/14 (destroyed) │
   │  Ships Lost:       2                │
   │  Ships Destroyed:  5                │
   │  Turns Taken:      5                │
   └─────────────────────────────────────┘

   >> Proceeding to CONSEQUENCES phase...
```

---

## Open Questions

1. **Complexity Level** - Is this too complex for the game's scope? Should we simplify?

2. **Ability Count** - 20 abilities (4 per faction) for launch, or start with fewer?

3. **Deck Size** - 8-10 feels right, but should it scale with game progression?

4. **Opponent Variety** - Should different enemy types have unique abilities or share a pool?

5. **Tutorial** - How do we teach these mechanics? Guided first battle? Help tooltips?

6. **Mobile Considerations** - The UI is designed for desktop; how does it adapt to mobile?

---

## References

- [Hearthstone Game Mechanics](https://hearthstone.fandom.com/wiki/Game_mechanics)
- [MTG Comprehensive Rules](https://magic.wizards.com/en/rules)
- [Balatro Design Analysis](https://www.youtube.com/watch?v=...)
- [Slay the Spire Combat System](https://slay-the-spire.fandom.com/wiki/Combat)

---

## Appendix: Faction Card Roster (Draft)

### Ironveil Syndicate (Control)

| Card | ⚔ | 🛡 | ♥ | ⚡ | Cost | Abilities |
|------|---|---|---|---|------|-----------|
| Ironveil Creditor | 4 | 2 | 5 | 2 | 2 | Siege Protocol, Debt Collection |
| Ironveil Enforcer | 5 | 2 | 6 | 1 | 3 | Lockdown |
| Ironveil Collector | 3 | 3 | 4 | 2 | 2 | Armored Hull |
| Ironveil Dreadnought | 6 | 3 | 8 | 1 | 4 | Siege Protocol, Armored Hull |

### Ashfall Corsairs (Speed)

| Card | ⚔ | 🛡 | ♥ | ⚡ | Cost | Abilities |
|------|---|---|---|---|------|-----------|
| Ashfall Phoenix | 3 | 1 | 3 | 5 | 2 | First Strike, Hit and Run |
| Ashfall Interceptor | 4 | 1 | 2 | 4 | 1 | Evasion |
| Ashfall Raider | 4 | 0 | 3 | 5 | 2 | Raider |
| Ashfall Firestorm | 5 | 1 | 4 | 4 | 3 | First Strike, Raider |

### Meridian Collective (Utility)

| Card | ⚔ | 🛡 | ♥ | ⚡ | Cost | Abilities |
|------|---|---|---|---|------|-----------|
| Meridian Trader | 3 | 2 | 4 | 3 | 1 | Trade Routes |
| Meridian Diplomat | 2 | 2 | 5 | 3 | 2 | Diplomat, Repair Drone |
| Meridian Escort | 4 | 2 | 4 | 3 | 2 | Adaptable |
| Meridian Flagship | 4 | 3 | 6 | 2 | 3 | Trade Routes, Adaptable |

### Void Wardens (Defense)

| Card | ⚔ | 🛡 | ♥ | ⚡ | Cost | Abilities |
|------|---|---|---|---|------|-----------|
| Void Bulwark | 2 | 3 | 7 | 2 | 2 | Taunt, Shield Generator |
| Void Sentinel | 3 | 3 | 6 | 3 | 2 | Regenerate |
| Void Guardian | 2 | 4 | 8 | 1 | 3 | Taunt, Stalwart |
| Void Bastion | 3 | 4 | 9 | 1 | 4 | Taunt, Shield Generator, Regenerate |

### Sundered Oath (Aggression)

| Card | ⚔ | 🛡 | ♥ | ⚡ | Cost | Abilities |
|------|---|---|---|---|------|-----------|
| Oath Berserker | 5 | 0 | 3 | 4 | 2 | Berserker |
| Oath Reaver | 6 | 1 | 3 | 3 | 2 | Overkill |
| Oath Martyr | 4 | 1 | 4 | 3 | 2 | Death Wish, Blood Price |
| Oath Champion | 7 | 1 | 5 | 3 | 4 | Berserker, Overkill |

---

*This document is a living proposal. Feedback and iteration expected.*
