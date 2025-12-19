# Session State Assessment & Research Request

**Date:** 2025-12-19
**Purpose:** Self-assessment of event sourcing patterns ahead of complex development phase
**Status:** Research complete, ready for implementation

---

## Executive Summary

This document catalogs known issues and patterns in our event sourcing implementation that have caused bugs or could cause problems as we add more complex features. We've fixed many issues, but the underlying patterns that caused them need improvement.

**Key Finding:** Most of our bugs stem from **inconsistencies between different sources of truth** - player ID module variables vs state, in-memory projections vs persisted events, content definitions vs placeholder values.

---

## Issue Categories

### 1. Critical: Double Player ID Prefix Bug

**Location:** `src/lib/stores/gameStore.ts:16, 59, 129, 178`

**Problem:**
```typescript
// Module variable already has "player-" prefix
let currentPlayerId = 'player-1'

// Then we prefix again when calling event store methods
await store.appendEvents(`player-${currentPlayerId}`, events)
// Result: stream ID becomes 'player-player-1' instead of 'player-1'
```

**Impact:**
- Events stored under wrong stream IDs
- Save/load fails to find correct event streams
- State hydration breaks after reload

**Root Cause Pattern:** **Dual source of truth** - Player identity exists both as module variable and in state object.

---

### 2. Critical: Placeholder Card Stats in Projections

**Location:** `src/lib/game/projections.ts:421-442`

**Problem:**
```typescript
case 'CARD_GAINED':
  const newCard: OwnedCard = {
    id: event.data.cardId,
    name: event.data.cardId.replace(/_/g, ' '),  // Auto-generated name
    attack: 3,  // HARDCODED PLACEHOLDER
    armor: 3,   // HARDCODED PLACEHOLDER
    agility: 3  // HARDCODED PLACEHOLDER
  }
```

**Impact:**
- All earned cards have incorrect stats (3/3/3)
- Battle calculations use wrong values
- UI displays wrong information

**Root Cause Pattern:** **Missing content lookup in projection** - Projection doesn't look up actual card data from content.

**Related Issue:** `starter_corvette` referenced in `decider.ts:327` but not defined in `content/cards.ts`.

---

### 3. High: State Initialization Race Condition

**Location:** `src/lib/stores/gameStore.ts` + `src/routes/+page.svelte`

**Problem:**
```typescript
// newGame() sets module variable and state separately
async newGame() {
  currentPlayerId = `player-${Date.now()}`    // Step 1
  gameStateStore.set(getInitialState())       // Step 2
  return { success: true }
}

// Then UI dispatches START_GAME separately
await gameState.handleCommand({
  type: 'START_GAME',
  data: { playerId: gameState.getPlayerId() }  // Step 3 - creates event
})
```

**Impact:**
- Brief window where `currentPlayerId` and `gameStateStore` are misaligned
- GAME_STARTED event created after state reset, not atomically

**Root Cause Pattern:** **Non-atomic initialization** - State and identity set in separate steps.

---

### 4. High: Command Execution Without Queuing

**Location:** `src/lib/stores/gameStore.ts:44-75`

**Problem:**
```typescript
async handleCommand(command: GameCommand) {
  const currentState = get(gameStateStore)    // Read state
  const events = decide(command, currentState) // Generate events
  await store.appendEvents(...)               // Async persist
  const newState = events.reduce(evolveState, currentState)
  gameStateStore.set(newState)                // Update UI
}
```

**Impact:**
- Two rapid commands could read same state
- No guarantee events persist before state updates
- If persistence fails, UI shows state that's not actually saved

**Root Cause Pattern:** **Missing command queue/mutex** - Concurrent commands not serialized.

---

### 5. High: Unsafe Type Casting in Slice Handlers

**Location:** `src/lib/game/decider.ts:208, 211, 214`

**Problem:**
```typescript
case 'LEAN_TOWARD_FACTION':
  return sliceHandleLeanTowardFaction(command, state as unknown as MediationState)
//                                             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                             Double unsafe cast bypasses all type checking
```

**Impact:**
- TypeScript cannot catch state field mismatches
- Runtime errors if GameState missing expected fields
- Hides synchronization bugs between main state and slice state

**Root Cause Pattern:** **Type system bypass** - Using `as unknown as` instead of proper state adapters.

---

### 6. Medium: Mutable Pending State Without Validation

