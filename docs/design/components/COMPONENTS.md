# Space Fortress: UI Components

Lo-fi, unthemed component definitions. All measurements in relative units.

---

## 1. Card

The central game element. Displays a ship with its three stats.

### States
- `default` - in card pool, unselected
- `selected` - chosen for battle (highlighted border)
- `committed` - locked in deployment
- `revealed` - shown during battle execution
- `destroyed` - defeated in combat (dimmed/crossed)
- `locked` - unavailable due to reputation (grayed)

### Variants

**Full Card** (card pool, detail views)
```
┌─────────────────────────┐
│ ▣ IRONVEIL              │  ← faction badge + name
├─────────────────────────┤
│                         │
│    [ship silhouette]    │  ← visual placeholder
│                         │
├─────────────────────────┤
│  Mining Barge Retrofit  │  ← card name
├─────────────────────────┤
│  ⚔ 5    🛡 4    ⚡ 1    │  ← stats row
└─────────────────────────┘
```

**Compact Card** (deployment, battle)
```
┌───────────────┐
│ ▣ Mining Brg  │
├───────────────┤
│ ⚔5  🛡4  ⚡1  │
└───────────────┘
```

**Mini Card** (lists, references)
```
┌──────────────────────┐
│ ▣ Mining Barge  5/4/1│
└──────────────────────┘
```

### Props
```
{
  card: {
    id, name, faction
    attack, armor, agility
  }
  state: 'default' | 'selected' | 'committed' | 'revealed' | 'destroyed' | 'locked'
  size: 'full' | 'compact' | 'mini'
  onTap?: () => void
  lockReason?: string
}
```

---

## 2. Stat Pill

Individual stat display with icon and value.

```
┌─────────┐
│  ⚔ 5   │   Attack (sword)
└─────────┘

┌─────────┐
│  🛡 4   │   Armor (shield)
└─────────┘

┌─────────┐
│  ⚡ 1   │   Agility (lightning)
└─────────┘
```

### Props
```
{
  type: 'attack' | 'armor' | 'agility'
  value: number
  size: 'small' | 'medium' | 'large'
}
```

---

## 3. Faction Badge

Identifies faction affiliation.

```
┌───┐
│ ▣ │  Ironveil (gear/cog shape)
└───┘

┌───┐
│ ◈ │  Ashfall (diamond/ember)
└───┘

┌───┐
│ ⬡ │  Meridian (hexagon/balance)
└───┘

┌───┐
│ ⛊ │  Void Wardens (shield/fortress)
└───┘

┌───┐
│ ✕ │  Sundered Oath (broken symbol)
└───┘
```

### With Label
```
┌────────────────┐
│ ▣  Ironveil    │
└────────────────┘
```

### Props
```
{
  faction: 'ironveil' | 'ashfall' | 'meridian' | 'voidwardens' | 'sunderedoath'
  showLabel: boolean
  size: 'small' | 'medium'
}
```

---

## 4. NPC Voice Box

Presents an NPC's dialogue and position in a dilemma.

```
┌─────────────────────────────────────┐
│ ┌───┐                               │
│ │ ○ │  Castellan Vorn               │  ← portrait + name
│ └───┘  ▣ Ironveil Syndicate         │  ← faction badge
├─────────────────────────────────────┤
│                                     │
│ "The salvage claim is legally       │
│ filed. What's on that ship          │
│ belongs to us. Secure it, and       │
│ you'll be compensated fairly."      │  ← dialogue
│                                     │
└─────────────────────────────────────┘
```

### Compact (in choice preview)
```
┌─────────────────────────────────┐
│ ○ Castellan Vorn: "Secure it."  │
└─────────────────────────────────┘
```

### Props
```
{
  npc: {
    name: string
    faction: string
    portrait?: string  // placeholder for now
  }
  dialogue: string
  variant: 'full' | 'compact'
}
```

---

## 5. Choice Button

Presents a dilemma choice with consequence preview.

