# Space Fortress: Complete Event Catalog

This document catalogs all events in the Space Fortress event-sourced architecture.

## Event Naming Convention

- **Format**: `NOUN_PAST_TENSE_VERB`
- **Examples**: `QUEST_ACCEPTED`, `CARD_GAINED`, `BATTLE_RESOLVED`
- Events are immutable facts that have occurred
- All events include a `timestamp` field

---

## Event Count Summary

| Category | Count |
|----------|-------|
| Quest Events | 6 |
| Narrative Events | 3 |
| Alliance Events | 7 |
| Mediation Events | 5 |
| Reputation Events | 4 |
| Card Events | 2 |
| Battle Events | 13 |
| Consequence Events | 4 |
| Post-Battle Events | 2 |
| Game Lifecycle Events | 4 |
| Phase Events | 1 |
| **Total** | **51** |

---

## Quest Events (6)

### `QUESTS_GENERATED`
Available quests have been generated at game start or after quest completion.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questIds` | string[] | IDs of generated quests |

### `QUEST_VIEWED`
Player viewed details of a quest in the Quest Hub.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | ID of viewed quest |

### `QUEST_ACCEPTED`
Player accepted a quest, beginning a new adventure.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | ID of accepted quest |
| `factionId` | FactionId | Quest-giving faction |
| `initialBounty` | number | Starting bounty value |
| `initialCardIds` | string[] | Cards granted on acceptance |

### `QUEST_DECLINED`
Player declined to accept a quest.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | ID of declined quest |
| `reason` | string? | Optional reason |

### `QUEST_COMPLETED`
Quest finished successfully.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | ID of completed quest |
| `outcome` | 'full' \| 'partial' \| 'compromised' | Completion type |
| `finalBounty` | number | Final bounty earned |

### `QUEST_FAILED`
Quest ended in failure.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | ID of failed quest |
| `failurePoint` | string | Where failure occurred |
| `reason` | string | Why quest failed |

---

## Narrative Events (3)

### `DILEMMA_PRESENTED`
A narrative dilemma has been presented to the player.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `dilemmaId` | string | ID of presented dilemma |
| `questId` | string | Parent quest ID |

### `CHOICE_MADE`
Player made a choice in a dilemma.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `dilemmaId` | string | ID of dilemma |
| `choiceId` | string | ID of selected choice |
| `questId` | string | Parent quest ID |

### `FLAG_SET`
A story flag has been set based on player choices.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `flagName` | string | Name of the flag |
| `value` | boolean | Flag value |

---

## Alliance Events (7)

### `ALLIANCE_PHASE_STARTED`
Alliance negotiation phase has begun.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | Quest ID |
| `battleContext` | string | Why battle is needed |
| `availableFactionIds` | FactionId[] | Factions available for alliance |

### `ALLIANCE_TERMS_VIEWED`
Player viewed alliance terms for a faction.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Faction whose terms were viewed |

### `ALLIANCE_FORMED`
Player formed an alliance with a faction.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Allied faction |
| `bountyShare` | number | Percentage of bounty shared |
| `cardIdsProvided` | string[] | Cards granted by alliance |
| `isSecret` | boolean | Whether alliance is secret |

### `ALLIANCE_REJECTED`
Player rejected alliance terms from a faction.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Rejected faction |
| `reason` | string? | Optional reason |

### `ALLIANCES_DECLINED`
Player declined to form any alliances.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questId` | string | Quest ID |

### `SECRET_ALLIANCE_FORMED`
Player formed a secret alliance (higher risk).

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Secret ally |
| `publicFactionId` | FactionId? | Public-facing ally (cover) |
| `discoveryRisk` | number | Chance of being discovered |
| `cardIdsProvided` | string[] | Cards granted |

### `ALLIANCE_DISCOVERED`
A secret alliance has been discovered.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `secretFactionId` | FactionId | The secret ally |
| `discoveredByFactionId` | FactionId | Who discovered it |
| `reputationPenalty` | number | Reputation loss |

---

## Mediation Events (5)

### `MEDIATION_STARTED`
Diplomatic mediation has begun between factions.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `mediationId` | string | Mediation session ID |
| `questId` | string | Quest ID |
| `facilitatorFactionId` | FactionId | Neutral facilitator |
| `partyFactionIds` | [FactionId, FactionId] | Disputing parties |

### `POSITION_VIEWED`
Player viewed a faction's negotiating position.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Faction whose position was viewed |

