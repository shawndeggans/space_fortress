# Diplomacy & Alliance System Redesign

> **Status:** Design Proposal
> **Created:** 2025-12-18
> **Related:** [Card Battle Redesign](./CARD-BATTLE-REDESIGN.md)
> **Inspiration:** Stellaris, Crusader Kings III, Endless Legend

---

## Executive Summary

The current alliance system is transactional: view terms → form alliance → get cards → lose bounty share. There's no friction, no consequences that persist, and no sense that you're navigating a complex political landscape.

This redesign transforms diplomacy into a strategic layer where:
- **Past choices constrain future options** (you can't befriend everyone)
- **Relationships evolve across quests** (not reset each time)
- **Factions have their own agendas** (they want things from you)
- **Trust is earned and can be broken** (betrayal has lasting consequences)
- **Alliance quality affects battle** (not just card count, but card power)

---

## Current System Analysis

### What Works
- Five distinct factions with clear identities
- Reputation tracking (-100 to +100)
- Conflict relationships (Ironveil ↔ Ashfall, Void Wardens ↔ Sundered Oath)
- Secret alliance mechanic (risk/reward)
- Bounty share as alliance cost

### What's Missing
- **No persistent relationships** - Alliances reset each quest
- **No faction agency** - Factions don't pursue their own goals
- **No diplomatic friction** - Forming alliances is too easy
- **No meaningful blocking** - Rarely locked out of options
- **No favors/debts** - No currency beyond reputation
- **No treaty variety** - Only one type of alliance
- **No negotiation** - Accept or reject, no middle ground
- **Weak battle integration** - Alliance just adds 2 fixed cards

---

## Core Design Philosophy

### The Political Triangle

Every diplomatic decision involves three tensions:

```
                    POWER
                     /\
                    /  \
                   /    \
                  /      \
                 /   YOU  \
                /          \
               /____________\
          REPUTATION      WEALTH
```

- **Power** - Military strength, battle capability, card quality
- **Reputation** - Standing with factions, future options
- **Wealth** - Bounty, resources, immediate rewards

You cannot maximize all three. Strong alliances cost bounty. Betrayal costs reputation. Going alone costs power.

### The Faction Web

Factions don't just react to you—they react to each other:

```
                 IRONVEIL ←--RIVALS--→ ASHFALL
                    ↑                     ↑
                    |                     |
                 TRADES              SYMPATHIZES
                    |                     |
                    ↓                     ↓
                MERIDIAN ←--NEUTRAL--→ VOID WARDENS
                    ↑                     ↑
                    |                     |
               DISTRUSTS              ENEMIES
                    |                     |
                    ↓                     ↓
              SUNDERED OATH ←-OUTCASTS-→ (all)
```

Helping one faction affects how others see you AND how they see each other.

---

## New Mechanics

### 1. Influence System

**Influence** is diplomatic currency earned through actions and spent on diplomatic options.

```typescript
interface InfluenceState {
  current: number           // Spendable influence
  maximum: number           // Cap (grows with reputation)
  perQuestGeneration: number // Gained at quest start
}

// Starting values
const INITIAL_INFLUENCE = {
  current: 10,
  maximum: 20,
  perQuestGeneration: 5
}
```

**Earning Influence:**
| Action | Influence Gained |
|--------|------------------|
| Complete quest for faction | +5 |
| Fulfill faction request | +3 to +8 |
| Win battle against faction's enemy | +2 |
| Sacrifice bounty for faction cause | +1 per 100 bounty |
| Reach "Friendly" status | +5 (one-time) |
| Reach "Devoted" status | +10 (one-time) |

**Spending Influence:**
| Action | Influence Cost |
|--------|----------------|
| Request alliance (Neutral) | 8 |
| Request alliance (Friendly) | 4 |
| Request alliance (Devoted) | 0 (automatic) |
| Improve treaty terms | 3-6 |
| Request specific cards | 5 per card |
| Demand favor | 10 |
| Break treaty without penalty | 15 |
| Override blocked alliance | 20+ |

### 2. Faction Standing (Enhanced Reputation)

Reputation evolves into a richer **Standing** system with multiple components:

```typescript
interface FactionStanding {
  // Core reputation (-100 to +100)
  reputation: number

  // Trust: How much they believe your word (0-100)
  // Affects: Treaty options, secret alliance success
  trust: number

  // Favor: What you've done for them recently (0-50, decays)
  // Affects: Request acceptance, special card access
  favor: number

  // Fear: How much they fear your power (0-100)
  // Affects: Tribute demands, intimidation options
  fear: number

  // History: Key events that shaped relationship
  history: DiplomaticEvent[]
}
```

**Trust Mechanics:**
- Starts at 50 (neutral trust)
- +10 when you honor an alliance in battle
- +5 when you fulfill a faction request
- -30 when you break a treaty
- -50 when you betray them in battle
- Trust < 20: They refuse most treaties
- Trust > 80: They offer favorable terms unprompted

**Favor Mechanics:**
- Decays by 5 each quest (factions have short memories for good deeds)
- High favor unlocks special requests
- Can be "cashed in" for one-time benefits
- Example: 30+ favor with Void Wardens = they warn you of ambushes

**Fear Mechanics:**
- Increases when you defeat a faction's allies
- Increases when you have a dominant fleet
- High fear: Intimidation options become available
- High fear + Low trust = faction may preemptively attack
- Fear is a double-edged sword

### 3. Faction Agendas

Each faction pursues goals across the campaign. Helping or hindering these affects your standing significantly.

```typescript
interface FactionAgenda {
  id: string
  faction: FactionId
  type: AgendaType
  description: string
  progress: number        // 0-100
  playerContribution: number  // How much player helped/hindered
  reward: AgendaReward
  consequence: AgendaConsequence
}

type AgendaType =
  | 'territorial'    // Control regions
  | 'economic'       // Accumulate wealth
  | 'military'       // Defeat enemies
  | 'ideological'    // Spread influence
  | 'survival'       // Simply persist
```

**Example Faction Agendas:**

| Faction | Agenda | Description | Player Impact |
|---------|--------|-------------|---------------|
| **Ironveil** | Debt Collection | Recover 5000 bounty worth of "defaulted contracts" | Help collect = +rep, cards. Protect debtors = blocked. |
| **Ashfall** | Liberation | Free 3 Remnant settlements from Ironveil control | Assist raids = alliance unlocked. Report to Ironveil = Ashfall hostile. |
| **Meridian** | Information Monopoly | Establish trade routes in all sectors | Share intel = favored terms. Withhold = standard terms. |
| **Void Wardens** | Maintain Order | Prevent 3 major conflicts from escalating | Support peacekeeping = elite cards. Escalate conflicts = blocked. |
| **Sundered Oath** | Survival | Acquire resources for the exiled fleet | Share supplies = secret alliance option. Expose location = permanent enemy. |

**Agenda Events:**
```typescript
| { type: 'AGENDA_PROGRESSED'; data: { factionId: FactionId; agendaId: string; delta: number; playerCaused: boolean } }
| { type: 'AGENDA_COMPLETED'; data: { factionId: FactionId; agendaId: string; playerContribution: number } }
| { type: 'AGENDA_FAILED'; data: { factionId: FactionId; agendaId: string; playerContribution: number } }
```

### 4. Treaty Types

Replace the single "alliance" with a spectrum of diplomatic arrangements:

```typescript
type TreatyType =
  | 'non_aggression'      // Won't attack each other
  | 'trade_agreement'     // Economic benefits
  | 'military_access'     // Share tactical information
  | 'defensive_pact'      // Help if attacked
  | 'offensive_alliance'  // Fight together
  | 'vassalage'           // You serve them
  | 'protectorate'        // They serve you
```

**Treaty Comparison:**

| Treaty | Card Benefit | Bounty Share | Requires | Duration |
|--------|--------------|--------------|----------|----------|
| Non-Aggression | None | None | Neutral+ | 3 quests |
| Trade Agreement | +1 card option | 10% | Neutral+ | 2 quests |
| Military Access | See their fleet | 15% | Friendly+ | 1 quest |
| Defensive Pact | +2 cards if attacked | 20% | Friendly+, Trust 60+ | 2 quests |
| Offensive Alliance | +3 cards, ability unlock | 25-35% | Devoted OR Favor 30+ | 1 quest |
| Vassalage | +4 cards, all abilities | 50% | Fear 80+ toward you | Permanent |
| Protectorate | -2 cards, protection | -10% (they pay you) | Devoted, Trust 90+ | 3 quests |

### 5. Blocking Conditions

Previous choices can **lock you out** of diplomatic options. This creates meaningful consequences.

```typescript
interface DiplomaticBlock {
  blockedAction: string        // What's blocked
  reason: string               // Why
  blockedByFaction?: FactionId // Who's blocking
  permanent: boolean           // Can it be overcome?
  overrideCost?: number        // Influence to override
}
```

**Blocking Scenarios:**

| Your Action | Consequence |
|-------------|-------------|
| Allied with Ironveil against Ashfall | Ashfall treaties blocked for 2 quests |
| Betrayed a Defensive Pact | That faction blocks ALL treaties permanently |
| Revealed Sundered Oath location | Sundered Oath permanently hostile |
| Killed a faction leader's relative | Personal vendetta - must defeat in combat to clear |
| Accumulated 3+ broken treaties | Meridian (the diplomats) refuse to mediate |
| Refused faction request 3 times | Favor locked at 0 with that faction |

**Block Override System:**
Some blocks can be overcome with enough Influence:

```typescript
function canOverrideBlock(block: DiplomaticBlock, influence: number): boolean {
  if (block.permanent) return false
  return influence >= (block.overrideCost ?? Infinity)
}

// Example: Ashfall is blocked due to Ironveil alliance
// Override cost: 20 Influence + public denouncement of Ironveil
// Denouncement triggers: Ironveil reputation -30, Ironveil treaty voided
```

### 6. Faction Requests

Factions actively ask things of you, creating dynamic diplomatic pressure.

```typescript
interface FactionRequest {
  id: string
  fromFaction: FactionId
  type: RequestType
  description: string
  deadline: number           // Quests until expires
  reward: RequestReward
  refusalConsequence: RequestConsequence
  acceptanceConsequence: RequestConsequence
}

type RequestType =
  | 'combat'        // Fight someone for them
  | 'delivery'      // Transport cargo
  | 'intelligence'  // Spy on another faction
  | 'betrayal'      // Break treaty with faction X
  | 'tribute'       // Pay bounty
  | 'card_loan'     // Lend them a card temporarily
  | 'abstention'    // Don't ally with faction X
```

**Example Requests:**

**Ironveil Request: "Debt Enforcement"**
```
Castellan Vorn requires your assistance collecting a debt
from an Ashfall settlement. They've defaulted on a contract
worth 800 bounty. Recover it, and you'll receive 30% finder's fee.

[ ] Accept: +240 bounty, +10 Ironveil rep, Ashfall -15 rep
[ ] Refuse: Ironveil favor -5, request expires
[ ] Counter-offer: Negotiate 50% fee (costs 5 Influence)
```

**Ashfall Request: "Silent Running"**
```
Elder Yara needs safe passage for three refugee transports.
Ironveil patrols are heavy. Look the other way, or better yet,
provide cover.

[ ] Provide Cover: +15 Ashfall rep, Ironveil -20 rep if discovered
                   Unlocks: Ashfall Offensive Alliance option
[ ] Look Away: +5 Ashfall rep, no risk
[ ] Report to Ironveil: +10 Ironveil rep, Ashfall becomes Hostile
[ ] Refuse: Ashfall favor -10
```

**Request Consequences:**
- Accepting builds favor and can unlock treaties
- Refusing repeatedly (3+) locks favor at 0
- Some requests are traps (accepting harms you)
- Counter-offers cost Influence but yield better terms

### 7. Diplomatic Events

Random events create dynamic political situations:

```typescript
interface DiplomaticEvent {
  id: string
  type: DiplomaticEventType
  involvedFactions: FactionId[]
  description: string
  playerOptions: DiplomaticChoice[]
  autoResolveAfter?: number  // Quests until auto-resolves
}

type DiplomaticEventType =
  | 'faction_conflict'    // Two factions clash
  | 'power_shift'         // Leadership change
  | 'resource_crisis'     // Shortage affects relations
  | 'scandal'             // Secret exposed
  | 'opportunity'         // Rare treaty chance
  | 'ultimatum'           // Faction demands response
```

**Example Events:**

**"The Ironveil Succession Crisis"**
```
Castellan Vorn has fallen ill. Two successors vie for control:
- Commander Thresh (militarist, hates Ashfall more)
- Director Sela (pragmatist, open to Meridian trade)

Your reputation with Ironveil is Friendly. Both seek your endorsement.

[ ] Endorse Thresh: Ironveil +10, future Ashfall penalties doubled
[ ] Endorse Sela: Ironveil +5, unlock Ironveil-Meridian joint treaty
[ ] Remain Neutral: No change, but lose Ironveil favor -5
[ ] Exploit Crisis: Demand concession for endorsement (needs 10 Influence)
```

**"Meridian Intelligence Leak"**
```
Meridian intercepted communications reveal your secret alliance
with Sundered Oath during Quest 2. They're offering to keep quiet...
for a price.

Your Trust with Sundered Oath: 75
Your Reputation with Void Wardens: 40 (Friendly)

[ ] Pay 500 bounty: Secret remains hidden
[ ] Reveal willingly: Void Wardens become Hostile, Sundered trust +20
[ ] Threaten Meridian: Costs 8 Influence, 40% chance they back down
[ ] Let it leak: All factions adjust based on their view of Sundered Oath
```

---

## Integration with Card Battles

The diplomacy system directly affects combat through several mechanisms:

### Alliance Quality Tiers

Alliance effectiveness depends on relationship quality:

| Standing Level | Cards Provided | Card Quality | Ability Access |
|----------------|----------------|--------------|----------------|
| Forced (Fear 80+) | 4 | Standard | None |
| Neutral (Influence spent) | 2 | Standard | None |
| Friendly | 2 | Enhanced (+1 to one stat) | Basic abilities |
| Devoted | 3 | Enhanced | All abilities |
| Devoted + High Trust | 3 | Elite (faction's best) | All + unique ability |

### Card Quality Effects

```typescript
interface AllianceCardModifier {
  quality: 'standard' | 'enhanced' | 'elite'
  statBonus: number           // +0, +1, or +2 to highest stat
  abilityAccess: 'none' | 'basic' | 'full' | 'unique'
  loyalty: number             // 0-100, affects ability to keep card post-battle
}
```

**Standard Cards (Neutral Alliance):**
- Base stats as defined
- No abilities active
- Return to faction after battle

**Enhanced Cards (Friendly/Devoted):**
- +1 to primary stat
- Basic faction abilities active
- 25% chance to keep one card permanently

**Elite Cards (Devoted + Trust 80+):**
- +2 to primary stat
- All abilities active
- 50% chance to keep one card permanently
- Unique "Commander" ability unlocked

### Battle Consequences Affect Diplomacy

Combat outcomes feed back into the diplomatic layer:

```typescript
// After battle resolution
interface BattleDiplomaticEffects {
  // Alliance performance
  alliedCardsUsed: number
  alliedCardsDestroyed: number
  alliedCardsSurvived: number

  // Calculated effects
  allyTrustChange: number       // Based on how well you protected their cards
  allyFavorChange: number       // Based on victory/defeat
  enemyFearChange: number       // Based on how decisively you won

  // Special triggers
  heroicMoment?: string         // Allied card dealt final blow = extra rep
  betrayalDetected?: string     // Allied card "accidentally" destroyed = trust hit
}
```

**Example Battle Consequences:**

| Outcome | Diplomatic Effect |
|---------|-------------------|
| Allied card dealt killing blow to flagship | +5 reputation with that faction |
| Allied card destroyed while yours survive | -10 trust ("you sacrificed us") |
| Victory with ally taking no damage | +5 favor |
| Defeat while ally took most damage | -5 favor, -10 trust |
| You destroyed your own allied card | BETRAYAL: -30 trust, treaty void |

### Pre-Battle Diplomatic Actions

Before deployment, new diplomatic options:

**Request Reinforcements** (costs Favor)
- Spend 10 favor with allied faction
- Receive 1 additional card for this battle
- Must have active treaty

**Demand Tribute** (costs Fear)
- Spend 15 fear with enemy faction
- Enemy starts with -1 card
- Risk: If you lose, fear resets to 0

**Call for Mediation** (Meridian only)
- Spend 8 Influence
- Meridian offers enemy a "stand down" option
- 30% chance battle is avoided (partial bounty, no card rewards)

**Invoke Defensive Pact**
- Automatic if you have Defensive Pact and were attacked
- Allied faction joins with full card complement
- You owe them a battle favor (must assist in their next conflict)

---

## Relationship Web Visualization

Players need to see the political landscape at a glance:

```
┌────────────────────────────────────────────────────────────────┐
│                     FACTION RELATIONS                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                      ┌─────────────┐                           │
│         ╔═══════════│  IRONVEIL   │═══════════╗               │
│         ║           │  Rep: +45   │           ║               │
│         ║           │  Trust: 72  │           ║               │
│         ║           │  Favor: 15  │           ║               │
│         ║           └──────┬──────┘           ║               │
│         ║                  │                  ║               │
│         ║              RIVALS                 ║               │
│         ║                  │                  ║               │
│         ║           ┌──────┴──────┐           ║               │
│         ║           │   ASHFALL   │           ║               │
│      ALLIED         │  Rep: -35   │       HOSTILE             │
│         ║           │  Trust: 20  │           ║               │
│         ║           │  Favor: 0   │           ║               │
│         ║           └─────────────┘           ║               │
│         ║                                     ║               │
│   ┌─────╨─────┐                       ┌───────╨───────┐       │
│   │ MERIDIAN  │                       │ VOID WARDENS  │       │
│   │ Rep: +10  │═══════NEUTRAL════════│  Rep: +25     │       │
│   │ Trust: 55 │                       │  Trust: 60    │       │
│   └───────────┘                       └───────────────┘       │
│         ║                                     ║               │
│      TRADES                               ENEMIES             │
│         ║                                     ║               │
│   ┌─────╨──────────────────────────────────────╨─────┐       │
│   │                  SUNDERED OATH                    │       │
│   │  Rep: -60 (Hostile)  Trust: 10   Favor: 0        │       │
│   │  ⚠ BLOCKED: "Reported location to Void Wardens"  │       │
│   └──────────────────────────────────────────────────┘       │
│                                                                │
│  YOUR INFLUENCE: 12/25        ACTIVE TREATIES: 2              │
│  ├─ Ironveil: Offensive Alliance (1 quest remaining)          │
│  └─ Meridian: Trade Agreement (2 quests remaining)            │
│                                                                │
│  PENDING REQUESTS: 1                                          │
│  └─ Void Wardens: "The Smuggler's Evidence" (2 quests left)   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## New Events

### Diplomatic Events

```typescript
// Influence changes
| { type: 'INFLUENCE_GAINED'; data: { amount: number; source: string; newTotal: number } }
| { type: 'INFLUENCE_SPENT'; data: { amount: number; action: string; target?: FactionId; newTotal: number } }

// Standing changes (replaces simple reputation)
| { type: 'STANDING_CHANGED'; data: {
    faction: FactionId
    reputation: { old: number; new: number; delta: number }
    trust: { old: number; new: number; delta: number }
    favor: { old: number; new: number; delta: number }
    fear: { old: number; new: number; delta: number }
    source: string
  }
}

// Treaty lifecycle
| { type: 'TREATY_PROPOSED'; data: { fromFaction: FactionId; treatyType: TreatyType; terms: TreatyTerms } }
| { type: 'TREATY_ACCEPTED'; data: { faction: FactionId; treatyType: TreatyType; duration: number } }
| { type: 'TREATY_REJECTED'; data: { faction: FactionId; treatyType: TreatyType; reason: string } }
| { type: 'TREATY_EXPIRED'; data: { faction: FactionId; treatyType: TreatyType } }
| { type: 'TREATY_BROKEN'; data: { faction: FactionId; treatyType: TreatyType; consequence: string } }

// Requests
| { type: 'REQUEST_RECEIVED'; data: { faction: FactionId; request: FactionRequest } }
| { type: 'REQUEST_ACCEPTED'; data: { faction: FactionId; requestId: string } }
| { type: 'REQUEST_REFUSED'; data: { faction: FactionId; requestId: string; consequence: string } }
| { type: 'REQUEST_COMPLETED'; data: { faction: FactionId; requestId: string; reward: string } }
| { type: 'REQUEST_FAILED'; data: { faction: FactionId; requestId: string; consequence: string } }
| { type: 'REQUEST_EXPIRED'; data: { faction: FactionId; requestId: string } }

// Blocking
| { type: 'DIPLOMATIC_BLOCK_ADDED'; data: { faction: FactionId; blockType: string; reason: string; permanent: boolean } }
| { type: 'DIPLOMATIC_BLOCK_REMOVED'; data: { faction: FactionId; blockType: string; method: 'expired' | 'override' | 'event' } }

// Agendas
| { type: 'AGENDA_REVEALED'; data: { faction: FactionId; agenda: FactionAgenda } }
| { type: 'AGENDA_PROGRESS_CHANGED'; data: { faction: FactionId; agendaId: string; oldProgress: number; newProgress: number } }
| { type: 'AGENDA_COMPLETED'; data: { faction: FactionId; agendaId: string; outcome: 'success' | 'failure' } }

// World events
| { type: 'DIPLOMATIC_EVENT_OCCURRED'; data: { event: DiplomaticEvent } }
| { type: 'DIPLOMATIC_CHOICE_MADE'; data: { eventId: string; choiceId: string; consequences: string[] } }
```

### New Commands

```typescript
// Treaty management
| { type: 'PROPOSE_TREATY'; data: { factionId: FactionId; treatyType: TreatyType } }
| { type: 'ACCEPT_TREATY'; data: { factionId: FactionId; treatyId: string } }
| { type: 'REJECT_TREATY'; data: { factionId: FactionId; treatyId: string } }
| { type: 'BREAK_TREATY'; data: { factionId: FactionId; treatyId: string; payInfluence: boolean } }
| { type: 'NEGOTIATE_TERMS'; data: { factionId: FactionId; treatyId: string; proposedTerms: TreatyTerms } }

// Requests
| { type: 'ACCEPT_REQUEST'; data: { factionId: FactionId; requestId: string } }
| { type: 'REFUSE_REQUEST'; data: { factionId: FactionId; requestId: string } }
| { type: 'COUNTER_REQUEST'; data: { factionId: FactionId; requestId: string; counterTerms: any } }

// Influence actions
| { type: 'SPEND_INFLUENCE'; data: { amount: number; action: string; targetFaction?: FactionId } }
| { type: 'OVERRIDE_BLOCK'; data: { factionId: FactionId; blockType: string } }

// Diplomatic events
| { type: 'RESPOND_TO_EVENT'; data: { eventId: string; choiceId: string } }

// Pre-battle diplomacy
| { type: 'REQUEST_REINFORCEMENTS'; data: { battleId: string; factionId: FactionId } }
| { type: 'DEMAND_TRIBUTE'; data: { battleId: string; factionId: FactionId } }
| { type: 'CALL_MEDIATION'; data: { battleId: string } }
| { type: 'INVOKE_PACT'; data: { battleId: string; pactType: string } }
```

---

## UI/UX Concepts

### Diplomacy Screen

New dedicated screen accessible from main navigation:

```
┌──────────────────────────────────────────────────────────────────┐
│  DIPLOMATIC AFFAIRS                    Influence: ●●●●●●○○ 12/20 │
├───────────┬──────────────────────────────────────────────────────┤
│           │                                                      │
│ FACTIONS  │  ╔═══════════════════════════════════════════════╗  │
│           │  ║           IRONVEIL SYNDICATE                  ║  │
│ ■ Ironveil│  ╠═══════════════════════════════════════════════╣  │
│ □ Ashfall │  ║  STANDING                                     ║  │
│ □ Meridian│  ║  ├─ Reputation: +45 (Friendly)    ████████░░  ║  │
│ □ Void W. │  ║  ├─ Trust: 72                     ███████░░░  ║  │
│ □ Sundered│  ║  ├─ Favor: 15 (decays next quest) █░░░░░░░░░  ║  │
│           │  ║  └─ Fear: 30                      ███░░░░░░░  ║  │
│───────────│  ╠═══════════════════════════════════════════════╣  │
│           │  ║  ACTIVE TREATY                                ║  │
│ REQUESTS  │  ║  └─ Offensive Alliance (expires: Quest 4)     ║  │
│ (1 new)   │  ║     • +3 cards in battle                      ║  │
│           │  ║     • 25% bounty share                        ║  │
│ TREATIES  │  ║     • Full ability access                     ║  │
│ (2 active)│  ╠═══════════════════════════════════════════════╣  │
│           │  ║  CURRENT AGENDA                               ║  │
│ HISTORY   │  ║  "Debt Collection" ███████░░░ 70%             ║  │
│           │  ║  Recover defaulted contracts worth 5000 bounty║  │
│           │  ║  Your contribution: +35%                      ║  │
│           │  ╠═══════════════════════════════════════════════╣  │
│           │  ║  AVAILABLE ACTIONS              Cost          ║  │
│           │  ║  ├─ [Negotiate Trade Agreement]   4 Influence ║  │
│           │  ║  ├─ [Request Specific Card]       5 Influence ║  │
│           │  ║  ├─ [Improve Treaty Terms]        6 Influence ║  │
│           │  ║  └─ [Break Alliance]             15 Influence ║  │
│           │  ╚═══════════════════════════════════════════════╝  │
└───────────┴──────────────────────────────────────────────────────┘
```

### Treaty Negotiation Modal

```
╔═══════════════════════════════════════════════════════════════╗
║                 TREATY NEGOTIATION                            ║
║                 Ironveil Syndicate                            ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Proposed: OFFENSIVE ALLIANCE                                 ║
║                                                               ║
║  ┌─────────────────────┐    ┌─────────────────────┐          ║
║  │   THEIR TERMS       │    │   YOUR COUNTER      │          ║
║  ├─────────────────────┤    ├─────────────────────┤          ║
║  │ Cards: 2            │ → │ Cards: 3 (+5 Inf)   │          ║
║  │ Bounty Share: 30%   │ → │ Bounty Share: 25%   │          ║
║  │ Duration: 1 quest   │   │ Duration: 1 quest   │          ║
║  │ Abilities: Basic    │ → │ Abilities: Full     │          ║
║  └─────────────────────┘    └─────────────────────┘          ║
║                                                               ║
║  Negotiation Cost: 8 Influence (you have 12)                 ║
║  Success Chance: 75% (based on Trust: 72)                    ║
║                                                               ║
║  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         ║
║  │   ACCEPT     │ │  NEGOTIATE   │ │   REJECT     │         ║
║  │  (as shown)  │ │ (spend 8 Inf)│ │  (no cost)   │         ║
║  └──────────────┘ └──────────────┘ └──────────────┘         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Faction Request Interface

```
╔═══════════════════════════════════════════════════════════════╗
║  📨 NEW REQUEST FROM VOID WARDENS                             ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  "The Smuggler's Evidence"                                    ║
║                                                               ║
║  Sentinel Krath speaks:                                       ║
║  "We've intercepted a Sundered Oath smuggling vessel carrying ║
║   evidence of war crimes. The ship escaped into the Shatter   ║
║   Belt. Track them down and recover the data cores."          ║
║                                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │  DEADLINE: 2 quests remaining                           │ ║
║  │  DIFFICULTY: Medium (may trigger combat)                │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  IF COMPLETED:                           IF REFUSED:          ║
║  • +15 Void Warden reputation            • -5 Favor           ║
║  • +10 Trust                             • Request expires    ║
║  • Unlock: Elite card "Sentinel Prime"   • No other penalty   ║
║  • -25 Sundered Oath reputation                               ║
║                                                               ║
║  ⚠ WARNING: This may trigger Sundered Oath hostility         ║
║                                                               ║
║  ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐      ║
║  │   ACCEPT     │ │ COUNTER-OFFER    │ │   REFUSE     │      ║
║  │              │ │ (demand payment) │ │              │      ║
║  │              │ │  Costs 5 Inf     │ │              │      ║
║  └──────────────┘ └──────────────────┘ └──────────────┘      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Implementation Roadmap

### Phase 1: Enhanced Standing System
- [ ] Replace simple reputation with Standing (reputation, trust, favor, fear)
- [ ] Implement decay mechanics for favor
- [ ] Add trust-based treaty restrictions
- [ ] Update projections for new standing model
- [ ] Create standing visualization UI

### Phase 2: Influence System
- [ ] Add Influence as diplomatic currency
- [ ] Implement Influence earning (quest completion, favors, milestones)
- [ ] Implement Influence spending (treaty requests, overrides, demands)
- [ ] Add Influence cap based on total standing
- [ ] Create Influence tracking UI

### Phase 3: Treaty Variety
- [ ] Define all treaty types with benefits/costs
- [ ] Implement treaty duration and expiration
- [ ] Add treaty breaking mechanics and consequences
- [ ] Create negotiation system (counter-offers)
- [ ] Build treaty management UI

### Phase 4: Faction Requests
- [ ] Design request types and templates
- [ ] Implement request generation based on faction state
- [ ] Add deadline and consequence system
- [ ] Create request notification and response UI
- [ ] Connect request outcomes to standing changes

### Phase 5: Blocking & Consequences
- [ ] Implement diplomatic blocks (temporary and permanent)
- [ ] Add block override mechanics (Influence cost)
- [ ] Create block visualization in faction UI
- [ ] Add warning system for actions that cause blocks
- [ ] Implement history tracking for block causes

### Phase 6: Faction Agendas
- [ ] Design agendas for each faction
- [ ] Implement agenda progress tracking
- [ ] Connect player actions to agenda progress
- [ ] Add agenda completion rewards/consequences
- [ ] Create agenda visualization UI

### Phase 7: Battle Integration
- [ ] Implement alliance quality tiers (card modifiers)
- [ ] Add battle-to-diplomacy feedback (ally card performance)
- [ ] Implement pre-battle diplomatic actions
- [ ] Create card loyalty system (keeping alliance cards)
- [ ] Connect betrayal detection to trust penalties

### Phase 8: Dynamic Events
- [ ] Design event templates for each type
- [ ] Implement event triggers (random, state-based)
- [ ] Add event choice resolution
- [ ] Create event notification UI
- [ ] Connect events to faction web changes

---

## Migration Strategy

### Preserving Existing Saves

```typescript
function migrateDiplomacyState(oldState: GameState): GameState {
  return {
    ...oldState,

    // Convert simple reputation to standing
    factionStanding: Object.entries(oldState.reputation).reduce(
      (acc, [faction, rep]) => ({
        ...acc,
        [faction]: {
          reputation: rep,
          trust: 50 + (rep / 4),  // Derive initial trust from reputation
          favor: 0,               // Start fresh
          fear: 0,                // Start fresh
          history: []
        }
      }),
      {} as Record<FactionId, FactionStanding>
    ),

    // Initialize new systems
    influence: {
      current: 10,
      maximum: 20,
      perQuestGeneration: 5
    },

    activeTreaties: [],        // No existing treaties
    pendingRequests: [],       // No pending requests
    diplomaticBlocks: [],      // No blocks
    factionAgendas: initializeAgendas(),  // Fresh agendas

    // Keep old reputation for backward compat during migration
    reputation: oldState.reputation
  }
}
```

### Feature Flags

```typescript
const DIPLOMACY_VERSION = import.meta.env.VITE_DIPLOMACY_SYSTEM ?? 'legacy'

// 'legacy' - Current simple system
// 'enhanced' - New full system
// 'hybrid' - Legacy with standing visible but not enforced
```

---

## Balancing Considerations

### Influence Economy

| Quest Type | Influence Earned | Influence Spent (Typical) |
|------------|------------------|---------------------------|
| Faction-aligned quest | +5 to +8 | 4-8 (treaty + negotiation) |
| Neutral quest | +2 to +3 | 4-6 (treaty only) |
| Anti-faction quest | +5 from enemy | 15+ (override blocks) |

**Target:** Players should feel influence-rich enough to pursue ONE diplomatic path aggressively, but not enough to befriend everyone.

### Blocking Frequency

- Players should hit 1-2 blocks by mid-campaign (quest 2-3)
- Permanent blocks should be rare (1 per campaign average)
- Override costs should require saving influence across quests

### Trust Recovery

- Trust should recover slowly (2-3 per quest passively)
- Active trust-building (completing requests) should be faster (+5 to +10)
- Betrayal should be devastating (-30 to -50) but recoverable over time
- Repeated betrayal should lock trust near 0

---

## Alternative: Card-Based Negotiation

Rather than a menu-driven diplomacy system, negotiations could be a **card game within the card game**. This creates mechanical consistency and makes diplomacy feel like gameplay rather than UI management.

### The Negotiation Table

When entering diplomatic negotiations, both sides play "Argument Cards" to a shared table. The goal is to accumulate enough "Leverage" to force favorable terms.

```
╔═══════════════════════════════════════════════════════════════════╗
║              NEGOTIATION: Offensive Alliance                      ║
║              vs. Castellan Vorn (Ironveil Syndicate)              ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║   THEIR POSITION              │   YOUR POSITION                   ║
║   Leverage: 8                 │   Leverage: 12                    ║
║   ┌────────┐ ┌────────┐      │   ┌────────┐ ┌────────┐           ║
║   │DEBT    │ │FLEET   │      │   │PROVEN  │ │TRADE   │           ║
║   │REMINDER│ │THREAT  │      │   │LOYALTY │ │LEVERAGE│           ║
║   │  +3    │ │  +5    │      │   │  +4    │ │  +3    │           ║
║   └────────┘ └────────┘      │   └────────┘ └────────┘           ║
║                               │   ┌────────┐ ┌────────┐           ║
║   [Playing cautiously]        │   │INTEL   │ │WITNESS │           ║
║                               │   │OFFER   │ │ACCOUNT │           ║
║                               │   │  +3    │ │  +2    │           ║
║                               │   └────────┘ └────────┘           ║
║                                                                   ║
║   ─────────────────────────────────────────────────────────────   ║
║                                                                   ║
║   YOUR HAND (Argument Cards)                                      ║
║   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    ║
║   │MUTUAL  │ │PAST    │ │SUBTLE  │ │CALL    │                    ║
║   │BENEFIT │ │FAVOR   │ │THREAT  │ │BLUFF   │                    ║
║   │  +4    │ │  +3    │ │  +2*   │ │  ?     │                    ║
║   │Diplo   │ │Trust   │ │Fear    │ │Risk    │                    ║
║   └────────┘ └────────┘ └────────┘ └────────┘                    ║
║                                                                   ║
║   TERMS AT CURRENT LEVERAGE (You winning +4):                     ║
║   • Cards: 3 (was 2) │ Bounty Share: 22% (was 30%) │ Duration: 1  ║
║                                                                   ║
║   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              ║
║   │ PLAY CARD   │  │ PASS (lock) │  │ CONCEDE     │              ║
║   └─────────────┘  └─────────────┘  └─────────────┘              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Argument Card Types

Diplomacy uses a separate deck of "Argument Cards" that represent negotiation tactics:

```typescript
interface ArgumentCard {
  id: string
  name: string
  type: ArgumentType
  leverage: number           // Base leverage provided
  requirement?: CardRequirement  // Conditions to play
  effect?: ArgumentEffect    // Special ability
  risk?: number              // Chance of backfiring (0-100)
  flavorText: string
}

type ArgumentType =
  | 'appeal'      // Persuasion, mutual benefit (safe)
  | 'leverage'    // Using information/resources (moderate)
  | 'threat'      // Intimidation (risky, uses Fear)
  | 'deception'   // Bluffs and misdirection (high risk/reward)
  | 'concession'  // Give something up for leverage
```

### Example Argument Cards

**Safe Cards (Appeal/Leverage):**

| Card | Type | Leverage | Effect |
|------|------|----------|--------|
| Mutual Benefit | Appeal | +4 | None - reliable |
| Past Favor | Leverage | +3 | +2 if Favor > 20 |
| Shared Enemy | Appeal | +3 | +3 if both hostile to same faction |
| Trade Offer | Leverage | +3 | Costs 100 bounty to play |
| Proven Loyalty | Appeal | +4 | Requires Trust > 60 |

**Moderate Risk Cards (Threat/Leverage):**

| Card | Type | Leverage | Risk | Effect |
|------|------|----------|------|--------|
| Fleet Display | Threat | +5 | 20% | Fail: They call bluff, -3 leverage |
| Intel Offer | Leverage | +4 | 10% | Success: +10 Trust afterward |
| Subtle Threat | Threat | +2 | 15% | Increases Fear by 5 regardless |
| Alliance Alternative | Leverage | +4 | 25% | Fail: They warn rival faction |

**High Risk Cards (Deception):**

| Card | Type | Leverage | Risk | Effect |
|------|------|----------|------|--------|
| Bold Bluff | Deception | +6 | 40% | Fail: Lose 3 leverage, -10 Trust |
| False Promise | Deception | +5 | 30% | Must fulfill or -20 Trust later |
| Fabricated Evidence | Deception | +7 | 50% | Fail: Treaty blocked permanently |
| Identity Leverage | Deception | +8 | 35% | Reveal a secret about their leader |

**Concession Cards (Guaranteed, but costs):**

| Card | Type | Leverage | Cost |
|------|------|----------|------|
| Bounty Sacrifice | Concession | +3 | -200 bounty |
| Card Offering | Concession | +4 | Loan them a card for 2 quests |
| Promise of Service | Concession | +5 | Must complete a request within 2 quests |
| Exclusive Contract | Concession | +6 | Cannot ally with their rival this quest |

### Negotiation Flow

1. **Opening Hands** - Both sides draw 4 Argument Cards
2. **Alternating Plays** - Each side plays one card or passes
3. **Risk Resolution** - Risky cards may backfire (roll against risk %)
4. **Passing** - When you pass, your leverage is locked
5. **Resolution** - Higher total leverage wins; margin determines terms

**Winning Margins:**

| Leverage Difference | Outcome |
|---------------------|---------|
| 0 (tie) | Standard terms, no modifications |
| 1-3 | Minor advantage (reduce bounty share 5%) |
| 4-6 | Moderate advantage (+1 card OR -10% bounty share) |
| 7-9 | Strong advantage (+1 card AND -10% bounty share) |
| 10+ | Dominant (+2 cards, -15% share, ability unlock) |

**Losing:**
- If they win by 4+, terms are worse than standard
- If they win by 10+, you may be forced into unfavorable treaty OR walk away

### Building Your Argument Deck

Just like battle cards, Argument Cards are collected throughout the campaign:

**Starting Deck (6 cards):**
- 2x Mutual Benefit (safe +4)
- 2x Trade Offer (safe +3)
- 1x Past Favor (+3, requires Favor)
- 1x Fleet Display (risky +5)

**Earning New Cards:**
- Completing faction quests grants faction-aligned argument cards
- High Trust unlocks powerful appeal cards
- High Fear unlocks threatening cards
- Betrayal paradoxically grants deception cards

**Faction-Flavored Argument Cards:**

| Faction | Signature Card | Effect |
|---------|----------------|--------|
| Ironveil | "Debt Reminder" | +4 leverage, +2 if they owe you bounty |
| Ashfall | "Rebel Sympathy" | +3, other factions can't see you played this |
| Meridian | "Information Broker" | Look at opponent's top 2 cards, +2 leverage |
| Void Wardens | "By the Code" | +5 if both parties have no active deception |
| Sundered Oath | "Desperate Offer" | +6, but opponent learns one of your secrets |

### Integration with Battle System

The two card systems can interact:

**Argument Cards affecting Battle:**
- "Promise of Coordination" - +2 leverage in negotiation, but allied cards get +1 stat in battle
- "Threatened Withdrawal" - +4 leverage, but if you lose negotiation, -1 card in battle

**Battle Cards as Leverage:**
- Showing a strong fleet (high-stat cards) grants bonus leverage in negotiations
- Offering to deploy specific cards as a "guarantee" provides leverage

**Shared Deck Building:**
- Some cards work in BOTH systems (rare)
- "Ironveil Diplomat" - In negotiation: +3 Appeal. In battle: 2/3/4 with "Parley" ability

### UI Concept: The Negotiation Table

```
┌─────────────────────────────────────────────────────────────────┐
│  NEGOTIATION with ELDER YARA (Ashfall Remnants)                 │
│  Seeking: Defensive Pact                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│      THEIR SIDE                    YOUR SIDE                    │
│    ╔═══════════╗                ╔═══════════╗                   │
│    ║ Leverage  ║                ║ Leverage  ║                   │
│    ║    7      ║                ║    11     ║                   │
│    ╚═══════════╝                ╚═══════════╝                   │
│                                                                 │
│    ┌───┐ ┌───┐                  ┌───┐ ┌───┐ ┌───┐              │
│    │ 3 │ │ 4 │  [thinking...]   │ 4 │ │ 3 │ │ 4 │              │
│    └───┘ └───┘                  └───┘ └───┘ └───┘              │
│                                                                 │
│════════════════════════════════════════════════════════════════│
│                      ~ THE TABLE ~                              │
│                                                                 │
│   "You're winning the argument. Push harder or lock in gains?" │
│                                                                 │
│════════════════════════════════════════════════════════════════│
│                                                                 │
│   YOUR HAND                                                     │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│   │ MUTUAL  │ │ SUBTLE  │ │ REBEL   │ │ BOLD    │              │
│   │ BENEFIT │ │ THREAT  │ │SYMPATHY │ │ BLUFF   │              │
│   │   +4    │ │   +2    │ │   +3    │ │   +6    │              │
│   │  Safe   │ │ 15%risk │ │  Safe   │ │ 40%risk │              │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                 │
│   [ PLAY CARD ]    [ PASS (lock at 11) ]    [ WALK AWAY ]      │
│                                                                 │
│   Projected terms if you win by 4:                              │
│   2 cards → 3 cards │ 25% share → 20% share                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Strategic Depth

This creates interesting decisions:

1. **When to pass?** - Leading by 4 is good, but pushing for 7+ risks them catching up
2. **Risk management** - Do you play the +6 Bluff with 40% backfire chance?
3. **Resource tradeoffs** - Concession cards guarantee leverage but cost you something
4. **Reading the opponent** - AI patterns can be learned; some factions bluff more
5. **Deck building** - What kind of negotiator are you? Safe and steady? High risk?

### Simplification Option: Quick Negotiation

If full card-based negotiation is too complex, a simpler version:

**Quick Negotiation (3 cards):**
1. Both sides play 3 cards face-down simultaneously
2. Reveal all at once
3. Compare totals, resolve risks
4. Higher total wins, margin determines terms

This preserves the card-based feel without alternating turns.

---

## Alternative Model: Favor System (Dominion: Allies-Inspired)

Instead of a separate negotiation card game, **integrate diplomacy into battle cards themselves**. This is inspired by Dominion: Allies, where Favors accumulate through normal play and unlock Ally abilities.

### Core Concept

- **Favors** are earned by playing faction-aligned cards in battle
- **Ally Abilities** are persistent bonuses you can activate by spending Favors
- **No separate negotiation phase** - diplomacy happens *through* combat

This creates a unified system where your battle deck IS your diplomatic tool.

### How Favors Work

```typescript
interface FavorState {
  favors: Record<FactionId, number>  // Accumulated per faction
}

// Favor ranges
// 0: No relationship
// 1-4: Minor favor (basic requests)
// 5-9: Notable favor (alliance available)
// 10-14: Strong favor (better terms)
// 15+: Devoted (best cards, lowest costs)
```

**Earning Favors:**

| Action | Favors Earned |
|--------|---------------|
| Play a faction's card in battle | +1 to that faction |
| Win a battle using faction's cards | +1 per surviving faction card |
| Complete quest for a faction | +3 to that faction |
| Faction card deals killing blow | +2 to that faction |
| Make choice favoring a faction | +1 to +3 based on impact |

**Losing Favors:**

| Action | Favors Lost |
|--------|-------------|
| Faction card destroyed in battle | -1 from that faction |
| Choose against a faction | -1 to -3 based on impact |
| Ally with rival faction | -2 from opposing faction |
| Break a promise | -5 from affected faction |

### Ally Cards (Persistent Benefits)

Each faction has an **Ally Card** - a persistent benefit that activates when you have enough Favors with them. Unlike battle cards, Ally Cards aren't played; they sit in a "Diplomacy Zone" and provide ongoing effects.

```
┌─────────────────────────────────────────────────────────┐
│                    DIPLOMACY ZONE                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │   IRONVEIL    │  │    ASHFALL    │  │  (locked)   │ │
│  │     ALLY      │  │     ALLY      │  │             │ │
│  │ ───────────── │  │ ───────────── │  │  MERIDIAN   │ │
│  │ Favors: 8/5 ✓ │  │ Favors: 3/5 ✗ │  │  Need 5     │ │
│  │               │  │               │  │  Have 2     │ │
│  │ DEBT LEVERAGE │  │ (inactive)    │  │             │ │
│  │ Spend 3 favor:│  │               │  │             │ │
│  │ Enemy -1 card │  │               │  │             │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Faction Ally Abilities

Each faction offers a unique Ally ability you can activate by spending accumulated Favors:

| Faction | Ally Name | Activation Cost | Effect |
|---------|-----------|-----------------|--------|
| **Ironveil** | Debt Leverage | 3 Favors | Enemy discards 1 card at battle start |
| **Ashfall** | Smuggler's Cache | 2 Favors | Draw 1 extra card this turn |
| **Meridian** | Trade Connections | 4 Favors | Gain 100 bounty; +1 card next battle |
| **Void Wardens** | Shield Protocol | 3 Favors | One ship gains +2 armor this battle |
| **Sundered Oath** | Desperate Gambit | 2 Favors | One ship gains +3 attack, -2 armor |

**Scaling Benefits (Favor Thresholds):**

| Favor Level | Alliance Status | Benefit |
|-------------|-----------------|---------|
| 0-4 | None | Cannot request alliance |
| 5-9 | Available | Can request 2 cards; 30% bounty share |
| 10-14 | Favorable | Can request 3 cards; 20% bounty share |
| 15+ | Devoted | 3 cards with enhanced stats; 10% share |

### Liaison Cards

Some battle cards have a **Liaison** keyword - when played, they generate extra Favors. This creates interesting deck-building decisions: Liaison cards might have slightly weaker stats but build diplomatic capital.

```typescript
interface LiaisonCard extends BattleCard {
  liaison: {
    faction: FactionId
    favorsGenerated: number
    condition?: string  // e.g., "if this card survives"
  }
}
```

**Example Liaison Cards:**

| Card | Stats | Liaison Effect |
|------|-------|----------------|
| Ironveil Envoy | 2/3/3 | +2 Ironveil Favors when deployed |
| Ashfall Courier | 3/2/4 | +1 Ashfall Favor per attack made |
| Meridian Broker | 2/4/3 | +1 Favor to ANY faction when deployed (you choose) |
| Void Delegate | 2/5/2 | +2 Void Warden Favors if survives battle |
| Oath Messenger | 4/2/3 | +1 Sundered Oath Favor; +2 if deals killing blow |

### Integration with Battle

The Favor system creates new strategic layers in battle:

**Pre-Battle:**
- Check Favor thresholds to see alliance options
- Activate Ally abilities by spending Favors
- Request alliance cards (costs Favors, provides cards)

**During Battle:**
- Playing faction cards earns Favors
- Liaison cards generate bonus Favors
- Protecting faction cards maintains Favor

**Post-Battle:**
- Faction cards that survived grant bonus Favors
- Faction cards destroyed lose Favors
- Favor decay: -1 per faction per quest (relationships need maintenance)

### Unified Card System

The beauty of this approach: **one deck serves both purposes**.

Your battle deck composition IS your diplomatic strategy:
- Heavy Ironveil deck = strong Ironveil alliance potential
- Mixed faction deck = moderate relationships with everyone
- Liaison-heavy deck = diplomatic focus (weaker combat, stronger alliances)

```
┌─────────────────────────────────────────────────────────────────┐
│                        DECK BUILDER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your Deck (10 cards)              Faction Balance              │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐   ┌──────────────────────────┐ │
│  │ IV ││ IV ││ AF ││ AF ││ MC │   │ Ironveil:  ████░░ 4      │ │
│  └────┘└────┘└────┘└────┘└────┘   │ Ashfall:   ███░░░ 3      │ │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐   │ Meridian:  █░░░░░ 1      │ │
│  │ MC ││ VW ││ VW ││ SO ││ SO │   │ Void W.:   ██░░░░ 2      │ │
│  └────┘└────┘└────┘└────┘└────┘   │ Sundered:  ██░░░░ 2      │ │
│                                    └──────────────────────────┘ │
│  Liaison Cards: 3                                               │
│  └─ Ironveil Envoy, Ashfall Courier, Meridian Broker            │
│                                                                 │
│  Diplomatic Forecast:                                           │
│  "Strong Ironveil potential. Moderate Ashfall. Others unlikely."|
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Comparison: Three Approaches

| Aspect | Menu-Driven | Card Negotiation | Favor System |
|--------|-------------|------------------|--------------|
| **Complexity** | Low | High | Medium |
| **New mechanics** | Influence + Standing | Argument deck (6+ cards) | Favors + Liaison keyword |
| **Player agency** | Choice from menu | Card play decisions | Deck building + battle play |
| **Negotiation feel** | Transactional | Strategic duel | Emergent from actions |
| **Integration** | Separate phase | Separate mini-game | Woven into battle |
| **Learning curve** | Easy | Steep | Moderate |
| **Replayability** | Low | High | High |

### Recommended: Favor System

The Favor system offers the best balance:
- **Simpler than card negotiation** - no second deck to manage
- **Deeper than menus** - your choices in battle affect diplomacy
- **Unified design** - battle cards serve double duty
- **Emergent strategy** - diplomatic style comes from deck composition

It also creates a satisfying loop:
1. Build deck with faction focus
2. Play those cards in battle, earning Favors
3. Spend Favors on Ally abilities and alliance requests
4. Earn better faction cards through successful alliances
5. Repeat with stronger diplomatic position

---

## Open Questions

1. **Which System?** - Three options presented: Menu-driven (simple), Card Negotiation (complex), or Favor System (recommended). Which fits the game best?

2. **Favor Decay Rate** - Should Favors decay between quests? If so, how fast? (-1 per quest feels right, but needs testing.)

3. **Liaison Card Balance** - How much weaker should Liaison cards be compared to pure combat cards? Enough to feel the trade-off, but not so much they're never picked.

4. **Ally Ability Timing** - Can Ally abilities be used mid-battle, or only pre-battle? Mid-battle is more tactical but adds complexity.

5. **Blocking Integration** - Should the blocking mechanics (from earlier in this doc) still apply, or does the Favor threshold naturally handle access control?

6. **Favor Visibility** - Should players see exact Favor numbers, or just thresholds (None/Available/Favorable/Devoted)?

7. **Cross-Faction Tension** - When you gain Favors with one faction, should rivals automatically lose Favors? Or only on specific actions?

8. **Tutorial Approach** - The Favor system is more intuitive than card negotiation, but still needs explanation. Guided first quest? Tooltips? Let players discover?

---

## Example Campaign Flow

**Quest 1: The Salvage Claim**
```
Starting Standing: All factions at Neutral (Rep 0, Trust 50, Favor 0, Fear 0)
Starting Influence: 10

Decision Point 1: Negotiate with Ironveil for salvage rights
→ Accept their terms: +10 Ironveil rep, +5 Trust
→ Request received: "Report any Ashfall activity" (accept for +5 favor)

Decision Point 2: Ashfall refugees found in wreckage
→ Report to Ironveil (as requested): +5 Ironveil favor, Ashfall -20 rep
→ Help refugees escape: Ashfall +15 rep, Ironveil request FAILED (-10 favor)
   ⚠ Block added: Ironveil Trade Agreement blocked for 1 quest

Decision Point 3: Form alliance for battle
→ Ironveil available: Yes (Friendly terms: 2 cards, 25% share)
→ Ashfall available: Only if helped refugees (Neutral terms)

Battle Outcome: Victory with Ironveil alliance
→ Ironveil Trust +5 (honored alliance)
→ If Ironveil cards destroyed: Trust -5 instead

End of Quest Standing:
- Ironveil: Rep +15, Trust 60, Favor 10
- Ashfall: Rep -20 (if reported) OR Rep +15 (if helped)
- Influence: 15 (started 10, +5 from quest completion)
```

**Quest 2: The Sanctuary Run** (Ashfall quest)
```
If Ashfall Hostile (reported refugees):
→ Cannot take this quest normally
→ Can override with 20 Influence (you have 15) - NOT ENOUGH
→ Must complete a side task to earn +5 Influence first
→ OR take an alternative quest

If Ashfall Friendly (helped refugees):
→ Quest available with bonus: Pre-formed Non-Aggression pact
→ Elder Yara offers Defensive Pact if you complete a request first
```

This creates a campaign where early choices genuinely shape your options later, and players feel the weight of diplomatic consequences.

---

*This document is a living proposal. It intentionally over-designs to allow for scope reduction. Core mechanics (Standing, Influence, Treaties, Blocks) should be prioritized over ancillary systems (Agendas, Dynamic Events).*
