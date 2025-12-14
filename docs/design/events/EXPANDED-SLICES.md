# Space Fortress: Expanded Event Model Slices

## Notation
- **Trigger**: UI action or system condition that initiates flow
- **Command**: User intent (blue)
- **Event(s)**: Stored facts, past tense (orange)
- **Read Model**: Projected view for UI (green)

---

## Slice: Quest Lifecycle

The container flow for all gameplay. A quest spans multiple dilemmas and potentially multiple battles.

### State Machine
```
AVAILABLE → OFFERED → ACCEPTED → IN_PROGRESS → COMPLETED | FAILED
                 ↓
              DECLINED
```

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Game start / quest complete | *(system)* | `{QuestsGenerated}` | `<QuestList>` |
| View quest hub | *(navigation)* | — | `<QuestList>` |
| Tap quest card | `[ViewQuestDetails]` | `{QuestViewed}` | `<QuestDetailView>` |
| Tap "Accept Quest" | `[AcceptQuest]` | `{QuestAccepted}` | `<QuestList>`, `<ActiveQuest>` |
| Tap "Decline Quest" | `[DeclineQuest]` | `{QuestDeclined}` | `<QuestList>` |
| Complete final dilemma (victory) | *(system)* | `{QuestCompleted}` | `<QuestList>`, `<PlayerState>` |
| Fail condition met | *(system)* | `{QuestFailed}` | `<QuestList>`, `<PlayerState>` |

### Events

| Event | Payload |
|-------|---------|
| `{QuestsGenerated}` | `quests[]: { id, factionId, title, briefDescription, reputationRequired }` |
| `{QuestViewed}` | `questId` |
| `{QuestAccepted}` | `questId, factionId, initialBounty, initialCards[]` |
| `{QuestDeclined}` | `questId, reason?` |
| `{QuestCompleted}` | `questId, outcome: 'full' | 'partial' | 'compromised', finalBounty` |
| `{QuestFailed}` | `questId, failurePoint, reason` |

### Read Models

**QuestList**
```
{
  available: [{ id, faction, title, brief, reputationRequired, isLocked }]
  active: { id, title, currentDilemma, progress } | null
  completed: [{ id, title, outcome }]
}
```

**QuestDetailView**
```
{
  id, faction, title
  fullDescription
  questGiverDialogue
  initialReward: { bounty, cards[] }
  reputationRequirement: { faction, minimum }
  warningText?  // e.g., "This will anger the Ashfall Remnants"
}
```

**ActiveQuest**
```
{
  id, title, faction
  currentDilemmaId
  dilemmasCompleted: number
  alliesFormed: [{ faction, bountyShare }]
  battlesPending: number
  battlesWon: number
}
```

---

## Slice: Alliance Negotiation

Occurs after accepting a quest when battle is imminent. Player must secure allies for fleet capability.

### Flow
```
BATTLE_IMMINENT → ALLIANCE_OPTIONS_PRESENTED → ALLY_SELECTED → TERMS_SHOWN → ACCEPTED | REJECTED
                                                                                    ↓
                                                                            (select different ally)
```

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Dilemma indicates battle needed | *(system)* | `{AlliancePhaseStarted}` | `<AllianceOptions>` |
| View alliance options | *(navigation)* | — | `<AllianceOptions>` |
| Tap faction option | `[ViewAllianceTerms]` | `{AllianceTermsViewed}` | `<AllianceTermsView>` |
| Tap "Form Alliance" | `[FormAlliance]` | `{AllianceFormed}` | `<ActiveQuest>`, `<CardPoolView>` |
| Tap "Reject Terms" | `[RejectAllianceTerms]` | `{AllianceRejected}` | `<AllianceOptions>` |
| Tap "Proceed Alone" | `[DeclineAllAlliances]` | `{AlliancesDeclined}` | `<ActiveQuest>` |
| Secret alliance (narrative choice) | `[FormSecretAlliance]` | `{SecretAllianceFormed}` | `<ActiveQuest>`, `<PlayerState>` |

### Events

| Event | Payload |
|-------|---------|
| `{AlliancePhaseStarted}` | `questId, battleContext, availableFactions[]` |
| `{AllianceTermsViewed}` | `factionId` |
| `{AllianceFormed}` | `factionId, bountyShare, cardsProvided[], termsAccepted` |
| `{AllianceRejected}` | `factionId, reason?` |
| `{AlliancesDeclined}` | `questId` |
| `{SecretAllianceFormed}` | `factionId, publicFaction?, discoveryRisk, cardsProvided[]` |
| `{AllianceDiscovered}` | `secretFactionId, discoveredBy, reputationPenalty` |