### `MEDIATION_LEANED`
Player indicated preference for one faction's position.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `towardFactionId` | FactionId | Favored faction |
| `awayFromFactionId` | FactionId | Disfavored faction |

### `MEDIATION_COLLAPSED`
Mediation failed, may trigger battle.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `reason` | string | Why mediation failed |
| `battleTriggered` | boolean | Whether battle was triggered |

### `COMPROMISE_ACCEPTED`
Diplomatic compromise was accepted.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `terms` | string | Compromise terms |
| `bountyModifier` | number | Bounty adjustment percentage |

---

## Reputation Events (4)

### `REPUTATION_CHANGED`
Player's reputation with a faction changed.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Affected faction |
| `delta` | number | Change amount |
| `newValue` | number | New reputation value |
| `source` | 'quest' \| 'choice' \| 'alliance' \| 'battle' \| 'betrayal' \| 'discovery' | What caused change |

### `REPUTATION_THRESHOLD_CROSSED`
Reputation crossed a significant threshold.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Affected faction |
| `oldStatus` | ReputationStatus | Previous status |
| `newStatus` | ReputationStatus | New status |
| `direction` | 'up' \| 'down' | Direction of change |

### `CARDS_UNLOCKED`
Cards became available due to reputation increase.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Faction whose cards unlocked |
| `cardIds` | string[] | Unlocked card IDs |
| `reason` | string | Why cards unlocked |

### `CARDS_LOCKED`
Cards became unavailable due to reputation decrease.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Faction whose cards locked |
| `cardIds` | string[] | Locked card IDs |
| `reason` | string | Why cards locked |

---

## Card Events (2)

### `CARD_GAINED`
Player acquired a new card.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `cardId` | string | Card ID |
| `factionId` | FactionId | Card's faction |
| `source` | 'starter' \| 'quest' \| 'alliance' \| 'choice' \| 'unlock' | How card was acquired |

### `CARD_LOST`
Player lost a card.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `cardId` | string | Card ID |
| `factionId` | FactionId | Card's faction |
| `reason` | 'reputation' \| 'betrayal' \| 'choice' \| 'penalty' | Why card was lost |

---

## Battle Events (13)

### `BATTLE_TRIGGERED`
A battle has been triggered.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle session ID |
| `questId` | string | Quest ID |
| `context` | string | Battle context description |
| `opponentType` | string | Type of opponent |
| `opponentFactionId` | FactionId \| 'scavengers' \| 'pirates' | Opponent faction |
| `difficulty` | 'easy' \| 'medium' \| 'hard' | Battle difficulty |

### `CARD_SELECTED`
Player selected a card for battle.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `cardId` | string | Selected card ID |
| `battleId` | string | Battle ID |

### `CARD_DESELECTED`
Player deselected a card.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `cardId` | string | Deselected card ID |
| `battleId` | string | Battle ID |

### `FLEET_COMMITTED`
Player committed 5 cards for battle.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `cardIds` | string[] | Committed card IDs (5) |

### `CARD_POSITIONED`
Player positioned a card in a battle slot.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `cardId` | string | Positioned card ID |
| `position` | number | Slot position (1-5) |
| `battleId` | string | Battle ID |

### `ORDERS_LOCKED`
Player locked deployment orders.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `positions` | string[] | Card IDs in position order |

### `BATTLE_STARTED`
Battle execution has begun.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `playerCardIds` | string[] | Player's cards |
| `opponentCards` | Card[] | Opponent's cards |

### `ROUND_STARTED`
A battle round has started.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `roundNumber` | number | Round number (1-5) |

### `CARDS_REVEALED`
Both cards for current round revealed.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `roundNumber` | number | Round number |
| `playerCard` | Card | Player's card |
| `opponentCard` | Card | Opponent's card |

### `INITIATIVE_RESOLVED`
Turn order determined by agility.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `roundNumber` | number | Round number |
| `firstStriker` | 'player' \| 'opponent' \| 'simultaneous' | Who attacks first |
| `playerAgility` | number | Player card agility |
| `opponentAgility` | number | Opponent card agility |

### `ATTACK_ROLLED`
An attack roll was made.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `roundNumber` | number | Round number |
| `attacker` | 'player' \| 'opponent' | Who is attacking |
| `roll` | number | d20 roll result |
| `modifier` | number | Attack stat modifier |
| `total` | number | Roll + modifier |
| `targetArmor` | number | Defender's armor |
| `targetNumber` | number | 10 + armor |
| `hit` | boolean | Whether attack hit |

