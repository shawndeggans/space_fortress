# Space Fortress: Core Loop Event Model

## Notation
```
(UI Screen)     = White - Wireframe/Trigger
[Command]       = Blue  - User intent
{Event}         = Orange - Stored fact (past tense)
<Read Model>    = Green - Projected view for UI
───────────────────────────────────────────────
    ──>         = Flow direction (time moves right)
    ...>        = Async/eventual
    |           = Projection from events to read model
```

---

## Timeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  NARRATIVE ──> COMMITMENT ──> DEPLOYMENT ──> EXECUTION ──> CONSEQUENCE ──> NARRATIVE   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## SLICE 1: Narrative Phase (Dilemma Flow)

### Command Pattern: Present Dilemma

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ UI LANE                                                                                 │
│                                                                                         │
│  (Quest Hub)                              (Narrative Screen)                            │
│      │                                          │                                       │
│      │ click quest                              │ click choice                          │
│      ▼                                          ▼                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ COMMAND/EVENT LANE                                                                      │
│                                                                                         │
│  [AcceptQuest]                            [MakeChoice]                                  │
│      │                                          │                                       │
│      ▼                                          ▼                                       │
│  {QuestAccepted}                          {ChoiceMade}                                  │
│      │                                          │                                       │
│      ▼                                          ├──> {ReputationChanged}                │
│  {DilemmaPresented}                             ├──> {CardGained}                       │
│                                                 ├──> {FlagSet}                          │
│                                                 └──> {BattleTriggered}?                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READ MODEL LANE                                                                         │
│                                                                                         │
│  <QuestList>              <DilemmaView>              <PlayerState>                      │
│      │                         │                          │                             │
│      │                         │                          │                             │
│  ────┴─────────────────────────┴──────────────────────────┴────────────────────────     │
│        projects from:    projects from:           projects from:                        │
│        {QuestAccepted}   {DilemmaPresented}       {ReputationChanged}                   │
│        {QuestCompleted}  {ChoiceMade}             {CardGained}                          │
│        {QuestFailed}                              {FlagSet}                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Read Model: DilemmaView
```
{
  dilemmaId: string
  situation: string
  voices: [
    { npcName, faction, dialogue, position }  // 3 voices
  ]
  choices: [
    {
      id,
      label,
      consequences: {
        reputation: [{faction, delta}],
        cards: [{action: gain|lose, card}],
        nextDilemma: id | null,
        triggersBattle: boolean
      }
    }
  ]
}
```

---

## SLICE 2: Commitment Phase (Card Selection)

### Command Pattern: Select Cards for Battle

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ UI LANE                                                                                 │
│                                                                                         │
│  (Card Pool Screen)                       (Card Pool Screen)                            │
│      │                                          │                                       │
│      │ tap card                                 │ tap "Commit Fleet"                    │
│      ▼                                          ▼                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ COMMAND/EVENT LANE                                                                      │
│                                                                                         │
│  [SelectCard]                             [CommitFleet]                                 │
│      │                                          │                                       │
│      ▼                                          ▼                                       │
│  {CardSelected}                           {FleetCommitted}                              │
│       ▲                                                                                 │
│       │                                                                                 │
│  [DeselectCard] ──> {CardDeselected}                                                    │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READ MODEL LANE                                                                         │
│                                                                                         │
│  <CardPoolView>                           <BattleSetup>                                 │
│                                                                                         │
│  projects from:                           projects from:                                │
│  {CardGained}, {CardLost}                 {BattleTriggered}                             │
│  {CardSelected}, {CardDeselected}         {FleetCommitted}                              │
│                                           {OpponentFleetGenerated}                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Read Model: CardPoolView
```
{
  availableCards: [
    { id, name, faction, attack, armor, agility, isSelected }
  ]
  selectedCount: number      // max 5
  canCommit: boolean         // true when selectedCount === 5
  opponentPreview: {         // partial information
    factionHint: string
    cardCount: 5
    knownCards: []           // revealed through narrative choices
  }
}
```

---

## SLICE 3: Deployment Phase (Card Ordering)