### Read Models

**AllianceOptions**
```
{
  context: string  // "You need interceptor capability to reach the derelict"
  options: [{
    factionId
    factionName
    available: boolean
    unavailableReason?: string  // "Reputation too low" or "Ideologically opposed"
    cardProfile: string  // "Siege-heavy", "Interceptor-heavy"
    estimatedBountyShare: number
    reputationWithFaction: number
  }]
  canProceedAlone: boolean
  proceedAloneWarning?: string
}
```

**AllianceTermsView**
```
{
  factionId, factionName
  npcName, npcDialogue
  terms: {
    bountyShare: percent
    cardsProvided: Card[]
    additionalCosts?: string[]  // "Mining rights on the moon"
    battleRole: 'attacker' | 'defender'
  }
  reputationEffect: { faction, delta }
  conflictWarnings: [{ faction, delta, reason }]  // "Ironveil will lose trust"
}
```

---

## Slice: Diplomatic Resolution

Alternative to combat. Mediation path that resolves quest without battle.

### Flow
```
DILEMMA_CHOICE → MEDIATION_SELECTED → SUMMIT_STARTED → POSITIONS_HEARD → LEAN_CHOICE → OUTCOME
```

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Choose mediation in dilemma | `[MakeChoice]` | `{ChoiceMade}`, `{MediationStarted}` | `<MediationView>` |
| View faction position | `[ViewPosition]` | `{PositionViewed}` | `<MediationView>` |
| Tap "Lean toward [Faction]" | `[LeanTowardFaction]` | `{MediationLeaned}` | `<MediationOutcomeView>` |
| Tap "Refuse to Lean" | `[RefuseToLean]` | `{MediationCollapsed}` | `<DilemmaView>` (battle triggered) |
| Tap "Accept Compromise" | `[AcceptCompromise]` | `{CompromiseAccepted}`, `{QuestCompleted}` | `<ConsequenceView>` |

### Events

| Event | Payload |
|-------|---------|
| `{MediationStarted}` | `questId, facilitatorId, parties: [factionId, factionId]` |
| `{PositionViewed}` | `factionId` |
| `{MediationLeaned}` | `towardFaction, awayFromFaction` |
| `{MediationCollapsed}` | `reason, battleTriggered: true` |
| `{CompromiseAccepted}` | `terms, bountyModifier, reputationEffects[]` |

### Read Models

**MediationView**
```
{
  facilitator: { name, faction, dialogue }
  parties: [{
    factionId, factionName
    representative: { name, dialogue }
    position: string
    demands: string[]
  }]
  leanOptions: [{
    towardFaction
    outcomePreview: string
    reputationEffects: [{ faction, delta }]
    bountyModifier: percent
  }]
  refuseOption: {
    warningText: string
    consequence: 'battle_triggered'
  }
}
```

**MediationOutcomeView**
```
{
  outcome: 'compromise'
  summary: string
  terms: string[]
  bounty: { base, modifier, final }
  reputationChanges: [{ faction, delta, newValue }]
  narrativeText: string
}
```

---

## Slice: Reputation Effects

How reputation gates options and modifies costs throughout the game.

### Thresholds (from design doc)
| Range | Status | Effect |
|-------|--------|--------|
| 75+ | Devoted Ally | Best cards, minimal bounty share |
| 25-74 | Friendly | Good cards, fair share |
| -24 to 24 | Neutral | Basic cards, standard share |
| -74 to -25 | Unfriendly | Limited cards, high share |
| -75 or below | Hostile | Refuses alliance, may become enemy |

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Any reputation-changing action | *(various)* | `{ReputationChanged}` | `<PlayerState>`, `<ReputationDashboard>` |
| Reputation crosses threshold | *(system)* | `{ReputationThresholdCrossed}` | `<PlayerState>` |
| View faction details | `[ViewFactionDetails]` | — | `<FactionDetailView>` |
| Reputation unlocks cards | *(system)* | `{CardsUnlocked}` | `<CardPoolView>` |
| Reputation locks cards | *(system)* | `{CardsLocked}` | `<CardPoolView>` |

### Events