### `ROUND_RESOLVED`
Round outcome determined.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `roundNumber` | number | Round number |
| `outcome` | RoundOutcome | 'player_won' \| 'opponent_won' \| 'draw' |
| `playerCard` | Card | Player's card |
| `opponentCard` | Card | Opponent's card |
| `playerRoll` | object | Player's roll details |
| `opponentRoll` | object | Opponent's roll details |

### `BATTLE_RESOLVED`
Battle has ended with final outcome.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `outcome` | BattleOutcome | 'victory' \| 'defeat' \| 'draw' |
| `playerWins` | number | Rounds won by player |
| `opponentWins` | number | Rounds won by opponent |
| `draws` | number | Drawn rounds |
| `roundsSummary` | RoundResult[] | All round results |

---

## Consequence Events (4)

### `BOUNTY_CALCULATED`
Final bounty has been calculated.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `base` | number | Base bounty |
| `shares` | array | Alliance shares |
| `modifiers` | array | Other modifiers |
| `net` | number | Final bounty |

### `BOUNTY_SHARED`
Bounty portion given to ally faction.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `factionId` | FactionId | Receiving faction |
| `amount` | number | Amount shared |

### `OUTCOME_ACKNOWLEDGED`
Player acknowledged battle outcome.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |

### `BOUNTY_MODIFIED`
Bounty was modified during gameplay.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `amount` | number | Change amount |
| `newValue` | number | New bounty total |
| `source` | 'choice' \| 'alliance' \| 'quest' \| 'penalty' | Source of change |
| `reason` | string | Description |

---

## Post-Battle Events (2)

### `POST_BATTLE_DILEMMA_TRIGGERED`
A dilemma occurs after battle.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `battleId` | string | Battle ID |
| `dilemmaId` | string | Dilemma ID |
| `dilemmaType` | PostBattleDilemmaType | Type of post-battle dilemma |
| `context` | string | Contextual description |

### `POST_BATTLE_CHOICE_MADE`
Player made choice in post-battle dilemma.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `dilemmaId` | string | Dilemma ID |
| `choiceId` | string | Choice ID |

---

## Game Lifecycle Events (4)

### `GAME_STARTED`
New game has begun.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `playerId` | string | Player identifier |
| `starterCardIds` | string[] | Initial cards |

### `GAME_END_TRIGGERED`
Game end conditions met.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `questsCompleted` | number | Total quests done |
| `totalPlayTimeSeconds` | number | Total play time |

### `ENDING_DETERMINED`
Final ending type calculated.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `endingType` | EndingType | Type of ending |
| `title` | string | Ending title |
| `subtitle` | string | Ending subtitle |
| `primaryFactionId` | FactionId? | Dominant faction |

### `NEW_GAME_STARTED`
Player started a new game.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `previousEndingType` | EndingType? | Previous ending |

---

## Phase Events (1)

### `PHASE_CHANGED`
Game phase has transitioned.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO timestamp |
| `fromPhase` | GamePhase | Previous phase |
| `toPhase` | GamePhase | New phase |

**Valid Phases**: `not_started`, `quest_hub`, `narrative`, `alliance`, `mediation`, `card_selection`, `deployment`, `battle`, `consequence`, `post_battle_dilemma`, `ending`

---

## Event Type Guards

The codebase provides type guards for filtering events:

```typescript
isQuestEvent(event)       // Quest-related events
isBattleEvent(event)      // Battle-related events
isReputationEvent(event)  // Reputation-related events
```

---

## Implementation Notes

### Events Not Yet Generated

The following events are defined but not currently emitted by the decider:

| Event | Status | Notes |
|-------|--------|-------|
| `MEDIATION_STARTED` | ⚠️ Defined but not emitted | Mediation flows without explicit start |
| `REPUTATION_THRESHOLD_CROSSED` | ⚠️ Defined but not emitted | Could enable special effects |
| `CARDS_UNLOCKED` / `CARDS_LOCKED` | ⚠️ Defined but not emitted | For future reputation gating |
| `POST_BATTLE_DILEMMA_TRIGGERED` | ⚠️ Defined but not emitted | Post-battle flow not implemented |

---

*Source: `src/lib/game/events.ts`*
*Last Updated: 2025-12-15*
