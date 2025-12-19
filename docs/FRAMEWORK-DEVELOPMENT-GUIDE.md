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
│   │   ├── types.ts           # Core type definitions (Card, Quest, Faction, etc.)
│   │   ├── events.ts          # Event type definitions (51 event types)
│   │   ├── commands.ts        # Command type definitions
│   │   ├── decider.ts         # Command -> Event logic (game rules)
│   │   ├── projections.ts     # Event -> State reconstruction (evolveState)
│   │   ├── combat.ts          # Battle resolution engine (d20 system)
│   │   ├── opponents.ts       # Enemy fleet generation
│   │   ├── content/           # Game data (cards, quests, factions)
│   │   ├── projections/       # Screen-specific read models
│   │   └── __tests__/         # Unit tests (469+ tests)
│   ├── slices/                # Vertical slice handlers
│   │   ├── accept-quest/
│   │   ├── make-choice/
│   │   ├── card-selection/
│   │   ├── deployment/
│   │   ├── battle-resolution/
│   │   ├── form-alliance/
│   │   ├── mediation/
│   │   └── consequence/
│   ├── narrative/             # Quest/dilemma content system
│   │   ├── graph.ts           # Narrative graph structure
│   │   └── condition-resolver.ts
│   ├── navigation/
│   │   └── router.ts          # Phase-to-route mapping with guards
│   ├── eventStore/
│   │   └── BrowserEventStore.ts  # SQLite + snapshots + IndexedDB
│   ├── stores/
│   │   └── gameStore.ts       # Svelte store with command mutex
│   └── components/            # Reusable UI components
├── routes/
│   ├── +layout.svelte         # Navigation guards, header
│   ├── quest-hub/
│   ├── narrative/
│   ├── card-pool/
│   ├── deployment/
│   ├── battle/
│   └── ...                    # 12 game screens
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

### Command Serialization (Preventing Race Conditions)

Commands are serialized using a mutex to prevent race conditions when multiple UI actions fire rapidly:

```typescript
// src/lib/stores/gameStore.ts
import { Mutex } from 'async-mutex'

const commandMutex = new Mutex()

async handleCommand(command: GameCommand) {
  // All commands are serialized through the mutex
  return commandMutex.runExclusive(async () => {
    const events = decide(command, currentState)
    await eventStore.appendEvents(streamId, events)
    // Update state...
  })
}
```

This prevents issues like double-clicking causing duplicate events or interleaved state updates.

### Fat Events (Self-Contained Data)

Events should contain all data needed for state reconstruction without requiring lookups:

```typescript
// WRONG - Thin event requires card lookup during replay
{ type: 'CARD_GAINED', data: { cardId: 'ironveil_destroyer' } }

// CORRECT - Fat event is self-contained
{
  type: 'CARD_GAINED',
  data: {
    cardId: 'ironveil_destroyer',
    factionId: 'ironveil',
    name: 'Ironveil Destroyer',
    attack: 5,
    armor: 4,
    agility: 2,
    source: 'quest'
  }
}
```

**Why fat events matter:**
- Events replay deterministically even if card database changes
- No dependency on external data during state reconstruction
- Easier debugging - events show exactly what happened

### Graceful Degradation

The event store handles corrupted data gracefully instead of crashing:

```typescript
// src/lib/eventStore/BrowserEventStore.ts
async getEvents(streamId: string): Promise<GameEvent[]> {
  const events: GameEvent[] = []
  for (const row of result[0].values) {
    try {
      const event = {
        type: row[0],
        data: JSON.parse(row[1] as string)
      } as GameEvent
      events.push(event)
    } catch (error) {
      // Log but continue - don't fail the entire load
      console.error('Failed to parse event, skipping:', error)
    }
  }
  return events
}
```

### Pending State Validation

Before clearing pending state (like `pendingChoiceConsequence`), validate it matches expectations:

```typescript
case 'CHOICE_CONSEQUENCE_ACKNOWLEDGED':
  // Validate before clearing
  if (!state.pendingChoiceConsequence) {
    console.warn('No pending consequence to acknowledge')
    return state
  }
  if (state.pendingChoiceConsequence.choiceId !== event.data.choiceId) {
    console.warn('Mismatch between pending and acknowledged choice')
  }
  return { ...state, pendingChoiceConsequence: null }
```

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

### Snapshots (Automatic Performance Optimization)

The event store automatically creates snapshots after 50 events to speed up state reconstruction:

