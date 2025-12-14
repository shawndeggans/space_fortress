# Space Fortress - Framework Development Guide

A narrative-driven game engine built with **event sourcing** architecture. Create branching story games with persistent save states, moral alignment systems, and complex game logic - all running in the browser.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:1420 in your browser
```

## Architecture Overview

This engine uses **event sourcing** - every player action is stored as an immutable event. Game state is reconstructed by replaying these events. This gives you:

- **Perfect save/load** - Save games are just pointers to event streams
- **Time-travel debugging** - Replay events to see exactly what happened
- **Easy branching narratives** - State is derived from choices, not mutated
- **Undo/redo for free** - Just replay fewer events
- **Analytics built-in** - Every player action is recorded

```
Player Action -> Command -> Decider -> Events -> Event Store -> Projections -> UI
```

## Project Structure

```
src/
├── lib/
│   ├── game/
│   │   ├── types.ts        # Commands, Events, State definitions
│   │   ├── decider.ts      # Command -> Event logic (game rules)
│   │   ├── projections.ts  # Event -> State reconstruction
│   │   └── __tests__/      # Unit tests
│   ├── eventStore/
│   │   └── BrowserEventStore.ts  # SQLite in browser via sql.js
│   └── stores/
│       └── gameStore.ts    # Svelte reactive store
├── routes/
│   └── +page.svelte        # Game UI
```

## Core Concepts

### 1. Commands (Player Intent)

Commands represent what the player *wants* to do. They're validated before generating events.

```typescript
// src/lib/game/types.ts
export type GameCommand =
  | { type: 'START_GAME'; data: { playerId: string; timestamp: string } }
  | { type: 'MAKE_CHOICE'; data: { choiceId: string; option: string } }
  | { type: 'ENTER_LOCATION'; data: { locationId: string } }
  | { type: 'COLLECT_ITEM'; data: { itemId: string } }
```

**To add a new command:**
1. Add the type to `GameCommand` union in `types.ts`
2. Handle it in `decider.ts`

### 2. Events (Immutable Facts)

Events are facts that happened. They're stored forever and never modified.

```typescript
// src/lib/game/types.ts
export type GameEvent =
  | { type: 'GAME_STARTED'; data: { playerId: string; startedAt: string } }
  | { type: 'CHOICE_MADE'; data: { choiceId: string; option: string; madeAt: string } }
  | { type: 'MORAL_ALIGNMENT_CHANGED'; data: { delta: number; newValue: number } }
  | { type: 'ITEM_COLLECTED'; data: { itemId: string; collectedAt: string } }