### Command Pattern: Arrange Play Order

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ UI LANE                                                                                 │
│                                                                                         │
│  (Deployment Screen)                      (Deployment Screen)                           │
│      │                                          │                                       │
│      │ drag card to slot                        │ tap "Lock Orders"                     │
│      ▼                                          ▼                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ COMMAND/EVENT LANE                                                                      │
│                                                                                         │
│  [SetCardPosition]                        [LockOrders]                                  │
│      │                                          │                                       │
│      ▼                                          ▼                                       │
│  {CardPositioned}                         {OrdersLocked}                                │
│                                                 │                                       │
│                                                 ▼                                       │
│                                           {BattleStarted}                               │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READ MODEL LANE                                                                         │
│                                                                                         │
│  <DeploymentView>                         <BattleState>                                 │
│                                                                                         │
│  projects from:                           projects from:                                │
│  {FleetCommitted}                         {OrdersLocked}                                │
│  {CardPositioned}                         {BattleStarted}                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Read Model: DeploymentView
```
{
  slots: [
    { position: 1-5, card: Card | null }
  ]
  unpositionedCards: Card[]
  canLock: boolean           // true when all 5 slots filled
}
```

---

## SLICE 4: Execution Phase (Battle Resolution)

### Automation Pattern: Round Resolution

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ UI LANE                                                                                 │
│                                                                                         │
│  (Battle Screen)          (Battle Screen)           (Battle Screen)                     │
│      │                         │                         │                              │
│      │ [view only]             │ [view only]             │ tap "Continue"               │
│      ▼                         ▼                         ▼                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ AUTOMATION LANE (system-driven, no user commands during execution)                      │
│                                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐                     │
│  │ ResolveRound │ ──────> │ ResolveRound │ ──────> │ ResolveRound │ ───> (x5 rounds)   │
│  └──────────────┘         └──────────────┘         └──────────────┘                     │
│         │                        │                        │                             │
│         ▼                        ▼                        ▼                             │
│  {RoundStarted}            {RoundStarted}           {RoundStarted}                      │
│  {CardsRevealed}           {CardsRevealed}          {CardsRevealed}                     │
│  {InitiativeResolved}      {InitiativeResolved}     {InitiativeResolved}                │
│  {AttackRolled}            {AttackRolled}           {AttackRolled}                      │
│  {RoundResolved}           {RoundResolved}          {RoundResolved}                     │
│         │                                                  │                            │
│         │                                                  ▼                            │
│         │                                           {BattleResolved}                    │
│         │                                                                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READ MODEL LANE                                                                         │
│                                                                                         │
│  <RoundView>                              <BattleResultView>                            │
│                                                                                         │
│  projects from:                           projects from:                                │
│  {RoundStarted}                           {BattleResolved}                              │
│  {CardsRevealed}                          all {RoundResolved}                           │
│  {AttackRolled}                                                                         │
│  {RoundResolved}                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Event: RoundResolved
```
{
  roundNumber: 1-5
  playerCard: { id, name, stats }
  opponentCard: { id, name, stats }
  initiative: 'player' | 'opponent' | 'simultaneous'
  playerRoll: { base: d20, modifier: attack, total }
  opponentRoll: { base: d20, modifier: attack, total }
  playerHit: boolean
  opponentHit: boolean
  outcome: 'player_won' | 'opponent_won' | 'draw'
}
```

### Read Model: BattleResultView
```
{
  rounds: [RoundResult x 5]
  playerWins: number
  opponentWins: number
  draws: number
  outcome: 'victory' | 'defeat' | 'draw'
}
```

---

## SLICE 5: Consequence Phase