| Event | Payload |
|-------|---------|
| `{ReputationChanged}` | `factionId, delta, newValue, source` |
| `{ReputationThresholdCrossed}` | `factionId, oldStatus, newStatus, direction: 'up' | 'down'` |
| `{CardsUnlocked}` | `factionId, cards[], reason` |
| `{CardsLocked}` | `factionId, cards[], reason` |

### Reputation Change Sources
| Source | Typical Delta |
|--------|---------------|
| Alliance in victory | +15 |
| Alliance in defeat | -10 |
| Betrayal / broken promise | -30 |
| Quest completion for faction | +20 |
| Quest failure | -15 |
| Narrative choice | Variable |
| Faction conflict (ally with enemy) | -10 to -15 |

### Read Models

**ReputationDashboard**
```
{
  factions: [{
    id, name, iconUrl
    reputation: number
    status: 'devoted' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile'
    trend: 'rising' | 'falling' | 'stable'
    availableCardCount: number
    allianceAvailable: boolean
  }]
}
```

**FactionDetailView**
```
{
  id, name, description
  values: string[]
  cardProfile: string
  reputation: number
  status: string
  history: [{ event, delta, timestamp }]
  availableCards: Card[]
  lockedCards: [{ card, unlockRequirement }]
  conflictsWith: [{ factionId, reason }]
}
```

---

## Slice: Card Acquisition

How cards are gained and lost throughout the game.

### Sources of Cards
- Quest acceptance (initial grant)
- Alliance formation
- Dilemma choices
- Quest completion bonus
- Reputation threshold unlock

### Causes of Card Loss
- Reputation drop below threshold
- Betrayal consequences
- Quest failure penalties
- Narrative choices

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Accept quest | `[AcceptQuest]` | `{QuestAccepted}`, `{CardGained}` | `<CardPoolView>` |
| Make choice with card reward | `[MakeChoice]` | `{ChoiceMade}`, `{CardGained}` | `<CardPoolView>` |
| Form alliance | `[FormAlliance]` | `{AllianceFormed}`, `{CardGained}` | `<CardPoolView>` |
| Reputation unlocks tier | *(system)* | `{ReputationThresholdCrossed}`, `{CardsUnlocked}` | `<CardPoolView>` |
| Reputation drops below tier | *(system)* | `{ReputationThresholdCrossed}`, `{CardsLocked}` | `<CardPoolView>` |
| Betrayal discovered | *(system)* | `{AllianceDiscovered}`, `{CardLost}` | `<CardPoolView>` |
| View card details | `[ViewCardDetails]` | — | `<CardDetailView>` |

### Events

| Event | Payload |
|-------|---------|
| `{CardGained}` | `cardId, factionId, source: 'quest' | 'choice' | 'alliance' | 'unlock'` |
| `{CardLost}` | `cardId, factionId, reason: 'reputation' | 'betrayal' | 'choice' | 'penalty'` |
| `{CardsUnlocked}` | `factionId, cardIds[], reputationThreshold` |
| `{CardsLocked}` | `factionId, cardIds[], reputationThreshold` |

### Read Models

**CardPoolView** (updated)
```
{
  ownedCards: [{
    id, name, faction
    attack, armor, agility
    source: string
    isLocked: boolean
    lockReason?: string
  }]
  byFaction: {
    [factionId]: {
      available: Card[]
      locked: [{ card, unlockAt: reputationValue }]
    }
  }
  totalCount: number
  availableCount: number
}
```

**CardDetailView**
```
{
  id, name, faction
  attack, armor, agility
  flavorText: string
  acquiredFrom: string
  acquiredAt: timestamp
  battleHistory: {
    timesUsed, wins, losses, draws
  }
}
```

---

## Slice: Post-Battle Dilemmas

Dilemmas that occur in the Consequence phase, after battle resolution.

### Types
1. **Victory Dilemmas**: What to do with spoils/captives (e.g., "Survivor Question")
2. **Defeat Dilemmas**: How to handle failure (retreat options, blame)
3. **Discovery Dilemmas**: Secret alliance exposed, must respond
4. **Complication Dilemmas**: Unexpected outcomes requiring decision

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Battle ends with dilemma condition | *(system)* | `{BattleResolved}`, `{PostBattleDilemmaTriggered}` | `<PostBattleDilemmaView>` |
| Choose post-battle option | `[MakePostBattleChoice]` | `{PostBattleChoiceMade}`, *(consequence events)* | `<ConsequenceView>` |
| Secret alliance discovered | *(system, probability check)* | `{AllianceDiscovered}`, `{PostBattleDilemmaTriggered}` | `<PostBattleDilemmaView>` |