**Location:** `src/lib/game/projections.ts:682-724`

**Problem:**
```typescript
case 'CHOICE_CONSEQUENCE_PRESENTED':
  return { ...state, pendingChoiceConsequence: { ... } }

case 'CHOICE_CONSEQUENCE_ACKNOWLEDGED':
  return { ...state, pendingChoiceConsequence: null }  // Clears blindly
```

**Impact:**
- No validation that pending state exists before clearing
- No validation acknowledgment matches pending item
- Could get stuck with stale pending data

**Root Cause Pattern:** **State transition without guard** - Modal state changes don't verify preconditions.

---

### 7. Medium: Unused Snapshot Mechanism

**Location:** `src/lib/eventStore/BrowserEventStore.ts:44-50`

**Problem:**
```sql
CREATE TABLE IF NOT EXISTS snapshots (...)  -- Table created
```
But never used - no `saveSnapshot()` or `loadSnapshot()` calls.

**Impact:**
- Every game load replays ALL events from beginning
- Performance degrades as event count grows
- Design doc mentions snapshotting every 50-100 events

**Root Cause Pattern:** **Incomplete implementation** - Infrastructure exists but not utilized.

---

### 8. Medium: Navigation Without State Guards

**Location:** All route files in `src/routes/*/+page.svelte`

**Problem:**
- No `beforeNavigate` hooks validate game phase before rendering
- User can manually navigate to `/battle` with no active battle
- Screens show fallback UI ("No active battle") but don't redirect

**Impact:**
- Browser history can diverge from game state
- Users can access screens in invalid state
- Reliance on graceful fallbacks instead of prevention

**Root Cause Pattern:** **Missing navigation guards** - No validation that URL matches expected game phase.

---

### 9. Medium: Bounty Statistics Tracking Gaps

**Location:** `src/lib/game/projections.ts:625-657`

**Problems:**
1. BOUNTY_MODIFIED doesn't track negative amounts in stats
2. BOUNTY_CALCULATED adds `base` to totalBountyEarned but `net` to actual bounty
3. No separate tracking for bounty lost vs shared

**Impact:**
- Game statistics are incomplete/misleading
- Cannot accurately audit bounty flow

**Root Cause Pattern:** **Inconsistent metric tracking** - Different event handlers track differently.

---

### 10. Low: Unsafe JSON Parsing

**Location:** `src/lib/eventStore/BrowserEventStore.ts:188-191`

**Problem:**
```typescript
return result[0].values.map((row) => ({
  type: row[0] as GameEvent['type'],
  data: JSON.parse(row[1] as string)  // No try-catch
}))
```

**Impact:**
- Single corrupted event makes game unloadable
- No error recovery for malformed data

**Root Cause Pattern:** **Missing error handling** - No graceful degradation for corrupted data.

---

## Historical Bug Patterns

These bugs have been **fixed** but reveal patterns to avoid:

| Bug | Root Cause Pattern | Lesson |
|-----|-------------------|--------|
| BUG-022: ActiveQuest missing factionId | Event data not fully captured in projection | **Projections must store all event data needed downstream** |
| BUG-R3-001: FLEET_COMMITTED missing cardIds | Projection didn't store command data | **Events should contain all data needed; projections should capture it** |
| Navigation: ending not triggered | Handler always went to quest_hub | **Conditional transitions need explicit checks** |
| Navigation: mediation missing BATTLE_TRIGGERED | Flag in event but no actual event | **Use events, not flags, for state transitions** |

---

## Research Findings & Implementation Patterns

Research based on DDD/CQRS literature (Greg Young, Jérémie Chassaing, Udi Dahan) and practical TypeScript implementations.

---

### 1. Session Identity Management

**Principle:** Identity belongs exclusively in the stream ID. Never store it redundantly.

**Current Bug:** Our `player-player-1` prefix duplication violates this principle.

**Pattern:**
```typescript
// ❌ Our current bug: prefix applied twice
const playerId = "player-1";
const streamId = `player-${playerId}`; // "player-player-1"

// ✅ Correct: raw ID, prefix applied once at stream construction
type PlayerId = string & { readonly _brand: 'PlayerId' };

function createPlayerId(raw: string): PlayerId {
  if (raw.startsWith('player-')) {
    throw new Error('ID should not include prefix');
  }
  return raw as PlayerId;
}

function getStreamId(playerId: PlayerId): string {
  return `player-${playerId}`;
}

function extractIdFromStream(streamId: string): PlayerId {
  return streamId.split('-').slice(1).join('-') as PlayerId;
}
```