### Full (narrative screen)
```
┌─────────────────────────────────────┐
│  A) Accept Ironveil's Quest         │  ← choice label
├─────────────────────────────────────┤
│  + Gain 2 Ironveil cards (Siege)    │  ← positive effects
│  + 10 rep with Ironveil             │
│  ─ 15 rep with Ashfall              │  ← negative effects
├─────────────────────────────────────┤
│  → Proceed to Alliance Phase        │  ← next step indicator
└─────────────────────────────────────┘
```

### Compact (mediation, post-battle)
```
┌───────────────────────────────┐
│  Lean toward Ironveil         │
│  ▣+5  ◈-5  ⬡+10   60% bounty  │
└───────────────────────────────┘
```

### Disabled State
```
┌─────────────────────────────────────┐
│  ░░ Side with Void Wardens ░░░░░░░ │
│  ⛊ Requires Friendly reputation    │
└─────────────────────────────────────┘
```

### Props
```
{
  choice: {
    id: string
    label: string
    consequences: {
      reputation: [{ faction, delta }]
      cards: [{ action, card }]
      bounty?: { modifier, reason }
      risk?: { description, probability }
    }
    nextStep?: string
  }
  disabled?: boolean
  disabledReason?: string
  variant: 'full' | 'compact'
  onSelect: () => void
}
```

---

## 6. Reputation Bar

Displays standing with a faction.

### Full Bar
```
┌─────────────────────────────────────┐
│ ▣ Ironveil Syndicate                │
│ ├──────────────────────────────────┤│
│ │▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░││  ← -100 to +100
│ ├──────────────────────────────────┤│
│           +35 Friendly              │  ← value + status
└─────────────────────────────────────┘
```

### Compact Bar (header, lists)
```
┌─────────────────────────┐
│ ▣  ▓▓▓▓▓░░░░░  +35      │
└─────────────────────────┘
```

### Mini (inline reference)
```
▣ +35
```

### Status Colors (noted, not shown in lo-fi)
- Hostile (-75-): danger zone
- Unfriendly (-74 to -25): warning
- Neutral (-24 to +24): default
- Friendly (+25 to +74): positive
- Devoted (+75+): highlight

### Props
```
{
  faction: string
  value: number  // -100 to +100
  status: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'devoted'
  variant: 'full' | 'compact' | 'mini'
  showTrend?: boolean
  trend?: 'rising' | 'falling' | 'stable'
}
```

---

## 7. Battle Slot

A position for a card in deployment or battle.

### Empty Slot
```
┌ ─ ─ ─ ─ ─ ─ ─ ┐

│    slot 1     │   ← position indicator

└ ─ ─ ─ ─ ─ ─ ─ ┘
```

### Filled Slot
```
┌───────────────┐
│ ▣ Mining Brg  │
├───────────────┤
│ ⚔5  🛡4  ⚡1  │
├───────────────┤
│   position 1  │
└───────────────┘
```

### Battle Slot (with result)
```
┌───────────────┐
│ ▣ Mining Brg  │
├───────────────┤
│ ⚔5  🛡4  ⚡1  │
├───────────────┤
│   ✓ WON       │  ← or ✗ LOST, ─ DRAW
└───────────────┘
```

### Props
```
{
  position: 1 | 2 | 3 | 4 | 5
  card?: Card
  result?: 'won' | 'lost' | 'draw' | null
  isDropTarget?: boolean
  onDrop?: (cardId) => void
}
```

---

## 8. Phase Indicator

Shows current position in game loop.

### Full (horizontal)
```
┌─────────────────────────────────────────────────────────┐
│  ○ Narrative  →  ○ Commit  →  ● Deploy  →  ○ Execute  →  ○ Consequence  │
└─────────────────────────────────────────────────────────┘
```

### Compact (dots)
```
○ ○ ● ○ ○
```

### With Labels
```
┌─────────┐
│ DEPLOY  │
│ ○○●○○   │
│  3 / 5  │
└─────────┘
```

### Props
```
{
  currentPhase: 'narrative' | 'commitment' | 'deployment' | 'execution' | 'consequence'
  variant: 'full' | 'compact' | 'labeled'
}
```

---

## 9. Quest Card

Displays a quest in the quest hub.