```

**Event naming conventions:**
- Use past tense: `CHOICE_MADE` not `MAKE_CHOICE`
- Be specific: `PLAYER_DEFEATED_BOSS` not `HEALTH_SET_TO_ZERO`
- Include timestamps for debugging

### 3. Game State (Current Projection)

State is computed by replaying events. Never mutate it directly.

```typescript
// src/lib/game/types.ts
export interface GameState {
  playerId: string
  currentLocation: string
  moralAlignment: number
  choicesMade: Array<{ choiceId: string; option: string }>
  inventory: string[]
  status: 'not_started' | 'in_progress' | 'completed'
}
```

### 4. The Decider (Game Rules)

The decider validates commands and generates events. This is where your game logic lives.

```typescript
// src/lib/game/decider.ts
export function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    case 'MAKE_CHOICE':
      // Validate
      if (state.status !== 'in_progress') {
        throw new InvalidCommandError('Game not in progress')
      }

      // Generate events
      const events: GameEvent[] = [{
        type: 'CHOICE_MADE',
        data: {
          choiceId: command.data.choiceId,
          option: command.data.option,
          madeAt: new Date().toISOString()
        }
      }]

      // Add side effects (moral alignment changes, etc.)
      const delta = calculateMoralDelta(command.data.choiceId, command.data.option)
      if (delta !== 0) {
        events.push({
          type: 'MORAL_ALIGNMENT_CHANGED',
          data: { delta, newValue: state.moralAlignment + delta }
        })
      }

      return events
  }
}
```

### 5. Projections (Event -> State)

Projections fold events into state. They must be pure functions.

```typescript
// src/lib/game/projections.ts
export function evolveState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'CHOICE_MADE':
      return {
        ...state,
        choicesMade: [...state.choicesMade, {
          choiceId: event.data.choiceId,
          option: event.data.option
        }]
      }
    case 'MORAL_ALIGNMENT_CHANGED':
      return { ...state, moralAlignment: event.data.newValue }
    default:
      return state
  }
}
```

## Adding New Content

### Adding a New Choice/Scene

1. **Define the choice ID and options** in your narrative content
2. **Add moral consequences** in `decider.ts`:

```typescript
// src/lib/game/decider.ts
function calculateMoralDelta(choiceId: string, option: string): number {
  const moralChoices: Record<string, Record<string, number>> = {
    moral_dilemma_1: { help: 25, ignore: -25 },
    moral_dilemma_2: { honest: 15, lie: -15 },
    // Add your new choice here:
    rescue_mission: { save_everyone: 30, save_some: 0, abandon: -40 }
  }
  return moralChoices[choiceId]?.[option] ?? 0
}
```

3. **Update the UI** in `+page.svelte` to show the new scene

### Adding a New Game Mechanic

Example: Adding a **reputation system**

1. **Add to state** (`types.ts`):
```typescript
export interface GameState {
  // ... existing fields
  factionReputation: Record<string, number>  // NEW
}
```

2. **Add events** (`types.ts`):
```typescript
export type GameEvent =
  // ... existing events
  | { type: 'REPUTATION_CHANGED'; data: { faction: string; delta: number; newValue: number } }
```

3. **Update initial state** (`projections.ts`):
```typescript
export function getInitialState(): GameState {
  return {
    // ... existing fields
    factionReputation: {}  // NEW
  }
}
```

4. **Handle the event** (`projections.ts`):
```typescript
case 'REPUTATION_CHANGED':
  return {
    ...state,
    factionReputation: {
      ...state.factionReputation,
      [event.data.faction]: event.data.newValue
    }
  }
```

5. **Generate events from commands** (`decider.ts`):
```typescript
// Inside MAKE_CHOICE handler, add reputation effects
const reputationEffects = getReputationEffects(command.data.choiceId, command.data.option)
for (const effect of reputationEffects) {
  const currentRep = state.factionReputation[effect.faction] ?? 0
  events.push({
    type: 'REPUTATION_CHANGED',
    data: {
      faction: effect.faction,
      delta: effect.delta,
      newValue: currentRep + effect.delta
    }
  })
}
```

6. **Add tests** (`__tests__/game.test.ts`)

### Adding New Locations

1. **Add location data** (consider creating `src/lib/content/locations.ts`):
```typescript
export const locations = {
  starting_room: {
    name: 'Docking Bay',
    description: 'Your ship rests in the ancient fortress docking bay.',
    connections: ['corridor_a', 'medical_bay']
  },
  corridor_a: {
    name: 'Main Corridor',
    description: 'A dimly lit passage stretches before you.',
    connections: ['starting_room', 'command_center']
  }
}
```

2. **Validate movement** in decider:
```typescript
case 'ENTER_LOCATION':
  const currentLoc = locations[state.currentLocation]
  if (!currentLoc.connections.includes(command.data.locationId)) {
    throw new InvalidCommandError('Cannot reach that location from here')
  }
  return [{
    type: 'LOCATION_ENTERED',
    data: {
      locationId: command.data.locationId,
      enteredAt: new Date().toISOString()
    }
  }]