**For browser reload persistence:**
```typescript
interface PersistedSession {
  streamId: string;
  version: number;
}

// On page load: read streamId → load events → fold to state → derive identity
const { streamId } = JSON.parse(sessionStorage.getItem('session')!);
const playerId = extractIdFromStream(streamId); // Identity derived, not stored
```

**Key Insight:** Identity flows **stream → state**, never the reverse. Remove module-level identity variables—they're redundant and cause synchronization bugs.

---

### 2. State Hydration Pattern

**Principle:** Hydration is atomic with a lock preventing command execution until complete.

**Pattern:**
```typescript
class GameSession<T> {
  private _state: T | null = null;
  private _hydrationLock: Promise<void> | null = null;
  private _version = -1;

  async hydrate(streamId: string, eventStore: EventStore): Promise<T> {
    // Reentrant lock—return existing promise if already hydrating
    if (this._hydrationLock) {
      await this._hydrationLock;
      return this._state!;
    }

    let releaseLock: () => void;
    this._hydrationLock = new Promise(r => { releaseLock = r; });

    try {
      // 1. Load all events atomically
      const events = await eventStore.readStream(streamId);

      // 2. Single fold operation
      const state = events.reduce(this.evolve, this.initialState);

      // 3. Validate completeness
      if (!this.isValidState(state)) {
        throw new Error('Hydration produced invalid state');
      }

      // 4. Atomic assignment
      this._state = state;
      this._version = events.length;

      return this._state;
    } finally {
      releaseLock!();
      this._hydrationLock = null;
    }
  }

  async execute(command: Command): Promise<void> {
    if (!this._state) {
      throw new Error('Cannot execute: aggregate not hydrated');
    }
    // Command execution proceeds only after hydration complete
  }
}
```

**Key Insight:** State reconstruction is simply `events.reduce(evolve, initialState)`—a single pure fold operation. Any setup that breaks this into separate steps introduces race conditions.

---

### 3. Command Execution Serialization

**Principle:** Use a mutex to wrap the entire decide/evolve/persist cycle.

**Pattern using async-mutex:**
```typescript
import { Mutex } from 'async-mutex';

class CommandHandler<S, C, E> {
  private mutex = new Mutex();

  async execute(command: C): Promise<E[]> {
    return this.mutex.runExclusive(async () => {
      // Transaction boundary: entire cycle is atomic
      const events = await this.eventStore.readStream(this.streamId);
      const state = events.reduce(this.evolve, this.initialState);
      const newEvents = this.decide(command, state);
      await this.eventStore.append(this.streamId, newEvents);
      return newEvents;
    });
  }
}
```

**Alternative: Command Queue** (better for rapid inputs like combat):
```typescript
class CommandQueue<C> {
  private queue: Array<{ command: C; resolve: Function; reject: Function }> = [];
  private processing = false;

  async enqueue(command: C): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { command, resolve, reject } = this.queue.shift()!;
      try {
        await this.executeAtomically(command);
        resolve();
      } catch (e) {
        reject(e);
      }
    }
    this.processing = false;
  }
}
```

**Key Insight:** Transaction boundary wraps: **read state → decide → persist → evolve**. Nothing outside this boundary should modify shared state.

---

### 4. Optimistic Updates vs Persistence

**Principle:** For single-player browser games, update UI before persistence with rollback capability.

**Pattern:**
```typescript
interface GameStore {
  confirmed: GameState;   // Last successfully persisted state
  optimistic: GameState;  // Current UI state (includes pending)
  pending: PendingEvent[];
}

function createOptimisticStore() {
  const { subscribe, update } = writable<GameStore>({
    confirmed: initialState,
    optimistic: initialState,
    pending: []
  });

  return {
    subscribe,

    async dispatch(command: Command): Promise<void> {
      const current = get({ subscribe });
      const events = decide(command, current.optimistic);
      const pendingId = crypto.randomUUID();

      // 1. Immediate UI update
      update(s => ({
        ...s,
        optimistic: events.reduce(evolve, s.optimistic),
        pending: [...s.pending, { id: pendingId, events }]
      }));

      try {
        // 2. Persist asynchronously
        await persistToIndexedDB(events);

        // 3. Move to confirmed
        update(s => ({
          confirmed: events.reduce(evolve, s.confirmed),
          optimistic: s.optimistic,
          pending: s.pending.filter(p => p.id !== pendingId)
        }));
      } catch (error) {
        // 4. Rollback on failure
        update(s => {
          const remaining = s.pending.filter(p => p.id !== pendingId);
          const newOptimistic = remaining.reduce(
            (state, p) => p.events.reduce(evolve, state),
            s.confirmed
          );
          return { ...s, optimistic: newOptimistic, pending: remaining };
        });
      }
    }
  };
}
```