### Available Quest
```
┌─────────────────────────────────────┐
│ ▣ IRONVEIL SYNDICATE                │
├─────────────────────────────────────┤
│ The Salvage Claim                   │  ← quest title
├─────────────────────────────────────┤
│ Secure a derelict colony ship       │
│ in contested space.                 │  ← brief description
├─────────────────────────────────────┤
│ Bounty: ●●●○○   Rep req: Neutral    │
└─────────────────────────────────────┘
```

### Active Quest (tracker)
```
┌─────────────────────────────────────┐
│ ▣ The Salvage Claim          [2/4] │  ← progress
├─────────────────────────────────────┤
│ Current: Form an alliance           │
│ Allies: ⛊ Void Wardens (30%)        │
└─────────────────────────────────────┘
```

### Locked Quest
```
┌─────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ░ The Warden's Debt ░░░░░░░░░░░░░░░│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ⛊ Requires Friendly reputation     │
└─────────────────────────────────────┘
```

### Props
```
{
  quest: {
    id, title, faction, brief
    bountyLevel: 1-5
    reputationRequired?: { faction, minimum }
  }
  state: 'available' | 'active' | 'locked' | 'completed' | 'failed'
  progress?: { current, total }
  onTap: () => void
}
```

---

## 10. Alliance Option

Displays a potential ally for selection.

```
┌─────────────────────────────────────┐
│ ⛊ VOID WARDENS                      │
├─────────────────────────────────────┤
│ Cards: 2x Tank profile              │
│ Share: 30% bounty                   │
│ Your rep: +42 (Friendly)            │
├─────────────────────────────────────┤
│         [ View Terms ]              │
└─────────────────────────────────────┘
```

### Unavailable
```
┌─────────────────────────────────────┐
│ ░ ASHFALL REMNANTS ░░░░░░░░░░░░░░░░│
├─────────────────────────────────────┤
│ Your rep: -52 (Unfriendly)          │
│ "We don't work with your kind."     │
└─────────────────────────────────────┘
```

### Props
```
{
  faction: string
  available: boolean
  unavailableReason?: string
  terms?: {
    cardProfile: string
    cardCount: number
    bountyShare: percent
  }
  reputation: { value, status }
  onViewTerms: () => void
}
```

---

## 11. Dice Roll Display

Shows attack roll resolution during battle.

```
┌─────────────────────────────────────┐
│         ATTACK ROLL                 │
├─────────────────────────────────────┤
│                                     │
│     [ 14 ]  +  ⚔ 5  =  19          │
│      d20       ATK     total        │
│                                     │
│         vs  Target: 14              │
│            (10 + 🛡4)                │
│                                     │
│           ✓ HIT!                    │
└─────────────────────────────────────┘
```

### Compact (inline)
```
[14] + ⚔5 = 19 vs 14 → HIT
```

### Props
```
{
  roll: number
  attackBonus: number
  total: number
  targetArmor: number
  targetValue: number  // 10 + armor
  result: 'hit' | 'miss'
  animate?: boolean
}
```

---

## 12. Round Result

Shows outcome of a single battle round.

```
┌─────────────────────────────────────────────────────┐
│                  ROUND 3                            │
├────────────────────┬────────────────────────────────┤
│   YOUR CARD        │        ENEMY CARD              │
│ ┌───────────────┐  │  ┌───────────────┐             │
│ │ ▣ Mining Brg  │  │  │ ✕ Oath Brkr   │             │
│ ├───────────────┤  │  ├───────────────┤             │
│ │ ⚔5  🛡4  ⚡1  │  │  │ ⚔4  🛡2  ⚡4  │             │
│ └───────────────┘  │  └───────────────┘             │
├────────────────────┴────────────────────────────────┤
│  Enemy strikes first (Agility 4 > 1)                │
│  Enemy rolls: [11] + 4 = 15 vs 14 → HIT             │
├─────────────────────────────────────────────────────┤
│              ✗ ROUND LOST                           │
└─────────────────────────────────────────────────────┘
```