```

## Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Write tests for your game logic:

```typescript
// src/lib/game/__tests__/game.test.ts
describe('Reputation System', () => {
  it('tracks faction reputation changes', () => {
    const events: GameEvent[] = [
      { type: 'GAME_STARTED', data: { playerId: '1', startedAt: '2024-01-01' } },
      { type: 'REPUTATION_CHANGED', data: { faction: 'rebels', delta: 10, newValue: 10 } }
    ]
    const state = rebuildState(events)
    expect(state.factionReputation.rebels).toBe(10)
  })
})
```

## Deployment to itch.io

1. **Build the project:**
```bash
npm run build
```

2. **Upload to itch.io:**
   - Go to [itch.io](https://itch.io) and create a new project
   - Set "Kind of project" to **HTML**
   - Upload the contents of the `build/` folder as a ZIP
   - Check "This file will be played in the browser"
   - Set viewport dimensions (recommended: 1024x768)

3. **Configure embedding:**
   - Enable "Embed in page"
   - Enable "Fullscreen button"
   - Enable "Enable scrollbars"

## Data Persistence

The game uses **sql.js** (SQLite compiled to WebAssembly) with **IndexedDB** for persistence:

- Events are stored in SQLite tables
- The entire database is serialized to IndexedDB on each write
- Data survives browser refresh but is per-browser/per-device
- For cloud saves, you'd need a backend service

## Advanced Topics

### Event Versioning (for updates/DLC)

Never change existing event structures. Add optional fields with defaults:

```typescript
// Original event
interface ItemCollected {
  type: 'ITEM_COLLECTED'
  data: { itemId: string; collectedAt: string }
}

// After DLC - add optional fields
interface ItemCollectedV2 {
  type: 'ITEM_COLLECTED'
  data: {
    itemId: string
    collectedAt: string
    dlcSource?: string      // undefined for base game items
    rarity?: 'common' | 'rare' | 'epic'  // defaults to 'common'
  }
}
```

### Snapshots (for performance)

If games get long (1000+ events), implement snapshotting:

```typescript
// Save state snapshot every 100 events
if (eventCount % 100 === 0) {
  await eventStore.saveSnapshot(streamId, state, eventCount)
}

// On load, start from snapshot instead of beginning
const snapshot = await eventStore.getLatestSnapshot(streamId)
const recentEvents = await eventStore.getEventsSince(streamId, snapshot.sequence)
const state = recentEvents.reduce(evolveState, snapshot.state)
```

### Multiple Playthroughs

Each playthrough gets a unique stream ID:

```typescript
// New game creates new stream
const playerId = `player-${Date.now()}`
// Events go to: `player-1702567890123`

// This allows multiple saves without collision
```

## Svelte UI Patterns

### Reactive State

The game store is reactive - UI updates automatically:

```svelte
<script>
  import { gameState } from '../lib/stores/gameStore'
</script>

<!-- Automatically updates when state changes -->
<p>Alignment: {$gameState.moralAlignment}</p>
```

### Dispatching Commands

```svelte
<script>
  import { gameState } from '../lib/stores/gameStore'

  async function makeChoice(option: string) {
    await gameState.handleCommand({
      type: 'MAKE_CHOICE',
      data: { choiceId: 'current_choice', option }
    })
  }
</script>

<button onclick={() => makeChoice('help')}>Help them</button>
```

### Conditional Rendering Based on State

```svelte
{#if $gameState.choicesMade.some(c => c.choiceId === 'rescued_stranger')}
  <p>The stranger you saved earlier waves at you.</p>
{/if}

{#if $gameState.moralAlignment > 50}
  <p class="good">Your reputation precedes you - people trust you.</p>
{:else if $gameState.moralAlignment < -50}
  <p class="evil">People eye you with suspicion.</p>
{/if}
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript type checking |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |

## Tech Stack

- **Svelte 5** - Reactive UI framework
- **SvelteKit** - Application framework
- **TypeScript** - Type safety
- **sql.js** - SQLite in the browser (WebAssembly)
- **IndexedDB** - Persistent storage
- **Vitest** - Unit testing

## Future: Desktop Builds

The project includes Tauri configuration for native desktop builds. When ready for Steam or standalone releases:

1. Install [Rust](https://rustup.rs/) and Tauri prerequisites
2. Swap `BrowserEventStore` back to `SQLiteEventStore`
3. Run `npm run tauri build`

## License

MIT