**For rapid actions (combat), batch updates:**
```typescript
class BatchedPersistence {
  private pending: DomainEvent[] = [];
  private timeout: number | null = null;
  private readonly BATCH_DELAY = 100;

  queue(event: DomainEvent): void {
    this.pending.push(event);
    if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.BATCH_DELAY);
    }
  }
}
```

---

### 5. Content Lookup in Projections

**Principle:** For fixed card definitions (our case), use **fat events** containing all data.

**Our Choice: Fat Events**
```typescript
// Fat event: self-contained, works offline, simpler projections
interface CardGainedEvent {
  type: 'CARD_GAINED';
  data: {
    cardId: string;
    // Include card stats at time of acquisition
    name: string;
    attack: number;
    armor: number;
    agility: number;
    factionId: FactionId;
    source: CardSource;
  };
}
```

**Alternative (if we add balance patches later): Thin events with projection lookup**
```typescript
// Projection looks up current definition
function projectInventory(events: Event[], cardRegistry: CardRegistry): Inventory {
  return events.reduce((inv, event) => {
    if (event.type === 'CARD_GAINED') {
      const card = cardRegistry.get(event.data.cardId);
      if (!card) throw new Error(`Unknown card: ${event.data.cardId}`);
      return { ...inv, cards: [...inv.cards, card] };
    }
    return inv;
  }, { cards: [] });
}
```

**Hybrid approach for future-proofing:**
```typescript
interface CardGainedEvent {
  type: 'CARD_GAINED';
  version: 2;
  data: {
    cardId: string;  // Always included (immutable ID)
    snapshotStats: { attack: number; armor: number; agility: number }; // Point-in-time
  };
}
```

**Key Insight:** Immutable IDs are always safe to include redundantly. For single-player games with fixed content, fat events are simpler.

---

### 6. Snapshot Strategy

**Principle:** Snapshot every 50-100 events with schema version for invalidation.

**Pattern:**
```typescript
class SnapshotManager {
  private readonly SNAPSHOT_THRESHOLD = 50;
  private readonly SCHEMA_VERSION = 1;

  async loadState(streamId: string): Promise<GameState> {
    const db = await this.getDb();

    // Try snapshot first
    const snapshot = await db.get('snapshots', streamId);

    // Validate snapshot schema version
    if (snapshot?.schemaVersion !== this.SCHEMA_VERSION) {
      // Invalidate outdated snapshot
      await db.delete('snapshots', streamId);
      return this.replayFromScratch(streamId);
    }

    const startVersion = snapshot?.version ?? 0;
    const events = await this.getEventsFrom(streamId, startVersion);

    let state = snapshot?.state ?? initialState;
    state = events.reduce(evolve, state);

    // Create new snapshot if threshold exceeded
    if (events.length > this.SNAPSHOT_THRESHOLD) {
      await this.saveSnapshot(streamId, state, startVersion + events.length);
    }

    return state;
  }

  private async saveSnapshot(
    streamId: string,
    state: GameState,
    version: number
  ): Promise<void> {
    await this.db.put('snapshots', {
      id: streamId,
      state,
      version,
      schemaVersion: this.SCHEMA_VERSION,
      timestamp: Date.now()
    });
  }
}
```

**Verification for development:**
```typescript
async function verifySnapshot(streamId: string): Promise<boolean> {
  const snapshotState = await loadWithSnapshot(streamId);
  const replayState = await replayAllEvents(streamId);
  return deepEqual(snapshotState, replayState);
}
```

**Key Insight:** Increment `SCHEMA_VERSION` when state shape changes. Clear snapshots on version mismatch.

---

### 7. Navigation with Event-Sourced State

**Principle:** Game state is single source of truth; URL follows state, not reverse.