### Events

| Event | Payload |
|-------|---------|
| `{PostBattleDilemmaTriggered}` | `battleId, dilemmaType, dilemmaId, context` |
| `{PostBattleChoiceMade}` | `dilemmaId, choiceId, consequences[]` |
| `{AllianceDiscovered}` | `secretAllyFaction, discoveredByFaction, context` |

### Dilemma Types

**Victory: Spoils Decision**
```
{
  type: 'spoils'
  context: "Survivors found on the derelict"
  voices: [
    { npc: "Castellan Vorn", position: "Contract says salvage" },
    { npc: "Survivor Leader", position: "We just want to go home" },
    { npc: "First Officer", position: "Your call, Captain" }
  ]
  choices: [
    { id: 'hand_over', label: "Hand over survivors", effects: [...] },
    { id: 'release', label: "Release survivors", effects: [...] },
    { id: 'smuggle', label: "Smuggle to Ashfall", effects: [...], risk: 0.3 }
  ]
}
```

**Defeat: Retreat Decision**
```
{
  type: 'retreat'
  context: "The assault has failed"
  choices: [
    { id: 'full_retreat', label: "Full retreat", effects: [...] },
    { id: 'fighting_retreat', label: "Fighting retreat (risk more losses)", effects: [...] },
    { id: 'surrender', label: "Negotiate surrender", effects: [...] }
  ]
}
```

**Discovery: Alliance Exposed**
```
{
  type: 'discovery'
  context: "Krath has learned of your secret deal with the Ashfall"
  choices: [
    { id: 'deny', label: "Deny involvement", effects: [...], successChance: 0.2 },
    { id: 'admit', label: "Admit the alliance", effects: [...] },
    { id: 'deflect', label: "Blame subordinate", effects: [...] }
  ]
}
```

### Read Models

**PostBattleDilemmaView**
```
{
  battleOutcome: 'victory' | 'defeat' | 'draw'
  dilemmaType: string
  situation: string
  voices: [{ npc, faction, dialogue, position }]
  choices: [{
    id, label
    consequences: {
      reputation: [{ faction, delta }]
      bounty: { modifier, reason }
      cards: [{ action, card }]
      risk?: { event, probability }
    }
  }]
}
```

---

## Slice: Game End Evaluation

Occurs after completing three quest arcs. Calculates final state and determines ending.

### Evaluation Criteria
1. **Fleet Composition**: Which factions' cards dominate?
2. **Reputation Summary**: Standing with each faction
3. **Choice Archaeology**: Patterns in decisions
4. **Battle Record**: Wins, losses, draws

### Ending Types
| Pattern | Title |
|---------|-------|
| High single faction rep | "Commander of the [Faction] Fleet" |
| Balanced reputation | "The Broker" / "The Neutral" |
| High deception count | "The Opportunist" |
| High combat victories | "The Conqueror" |
| Diplomatic preference | "The Negotiator" |

### Command Patterns

| Trigger | Command | Event(s) | Read Model |
|---------|---------|----------|------------|
| Third quest completed | *(system)* | `{QuestCompleted}`, `{GameEndTriggered}` | `<EndingCalculation>` |
| Evaluation complete | *(system)* | `{EndingDetermined}` | `<EndingView>` |
| View ending | *(navigation)* | — | `<EndingView>` |
| View choice history | `[ViewChoiceHistory]` | — | `<ChoiceArchaeologyView>` |
| Start new game | `[StartNewGame]` | `{NewGameStarted}` | — |

### Events

| Event | Payload |
|-------|---------|
| `{GameEndTriggered}` | `questsCompleted: 3, totalPlayTime` |
| `{EndingDetermined}` | `endingType, title, primaryFaction?, scores{}` |
| `{NewGameStarted}` | `previousEndingType, timestamp` |

### Read Models

**EndingCalculation**
```
{
  fleetComposition: {
    [factionId]: { cardCount, percentage }
  }
  reputationFinal: {
    [factionId]: { value, status }
  }
  choicePatterns: {
    combatVsDiplomacy: ratio
    loyaltyVsOpportunism: ratio
    betrayalCount: number
    secretsKept: number
    secretsExposed: number
  }
  battleRecord: {
    total, wins, losses, draws
  }
  dominantPattern: string
  endingType: string
  title: string
}
```