```typescript
// src/lib/eventStore/BrowserEventStore.ts
const SCHEMA_VERSION = 1    // Increment when GameState shape changes
const SNAPSHOT_THRESHOLD = 50

async loadStateWithSnapshot(
  streamId: string,
  evolve: (state: GameState, event: GameEvent) => GameState,
  initialState: GameState
): Promise<GameState> {
  // 1. Try to load existing snapshot
  const snapshot = await this.loadSnapshot(streamId)

  let state = snapshot?.state ?? initialState
  let startSequence = snapshot?.sequence ?? 0

  // 2. Replay only events after the snapshot
  const recentEvents = await this.getEventsSince(streamId, startSequence)
  state = recentEvents.reduce(evolve, state)

  // 3. Save new snapshot if we've replayed enough events
  const totalEvents = await this.getEventCount(streamId)
  if (totalEvents - startSequence >= SNAPSHOT_THRESHOLD) {
    await this.saveSnapshot(streamId, state, totalEvents)
  }

  return state
}
```

**Schema versioning:** When `GameState` shape changes, increment `SCHEMA_VERSION`. Old snapshots with mismatched versions are automatically invalidated and rebuilt from events.

### Stream IDs and Player Identity

Player IDs and stream IDs are kept separate to prevent double-prefixing bugs:

```typescript
// src/lib/stores/gameStore.ts

// Store the raw player ID (e.g., "abc123")
let currentPlayerId: string | null = null

// Helper function constructs stream ID when needed
function getStreamId(): string {
  if (!currentPlayerId) throw new Error('No player ID set')
  return `player-${currentPlayerId}`  // Returns "player-abc123"
}

// Usage in command handling
await eventStore.appendEvents(getStreamId(), events)
```

**Why this matters:** Previously, the code stored `player-abc123` and then called `player-${playerId}`, resulting in `player-player-abc123`.

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

### Navigation Guards

The app uses navigation guards to keep URLs in sync with game phase and prevent invalid navigation:

```typescript
// src/lib/navigation/router.ts
export const PHASE_ROUTES: Record<GamePhase, string | null> = {
  not_started: '/',
  quest_hub: '/quest-hub',
  narrative: '/narrative',
  choice_consequence: '/choice-consequence',
  alliance: '/alliance',
  mediation: '/mediation',
  card_selection: '/card-pool',
  deployment: '/deployment',
  battle: '/battle',
  consequence: '/consequence',
  post_battle_dilemma: '/narrative',  // Reuses narrative screen
  quest_summary: '/quest-summary',
  ending: '/ending'
}

export function isRouteValidForPhase(route: string, currentPhase: GamePhase): boolean {
  const validPhases = ROUTE_PHASES[route]
  return validPhases?.includes(currentPhase) ?? false
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { beforeNavigate } from '$app/navigation'
  import { isRouteValidForPhase, getRouteForPhase } from '$lib/navigation/router'

  // Prevent navigation to invalid routes
  beforeNavigate((navigation) => {
    if (!isRouteValidForPhase(navigation.to.url.pathname, $gameState.currentPhase)) {
      navigation.cancel()
      goto(getRouteForPhase($gameState.currentPhase), { replaceState: true })
    }
  })

  // Auto-navigate when phase changes
  $effect(() => {
    const expectedRoute = getRouteForPhase($gameState.currentPhase)
    if (expectedRoute && $page.url.pathname !== expectedRoute) {
      goto(expectedRoute, { replaceState: true })
    }
  })
</script>
```

**Why navigation guards matter:**
- Prevents 404 errors from bookmark/refresh on invalid routes
- Keeps URL as single source of truth for "where am I"
- Auto-redirects to correct screen when game phase changes

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

- **Svelte 5** - Reactive UI framework with runes
- **SvelteKit** - Application framework with file-based routing
- **TypeScript** - Type safety with discriminated unions
- **sql.js** - SQLite in the browser (WebAssembly)
- **IndexedDB** - Persistent storage for SQLite database
- **async-mutex** - Command serialization to prevent race conditions
- **Vitest** - Unit testing (469+ tests)

## Future: Desktop Builds

The project includes Tauri configuration for native desktop builds. When ready for Steam or standalone releases:

1. Install [Rust](https://rustup.rs/) and Tauri prerequisites
2. Swap `BrowserEventStore` back to `SQLiteEventStore`
3. Run `npm run tauri build`

## License

MIT