**Pattern:**
```typescript
// Derive canonical URL from event-sourced state
function phaseToUrl(state: GameState): string {
  switch (state.currentPhase) {
    case 'not_started': return '/';
    case 'quest_hub': return '/quest-hub';
    case 'narrative': return '/narrative';
    case 'battle': return `/battle`;
    // ... etc
  }
}

// Derived store syncs URL automatically
export const canonicalUrl = derived(gameState, $s => phaseToUrl($s));
```

**SvelteKit navigation guards:**
```svelte
<!-- routes/+layout.svelte -->
<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import { gameState } from '$lib/stores';
  import { get } from 'svelte/store';

  beforeNavigate((navigation) => {
    const state = get(gameState);
    const target = navigation.to?.url.pathname;

    // Guard: cannot enter /battle without active battle
    if (target?.startsWith('/battle') && state.currentPhase !== 'battle') {
      navigation.cancel();
      goto(phaseToUrl(state));
      return;
    }

    // Guard: cannot leave battle manually
    if (state.currentPhase === 'battle' && !target?.startsWith('/battle')) {
      navigation.cancel();
      return;
    }
  });

  // Sync URL when state changes
  $effect(() => {
    const expected = phaseToUrl($gameState);
    if ($page.url.pathname !== expected) {
      goto(expected, { replaceState: true });
    }
  });
</script>
```

**Handle browser back/forward:**
```typescript
beforeNavigate((nav) => {
  if (nav.type === 'popstate') {
    const state = get(gameState);
    if (state.currentPhase === 'battle') {
      nav.cancel(); // Cannot navigate away during battle
    }
  }
});
```

---

### 8. Slice State Adapters

**Principle:** Use discriminated unions with the `phase` field as discriminant. Eliminate all `as unknown as` casts.

**Pattern:**
```typescript
interface MenuState {
  currentPhase: 'not_started';
  playerId: string | null;
}

interface BattleState {
  currentPhase: 'battle';
  playerId: string;
  currentBattle: {
    battleId: string;
    playerFleet: OwnedCard[];
    opponentFleet: Card[];
    phase: BattlePhase;
  };
}

interface NarrativeState {
  currentPhase: 'narrative';
  playerId: string;
  activeQuest: ActiveQuest;
  currentDilemma: Dilemma;
}

type GameState = MenuState | BattleState | NarrativeState | /* ... */;
```

**Type-safe extraction with result types:**
```typescript
type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function extractBattleState(state: GameState): AdapterResult<BattleState['currentBattle']> {
  if (state.currentPhase !== 'battle') {
    return { ok: false, error: `Expected battle phase, got ${state.currentPhase}` };
  }
  // TypeScript narrows to BattleState here—no cast needed
  return { ok: true, data: state.currentBattle };
}

// Usage forces handling both cases
const result = extractBattleState(gameState);
if (result.ok) {
  renderBattle(result.data);
} else {
  redirectToMap();
}
```

**Derived Svelte stores for slices:**
```typescript
export const battleState = derived(gameState, ($s) =>
  $s.currentPhase === 'battle' ? $s.currentBattle : null
);

export const narrativeState = derived(gameState, ($s) =>
  $s.currentPhase === 'narrative' ? { quest: $s.activeQuest, dilemma: $s.currentDilemma } : null
);
```

**Runtime validation with Zod:**
```typescript
const GameStateSchema = z.discriminatedUnion('currentPhase', [
  z.object({ currentPhase: z.literal('not_started'), playerId: z.string().nullable() }),
  z.object({ currentPhase: z.literal('battle'), playerId: z.string(), currentBattle: BattleSchema }),
  z.object({ currentPhase: z.literal('narrative'), playerId: z.string(), activeQuest: QuestSchema })
]);

function loadFromStorage(): GameState | null {
  const raw = localStorage.getItem('state');
  const result = GameStateSchema.safeParse(JSON.parse(raw ?? '{}'));
  return result.success ? result.data : null;
}
```

---

## Implementation Priority (Updated)

Based on research, here are the most impactful fixes in order:

### Priority 1: Critical Path Fixes

| Order | Issue | Pattern | Effort |
|-------|-------|---------|--------|
| 1 | Remove module-level identity | Derive identity from stream ID exclusively | Medium |
| 2 | Add command mutex | Wrap decide/evolve/persist cycle | Small |
| 3 | Use discriminated unions | Eliminate all `as unknown as` casts | Large |
| 4 | Fix CARD_GAINED to use fat events | Include card stats in event data | Small |

