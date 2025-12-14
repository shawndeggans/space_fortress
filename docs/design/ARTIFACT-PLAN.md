# Space Fortress: Design Artifact Plan

## Artifact Inventory

Based on the design document, we need to create artifacts in three categories:

---

## 1. Event Model Artifacts

### Core Loop Events
```
NARRATIVE_PHASE_STARTED
├── DILEMMA_PRESENTED
├── NPC_VOICE_SHOWN (x3 per dilemma)
└── CHOICE_MADE
    ├── REPUTATION_CHANGED
    ├── CARD_GAINED / CARD_LOST
    └── BATTLE_TRIGGERED (optional)

COMMITMENT_PHASE_STARTED
├── OPPONENT_FLEET_REVEALED (partial)
├── CARD_SELECTED (x5)
└── CARDS_COMMITTED

DEPLOYMENT_PHASE_STARTED
├── CARD_ORDERED (x5)
└── ORDERS_LOCKED

EXECUTION_PHASE_STARTED
├── ROUND_STARTED (x5)
│   ├── CARDS_REVEALED
│   ├── INITIATIVE_DETERMINED
│   ├── ATTACK_ROLLED
│   └── ROUND_RESOLVED
└── BATTLE_RESOLVED

CONSEQUENCE_PHASE_STARTED
├── BOUNTY_CALCULATED
├── BOUNTY_SHARED
├── REPUTATION_CHANGED
└── NEW_DILEMMA_TRIGGERED (optional)
```

### Quest Events
```
QUEST_OFFERED → QUEST_ACCEPTED / QUEST_DECLINED
QUEST_COMPLETED / QUEST_FAILED
```

### Alliance Events
```
ALLIANCE_OFFERED → ALLIANCE_FORMED / ALLIANCE_REJECTED
ALLIANCE_BROKEN
```

---

## 2. Screen Artifacts (by Phase)

| Screen | Purpose | Priority |
|--------|---------|----------|
| **Narrative Screen** | Dilemma + 3 NPC voices + choices | High |
| **Card Pool Screen** | Select 5 cards from available | High |
| **Deployment Screen** | Arrange card play order | High |
| **Battle Screen** | Round-by-round execution | High |
| **Consequence Screen** | Battle outcome + effects | High |
| **Quest Hub Screen** | Available quests + status | Medium |
| **Fleet Overview** | All owned cards | Medium |
| **Reputation Dashboard** | 5 faction standings | Medium |
| **Ending Screen** | Final evaluation + vignettes | Low |

---

## 3. Reusable Components

### Card Component
- Displays: Name, Attack, Armor, Agility
- States: Available, Selected, Committed, Destroyed
- Faction visual indicator

### NPC Voice Box
- Speaker name + faction
- Dialogue text
- Portrait placeholder

### Choice Button
- Choice label
- Consequence preview (reputation shifts, card gains)
- Disabled state (if requirements not met)

### Reputation Bar
- Faction icon
- Value (-100 to +100)
- Status label (Hostile → Devoted Ally)

### Battle Slot
- Card placeholder
- Position indicator (1-5)
- Result overlay (Won/Lost/Draw)

### Phase Indicator
- 5 phases
- Current phase highlight
- Progress dots

### Stat Pill
- Icon (sword/shield/wing)
- Value
- Used in card display

---

## Design Constraints

- **Lo-fi**: Wireframe aesthetic, no color themes
- **Clear**: Readable on mobile, obvious affordances
- **Compact**: Minimize scrolling, dense information display
- **Consistent**: Same components everywhere they appear

---

## Suggested Work Order

1. **Components first** - Define the building blocks
2. **Narrative screen** - Most complex, drives the game
3. **Card pool + Deployment** - Card selection flow
4. **Battle screen** - Execution display
5. **Event model** - Map data flow between screens