### Command Pattern: Process Outcome

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ UI LANE                                                                                 │
│                                                                                         │
│  (Consequence Screen)                     (Consequence Screen)                          │
│      │                                          │                                       │
│      │ [view results]                           │ tap "Continue"                        │
│      ▼                                          ▼                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ COMMAND/EVENT LANE                                                                      │
│                                                                                         │
│  ◄── {BattleResolved}                     [AcknowledgeOutcome]                          │
│         │                                       │                                       │
│         │ (automation)                          ▼                                       │
│         ▼                                 {OutcomeAcknowledged}                          │
│  {BountyCalculated}                             │                                       │
│  {BountyShared}                                 ▼                                       │
│  {ReputationChanged}                      {DilemmaPresented}? ──> back to Slice 1       │
│  {QuestCompleted}?                              or                                      │
│  {QuestFailed}?                           {QuestCompleted} ──> Quest Hub                │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READ MODEL LANE                                                                         │
│                                                                                         │
│  <ConsequenceView>                        <PlayerState> (updated)                       │
│                                                                                         │
│  projects from:                           projects from:                                │
│  {BattleResolved}                         {BountyCalculated}                            │
│  {BountyCalculated}                       {ReputationChanged}                           │
│  {ReputationChanged}                      {CardGained}, {CardLost}                      │
│  {QuestCompleted/Failed}                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Read Model: ConsequenceView
```
{
  battleOutcome: 'victory' | 'defeat' | 'draw'
  bounty: {
    base: number
    shares: [{ faction, amount, reason }]
    net: number
  }
  reputationChanges: [{ faction, delta, newValue, newStatus }]
  cardsChanged: [{ action: 'gained' | 'lost', card }]
  nextStep: 'dilemma' | 'quest_complete' | 'quest_failed'
  narrativeText: string      // contextual description of what happened
}
```

---

## Event Catalog (All Events)

| Event | Payload | Triggers |
|-------|---------|----------|
| `{QuestAccepted}` | questId, factionId | DilemmaPresented |
| `{QuestDeclined}` | questId, reason | - |
| `{QuestCompleted}` | questId, outcome | ConsequenceView update |
| `{QuestFailed}` | questId, reason | ConsequenceView update |
| `{DilemmaPresented}` | dilemmaId, questId, voices[], choices[] | DilemmaView |
| `{ChoiceMade}` | dilemmaId, choiceId, playerId | Multiple downstream |
| `{ReputationChanged}` | factionId, delta, newValue | PlayerState |
| `{CardGained}` | cardId, source | CardPoolView, PlayerState |
| `{CardLost}` | cardId, reason | CardPoolView, PlayerState |
| `{FlagSet}` | flagName, value | PlayerState |
| `{BattleTriggered}` | battleId, context, opponentType | BattleSetup |
| `{CardSelected}` | cardId, battleId | CardPoolView |
| `{CardDeselected}` | cardId, battleId | CardPoolView |
| `{FleetCommitted}` | battleId, cardIds[] | DeploymentView |
| `{CardPositioned}` | cardId, position | DeploymentView |
| `{OrdersLocked}` | battleId, positions[] | BattleState |
| `{BattleStarted}` | battleId, playerFleet, opponentFleet | RoundView |
| `{RoundStarted}` | battleId, roundNumber | RoundView |
| `{CardsRevealed}` | roundNumber, playerCard, opponentCard | RoundView |
| `{InitiativeResolved}` | roundNumber, firstStriker | RoundView |
| `{AttackRolled}` | roundNumber, attacker, roll, target, hit | RoundView |
| `{RoundResolved}` | roundNumber, outcome | RoundView, BattleResultView |
| `{BattleResolved}` | battleId, outcome, roundsSummary | BattleResultView |
| `{BountyCalculated}` | battleId, base, shares[], net | ConsequenceView |
| `{BountyShared}` | factionId, amount | PlayerState |
| `{OutcomeAcknowledged}` | battleId | Next phase trigger |

---

## Read Model Summary

| Read Model | Source Events | Serves Screen |
|------------|---------------|---------------|
| `<QuestList>` | QuestAccepted, QuestCompleted, QuestFailed | Quest Hub |
| `<DilemmaView>` | DilemmaPresented | Narrative Screen |
| `<PlayerState>` | ReputationChanged, CardGained, CardLost, FlagSet, BountyCalculated | All screens (header) |
| `<CardPoolView>` | CardGained, CardLost, CardSelected, CardDeselected, BattleTriggered | Card Pool Screen |
| `<DeploymentView>` | FleetCommitted, CardPositioned | Deployment Screen |
| `<BattleState>` | OrdersLocked, BattleStarted | Battle Screen |
| `<RoundView>` | RoundStarted, CardsRevealed, AttackRolled, RoundResolved | Battle Screen |
| `<BattleResultView>` | BattleResolved, all RoundResolved | Battle Screen |
| `<ConsequenceView>` | BattleResolved, BountyCalculated, ReputationChanged | Consequence Screen |