### Priority 2: Robustness Fixes

| Order | Issue | Pattern | Effort |
|-------|-------|---------|--------|
| 5 | Activate snapshots | Threshold at 50 events, schema versioning | Medium |
| 6 | Add navigation guards | beforeNavigate + URL sync | Medium |
| 7 | Add optimistic updates with rollback | confirmed/optimistic state separation | Medium |

### Priority 3: Code Quality

| Order | Issue | Pattern | Effort |
|-------|-------|---------|--------|
| 8 | Add try-catch to JSON parsing | Graceful degradation for corrupted data | Small |
| 9 | Fix bounty statistics tracking | Consistent metric handling | Small |
| 10 | Add pending state validation | Guards before clearing modal state | Small |

---

## Recommended Immediate Fixes

**Before adding new features, implement these patterns:**

### Fix 1: Remove Module-Level Identity (Priority 1)
```typescript
// Remove this from gameStore.ts
let currentPlayerId = 'player-1'  // ❌ DELETE

// Replace with stream ID as single source of truth
// Identity derived from stream, never stored separately
```

### Fix 2: Add Command Mutex (Priority 1)
```bash
npm install async-mutex
```
```typescript
// Add to gameStore.ts
import { Mutex } from 'async-mutex';

const commandMutex = new Mutex();

async handleCommand(command: GameCommand) {
  return commandMutex.runExclusive(async () => {
    // Existing logic now serialized
  });
}
```

### Fix 3: Fat Events for CARD_GAINED (Priority 1)
```typescript
// In decider.ts, when generating CARD_GAINED
const card = getCardById(cardId);
events.push({
  type: 'CARD_GAINED',
  data: {
    cardId,
    name: card.name,
    attack: card.attack,
    armor: card.armor,
    agility: card.agility,
    factionId: card.factionId,
    source: 'quest'
  }
});

// In projections.ts, use event data directly (no placeholder)
case 'CARD_GAINED':
  const newCard: OwnedCard = {
    id: event.data.cardId,
    name: event.data.name,      // From event
    attack: event.data.attack,  // From event
    armor: event.data.armor,    // From event
    agility: event.data.agility // From event
  };
```

### Fix 4: Add try-catch to Event Store (Priority 3)
```typescript
// In BrowserEventStore.ts getEvents()
return result[0].values.map((row) => {
  try {
    return {
      type: row[0] as GameEvent['type'],
      data: JSON.parse(row[1] as string)
    };
  } catch (e) {
    console.error('Corrupted event:', row);
    return null;
  }
}).filter(Boolean) as GameEvent[];
```

---

## Files Summary

| Category | Key Files |
|----------|-----------|
| Game Store | `src/lib/stores/gameStore.ts` |
| Event Store | `src/lib/eventStore/BrowserEventStore.ts` |
| Projections | `src/lib/game/projections.ts` |
| Decider | `src/lib/game/decider.ts` |
| Content | `src/lib/game/content/cards.ts` |
| Navigation | `src/lib/navigation/router.ts` |
| Bug History | `docs/BUGS.md` |
| Navigation Fixes | `docs/testing/NAVIGATION-REMEDIATION-PLAN.md` |

---

## Next Steps

1. ~~**Research:** Get answers to the 8 research topics above~~ ✅ Complete
2. ~~**Prioritize:** Determine which patterns to fix before adding features~~ ✅ See Implementation Priority above
3. **Implement:** Apply patterns systematically across codebase
   - Start with Priority 1 fixes (identity, mutex, fat events)
   - Add tests as each pattern is implemented
4. **Test:** Add tests for state consistency edge cases
   - Command serialization tests (rapid commands)
   - Hydration consistency tests (reload scenarios)
   - Snapshot verification tests

---

## Appendix: Test Files for Reference

These tests document expected behavior and edge cases:

- `src/lib/game/__tests__/projections.test.ts` - State projection tests
- `src/lib/game/__tests__/gameplay-simulation.test.ts` - Full game flow
- `src/lib/game/__tests__/player-journeys.test.ts` - Navigation sequences
- `tests/e2e/url-edge-cases.spec.ts` - URL navigation edge cases
- `tests/e2e/card-economy-edge-cases.spec.ts` - Value tracking tests
- `tests/e2e/player-journey-stuck-states.spec.ts` - Stuck state prevention
