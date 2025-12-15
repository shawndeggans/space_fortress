# Space Fortress Development Guidelines

This project uses **event sourcing architecture**. All development must follow the patterns established in this codebase.

## Critical Architecture Rules

### The Core Flow

```
Player Action → Command → Decider → Events → Event Store → Projections → UI
```

**NEVER bypass this flow.** All game state changes must go through events.

### 1. Never Mutate State Directly

```typescript
// WRONG - Direct mutation
state.reputation.ironveil += 10

// CORRECT - Emit an event, projection handles state
events.push({
  type: 'REPUTATION_CHANGED',
  data: { faction: 'ironveil', delta: 10, newValue: state.reputation.ironveil + 10 }
})
```

### 2. Commands Are Player Intent (Present Tense)

Commands represent what the player *wants* to do. They are validated before generating events.

```typescript
// Command naming: verb + noun, present tense
'ACCEPT_QUEST'      // not 'QUEST_ACCEPTED'
'SELECT_CARD'       // not 'CARD_SELECTED'
'MAKE_CHOICE'       // not 'CHOICE_MADE'
'COMMIT_FLEET'      // not 'FLEET_COMMITTED'
```

**Location:** `src/lib/game/commands.ts` or `src/lib/game/types.ts`

### 3. Events Are Facts (Past Tense)

Events are immutable facts that happened. They are stored forever and never modified.

```typescript
// Event naming: noun + past tense verb
'QUEST_ACCEPTED'      // not 'ACCEPT_QUEST'
'CARD_SELECTED'       // not 'SELECT_CARD'
'CHOICE_MADE'         // not 'MAKE_CHOICE'
'REPUTATION_CHANGED'  // not 'CHANGE_REPUTATION'
'BATTLE_RESOLVED'     // not 'RESOLVE_BATTLE'
```

**Location:** `src/lib/game/events.ts` or `src/lib/game/types.ts`

### 4. Decider Contains Business Logic

The decider validates commands against current state and generates events. This is where game rules live.

```typescript
// src/lib/game/decider.ts
export function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    case 'ACCEPT_QUEST':
      // VALIDATE first
      if (state.activeQuest) {
        throw new InvalidCommandError('Already have an active quest')
      }
      if (state.reputation[quest.faction] < quest.reputationRequired) {
        throw new InvalidCommandError('Insufficient reputation')
      }

      // THEN generate events
      return [
        { type: 'QUEST_ACCEPTED', data: { questId: command.data.questId, ... } },
        { type: 'CARD_GAINED', data: { cardId: 'starter_card', source: 'quest' } }
      ]
  }
}
```

**Key patterns:**
- Validate command is legal given current state
- Throw `InvalidCommandError` for illegal commands
- Return array of events (often multiple events per command)
- Calculate derived values (new reputation, etc.) and include in event data

### 5. Projections Are Pure Functions

Projections fold events into state. They must be pure functions with no side effects.

```typescript
// src/lib/game/projections.ts
export function evolveState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'REPUTATION_CHANGED':
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [event.data.faction]: event.data.newValue
        }
      }
    default:
      return state
  }
}
```

**Key patterns:**
- Always return new state object (immutable updates)
- Use spread operator for nested updates
- Handle unknown events by returning state unchanged
- No side effects, no async, no external calls

### 6. Read Models Project from Events

Each UI screen has a read model that projects relevant data from events.

```typescript
// src/lib/game/projections/questList.ts
export function projectQuestList(events: GameEvent[]): QuestListView {
  const state = events.reduce(evolveState, getInitialState())
  return {
    available: quests.filter(q =>
      state.reputation[q.faction] >= q.reputationRequired &&
      !state.completedQuests.includes(q.id)
    ),
    active: state.activeQuest,
    completed: state.completedQuests
  }
}
```

---

## File Organization

```
src/lib/game/
├── types.ts           # Shared types (Card, Quest, Faction, etc.)
├── commands.ts        # Command type definitions
├── events.ts          # Event type definitions
├── state.ts           # GameState interface
├── decider.ts         # Command → Events logic
├── projections.ts     # evolveState and getInitialState
├── projections/       # Screen-specific read models
│   ├── index.ts
│   ├── questList.ts
│   ├── cardPool.ts
│   ├── battleView.ts
│   └── ...
├── combat.ts          # Battle resolution logic
├── content/           # Game data (cards, quests, factions)
│   ├── cards.ts
│   ├── quests.ts
│   └── factions.ts
└── __tests__/         # Unit tests
```

---

## Adding New Features

### Adding a New Command

1. Define command type in `commands.ts`:
```typescript
| { type: 'FORM_ALLIANCE'; data: { factionId: FactionId; questId: string } }
```

2. Handle in `decider.ts`:
```typescript
case 'FORM_ALLIANCE':
  // Validate
  if (!state.activeQuest) throw new InvalidCommandError('No active quest')
  // Generate events
  return [
    { type: 'ALLIANCE_FORMED', data: { ... } },
    { type: 'CARD_GAINED', data: { ... } }
  ]
```

3. Add tests in `__tests__/`

### Adding a New Event

1. Define event type in `events.ts`:
```typescript
| { type: 'ALLIANCE_FORMED'; data: { factionId: FactionId; bountyShare: number; cardsProvided: string[] } }
```

2. Handle in `projections.ts`:
```typescript
case 'ALLIANCE_FORMED':
  return {
    ...state,
    currentAlliance: {
      faction: event.data.factionId,
      bountyShare: event.data.bountyShare
    }
  }
```

3. Add tests in `__tests__/`

### Adding a New Screen