### Props
```
{
  roundNumber: 1-5
  playerCard: Card
  enemyCard: Card
  initiative: 'player' | 'enemy' | 'simultaneous'
  rolls: {
    player?: { roll, bonus, total, target, hit }
    enemy?: { roll, bonus, total, target, hit }
  }
  outcome: 'won' | 'lost' | 'draw'
}
```

---

## 13. Bounty Display

Shows bounty calculation and shares.

```
┌─────────────────────────────────────┐
│          BOUNTY EARNED              │
├─────────────────────────────────────┤
│  Base reward:           1000 cr     │
├─────────────────────────────────────┤
│  Shares:                            │
│    ⛊ Void Wardens (30%)  -300 cr   │
├─────────────────────────────────────┤
│  Your take:              700 cr     │
│                         ═══════     │
└─────────────────────────────────────┘
```

### Props
```
{
  base: number
  shares: [{ faction, percent, amount }]
  net: number
  bonuses?: [{ reason, amount }]
  penalties?: [{ reason, amount }]
}
```

---

## 14. Consequence Item

Single consequence in a list.

```
+ Gained: Mining Barge Retrofit (▣ Ironveil)

─ Lost: Refugee Interceptor (◈ Ashfall)

↑ Reputation: ▣ Ironveil +15 → Friendly

↓ Reputation: ◈ Ashfall -20 → Unfriendly

! Risk: 30% chance Ironveil discovers deception
```

### Props
```
{
  type: 'card_gained' | 'card_lost' | 'rep_up' | 'rep_down' | 'bounty' | 'risk' | 'flag'
  content: string
  details?: string
}
```

---

## 15. Modal / Dialog

Container for detail views and confirmations.

```
┌─────────────────────────────────────────┐
│  Card Details                     [ × ] │
├─────────────────────────────────────────┤
│                                         │
│    (content slot)                       │
│                                         │
├─────────────────────────────────────────┤
│              [ Close ]                  │
└─────────────────────────────────────────┘
```

### Confirmation Modal
```
┌─────────────────────────────────────────┐
│  Confirm Alliance                       │
├─────────────────────────────────────────┤
│                                         │
│  Form alliance with Void Wardens?       │
│  This will grant 30% of bounty.         │
│                                         │
├─────────────────────────────────────────┤
│     [ Cancel ]         [ Confirm ]      │
└─────────────────────────────────────────┘
```

### Props
```
{
  title: string
  content: ReactNode
  actions: [{ label, onClick, variant: 'primary' | 'secondary' | 'danger' }]
  onClose: () => void
}
```

---

## Component Hierarchy

```
App
├── Header
│   ├── PhaseIndicator
│   ├── ActiveQuestTracker (QuestCard compact)
│   └── PlayerState
│       ├── BountyDisplay (mini)
│       └── ReputationBar (mini) × 5
│
├── Screen (varies by phase)
│   ├── NarrativeScreen
│   │   ├── NpcVoiceBox × 3
│   │   └── ChoiceButton × 2-3
│   │
│   ├── CardPoolScreen
│   │   ├── Card (full) × n
│   │   └── SelectionSummary
│   │
│   ├── DeploymentScreen
│   │   └── BattleSlot × 5
│   │
│   ├── BattleScreen
│   │   ├── RoundResult
│   │   │   ├── Card (compact) × 2
│   │   │   └── DiceRollDisplay
│   │   └── BattleProgress
│   │
│   └── ConsequenceScreen
│       ├── BattleResultSummary
│       ├── BountyDisplay
│       └── ConsequenceItem × n
│
└── Modal
    ├── CardDetailView (Card full + history)
    ├── AllianceTermsView
    ├── FactionDetailView
    └── ConfirmationDialog
```

---

## Interaction Patterns

### Tap
- Card → show CardDetailView modal
- Quest → show QuestDetailView modal
- Choice → select (with confirmation if consequences severe)
- Alliance option → show AllianceTermsView modal

### Drag (deployment only)
- Card → BattleSlot (reorderable)

### Long Press
- Card → quick stats tooltip
- Reputation bar → faction summary tooltip

### Swipe
- None in v1 (keep interactions simple)