**EndingView**
```
{
  title: string
  subtitle: string
  summary: string  // 2-3 paragraphs describing the captain's legacy
  vignettes: [{
    title: string
    text: string
    relatedChoice: choiceId
  }]
  stats: {
    questsCompleted: 3
    battlesWon: number
    factionsAllied: number
    betrayals: number
  }
  fleetDisplay: Card[]  // visual of final fleet
  reputationBars: [{ faction, finalValue }]
}
```

**ChoiceArchaeologyView**
```
{
  timeline: [{
    questId, questTitle
    choices: [{
      dilemmaTitle
      choiceMade: string
      consequences: string
      timestamp
    }]
  }]
  patterns: {
    mostAlliedFaction: string
    mostBetrayed: string
    preferredResolution: 'combat' | 'diplomacy' | 'mixed'
  }
}
```

---

## Event Catalog: Complete

Total events across all slices: **42 events**

### Quest Events (6)
- QuestsGenerated, QuestViewed, QuestAccepted, QuestDeclined, QuestCompleted, QuestFailed

### Narrative Events (3)
- DilemmaPresented, ChoiceMade, FlagSet

### Alliance Events (7)
- AlliancePhaseStarted, AllianceTermsViewed, AllianceFormed, AllianceRejected, AlliancesDeclined, SecretAllianceFormed, AllianceDiscovered

### Mediation Events (5)
- MediationStarted, PositionViewed, MediationLeaned, MediationCollapsed, CompromiseAccepted

### Reputation Events (4)
- ReputationChanged, ReputationThresholdCrossed, CardsUnlocked, CardsLocked

### Card Events (2)
- CardGained, CardLost

### Battle Events (12)
- BattleTriggered, CardSelected, CardDeselected, FleetCommitted, CardPositioned, OrdersLocked, BattleStarted, RoundStarted, CardsRevealed, InitiativeResolved, AttackRolled, RoundResolved, BattleResolved

### Post-Battle Events (2)
- PostBattleDilemmaTriggered, PostBattleChoiceMade

### Game End Events (3)
- GameEndTriggered, EndingDetermined, NewGameStarted

---

## Read Model Catalog: Complete

Total read models: **18 projections**

| Read Model | Primary Screen | Key Source Events |
|------------|----------------|-------------------|
| `<QuestList>` | Quest Hub | QuestAccepted, QuestCompleted, QuestFailed |
| `<QuestDetailView>` | Quest Hub (modal) | QuestsGenerated |
| `<ActiveQuest>` | Header / Quest Tracker | QuestAccepted, AllianceFormed, BattleResolved |
| `<DilemmaView>` | Narrative Screen | DilemmaPresented |
| `<AllianceOptions>` | Alliance Screen | AlliancePhaseStarted, ReputationChanged |
| `<AllianceTermsView>` | Alliance Screen (modal) | AllianceTermsViewed |
| `<MediationView>` | Mediation Screen | MediationStarted |
| `<MediationOutcomeView>` | Mediation Screen | MediationLeaned, CompromiseAccepted |
| `<ReputationDashboard>` | Reputation Screen | ReputationChanged, ReputationThresholdCrossed |
| `<FactionDetailView>` | Reputation Screen (modal) | ReputationChanged, CardGained, CardLost |
| `<CardPoolView>` | Card Pool Screen | CardGained, CardLost, CardsUnlocked, CardsLocked |
| `<CardDetailView>` | Card Pool Screen (modal) | CardGained, BattleResolved |
| `<DeploymentView>` | Deployment Screen | FleetCommitted, CardPositioned |
| `<RoundView>` | Battle Screen | RoundStarted, CardsRevealed, AttackRolled, RoundResolved |
| `<BattleResultView>` | Battle Screen | BattleResolved |
| `<ConsequenceView>` | Consequence Screen | BattleResolved, ReputationChanged, BountyCalculated |
| `<PostBattleDilemmaView>` | Consequence Screen | PostBattleDilemmaTriggered |
| `<EndingView>` | Ending Screen | EndingDetermined |
| `<ChoiceArchaeologyView>` | Ending Screen | ChoiceMade (all) |
| `<PlayerState>` | Header (all screens) | ReputationChanged, CardGained, BountyCalculated |