1. Create read model in `projections/screenName.ts`
2. Create Svelte component in `src/routes/screen-name/+page.svelte`
3. Use derived store to connect read model to UI

---

## Testing Requirements

Every command handler and projection must have tests.

```typescript
// src/lib/game/__tests__/alliance.test.ts
describe('Alliance System', () => {
  it('allows forming alliance with friendly faction', () => {
    const state = buildState([
      { type: 'QUEST_ACCEPTED', data: { questId: 'q1' } },
      { type: 'REPUTATION_CHANGED', data: { faction: 'ironveil', delta: 30, newValue: 30 } }
    ])

    const events = decide({ type: 'FORM_ALLIANCE', data: { factionId: 'ironveil', questId: 'q1' } }, state)

    expect(events).toContainEqual(expect.objectContaining({ type: 'ALLIANCE_FORMED' }))
  })

  it('rejects alliance with hostile faction', () => {
    const state = buildState([
      { type: 'QUEST_ACCEPTED', data: { questId: 'q1' } },
      { type: 'REPUTATION_CHANGED', data: { faction: 'ironveil', delta: -80, newValue: -80 } }
    ])

    expect(() =>
      decide({ type: 'FORM_ALLIANCE', data: { factionId: 'ironveil', questId: 'q1' } }, state)
    ).toThrow(InvalidCommandError)
  })
})
```

---

## UI Development

### Svelte Component Patterns

```svelte
<script lang="ts">
  import { gameStore } from '$lib/stores/gameStore'
  import { projectCardPoolView } from '$lib/game/projections/cardPool'

  // Derived read model - updates automatically
  $: cardPool = projectCardPoolView($gameStore.events)

  // Dispatch commands through the store
  async function selectCard(cardId: string) {
    await gameStore.dispatch({
      type: 'SELECT_CARD',
      data: { cardId, battleId: cardPool.currentBattleId }
    })
  }
</script>

{#each cardPool.availableCards as card}
  <Card {card} selected={card.isSelected} on:click={() => selectCard(card.id)} />
{/each}
```

### Component Guidelines

- Components receive data via props or derived stores
- Components dispatch commands, never mutate state
- Use read models for display logic, not raw state
- Keep components focused on presentation

---

## Code Style

### TypeScript

- Use discriminated unions for commands and events
- Define explicit interfaces for all data structures
- Use type guards when narrowing event/command types

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Commands | SCREAMING_SNAKE_CASE | `ACCEPT_QUEST` |
| Events | SCREAMING_SNAKE_CASE | `QUEST_ACCEPTED` |
| Types/Interfaces | PascalCase | `GameState`, `Card` |
| Functions | camelCase | `projectCardPoolView` |
| Files | kebab-case or camelCase | `card-pool.ts`, `decider.ts` |

### Event Data

- Always include timestamps for debugging
- Include both delta and newValue for numeric changes
- Include source/reason for tracking (e.g., `source: 'quest' | 'alliance' | 'choice'`)

---

## What NOT To Do

1. **Don't store derived data** - Calculate it from events
2. **Don't modify events** - They are immutable history
3. **Don't call APIs from decider** - Decider is pure logic
4. **Don't use setTimeout/setInterval in game logic** - Events should be deterministic
5. **Don't access DOM from game logic** - Keep it separate from UI
6. **Don't skip the command/event flow** - Even for "simple" state changes

---

## Quick Reference

### Adding a Complete Feature

Example: Adding "Card Upgrade" feature

1. **Types** (`types.ts`):
   ```typescript
   interface CardUpgrade { cardId: string; stat: 'attack' | 'armor' | 'agility'; amount: number }
   ```

2. **Command** (`commands.ts`):
   ```typescript
   | { type: 'UPGRADE_CARD'; data: { cardId: string; stat: string } }
   ```

3. **Event** (`events.ts`):
   ```typescript
   | { type: 'CARD_UPGRADED'; data: { cardId: string; stat: string; oldValue: number; newValue: number } }
   ```

4. **Decider** (`decider.ts`):
   ```typescript
   case 'UPGRADE_CARD':
     const card = state.ownedCards.find(c => c.id === command.data.cardId)
     if (!card) throw new InvalidCommandError('Card not owned')
     if (state.bounty < UPGRADE_COST) throw new InvalidCommandError('Insufficient bounty')
     return [
       { type: 'CARD_UPGRADED', data: { cardId: card.id, stat: command.data.stat, oldValue: card[stat], newValue: card[stat] + 1 } },
       { type: 'BOUNTY_SPENT', data: { amount: UPGRADE_COST, reason: 'card_upgrade' } }
     ]
   ```

5. **Projection** (`projections.ts`):
   ```typescript
   case 'CARD_UPGRADED':
     return {
       ...state,
       ownedCards: state.ownedCards.map(c =>
         c.id === event.data.cardId
           ? { ...c, [event.data.stat]: event.data.newValue }
           : c
       )
     }
   ```

6. **Tests** (`__tests__/upgrade.test.ts`)

7. **UI** (component that dispatches `UPGRADE_CARD` command)

---

## Documentation References

- `README.md` - Architecture overview and examples
- `docs/design/events/CORE-LOOP-EVENT-MODEL.md` - Visual event flow diagrams
- `docs/design/events/EVENT-CATALOG.md` - Complete event reference (51 events)
- `docs/design/events/FEATURE-AREAS.md` - Feature area patterns and read models
- `docs/design/slices/` - Vertical slice architecture documentation
- `docs/design/screens/SCREENS.md` - UI wireframes and read models
- `docs/DEVELOPMENT-PLAN.md` - Implementation roadmap
