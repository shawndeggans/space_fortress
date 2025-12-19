# Session State Assessment & Research Request

**Date:** 2025-12-19
**Purpose:** Self-assessment of event sourcing patterns ahead of complex development phase
**Status:** Assessment complete, research needed

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

## Research Topics Needed

The following patterns need clarification from Event Modeling best practices:

### 1. Session Identity Management

**Question:** How should we manage player identity in event-sourced systems?

**Current Problem:**
- Player ID exists as module variable AND in state
- Stream ID construction duplicates prefix
- No single source of truth

**What We Need:**
- Pattern for managing player/session identity
- How identity relates to event stream IDs
- How to handle identity across page reloads

---

### 2. State Hydration Pattern

**Question:** What's the correct pattern for loading game state from events?

**Current Problem:**
- Initialize state with `getInitialState()`
- Then replay events with `events.reduce(evolveState, initialState)`
- But also set module variables separately
- Race conditions during initialization

**What We Need:**
- Atomic initialization pattern
- How to sync identity with event streams
- How to verify state matches event history

---

### 3. Command Execution Serialization

**Question:** How should commands be serialized to prevent race conditions?

**Current Problem:**
- Commands execute asynchronously without queuing
- Two rapid commands could read same state
- No transaction boundary around command → events → state update

**What We Need:**
- Command queue or mutex pattern
- Transaction boundaries for event sourcing
- How to handle concurrent UI interactions

---

### 4. Optimistic Updates vs Persistence

**Question:** Should UI update before or after persistence succeeds?

**Current Problem:**
- We update UI immediately after generating events
- Persistence happens async in background
- If persistence fails, UI shows state that's not saved

**What We Need:**
- Pattern for optimistic UI updates with event sourcing
- Rollback strategy if persistence fails
- How to show pending vs confirmed state

---

### 5. Content Lookup in Projections

**Question:** Should projections look up content data, or should events contain all needed data?

**Current Problem:**
- CARD_GAINED event contains only `cardId`
- Projection creates placeholder card with wrong stats
- Should projection call `getCardById()` or should event include stats?

**What We Need:**
- Pattern for content/reference data in events
- Trade-offs: event size vs projection complexity
- How to handle content changes after events stored

---

### 6. Snapshot Strategy

**Question:** When and how should we snapshot state?

**Current Problem:**
- Snapshot infrastructure exists but unused
- Every load replays all events
- No guidance on snapshot frequency

**What We Need:**
- When to create snapshots (every N events? after each session?)
- How to verify snapshot matches event replay
- How to handle snapshots when event schema changes

---

### 7. Navigation with Event-Sourced State

**Question:** How should navigation integrate with game phase from events?

**Current Problem:**
- URL can diverge from game phase
- No guards prevent invalid navigation
- Browser history doesn't match game state

**What We Need:**
- Pattern for URL ↔ phase synchronization
- Navigation guards for event-sourced state
- How to handle browser back/forward buttons

---

### 8. Slice State Adapters

**Question:** How should main state map to slice-specific state?

**Current Problem:**
- Using `as unknown as SliceState` bypasses type safety
- No validation that main state has required fields
- Silent failures if fields missing

**What We Need:**
- Pattern for state adapter functions
- Type-safe extraction of slice state from main state
- Validation at state boundaries

---

## Recommended Immediate Fixes

**Before adding new features, fix these:**

1. **Fix player ID prefix duplication** - Single source of truth for identity
2. **Fix card stat lookup** - Add `getCardById()` call in CARD_GAINED handler
3. **Add command queue** - Serialize command execution
4. **Add try-catch to JSON parsing** - Graceful handling of corrupted data

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

1. **Research:** Get answers to the 8 research topics above
2. **Prioritize:** Determine which patterns to fix before adding features
3. **Implement:** Apply patterns systematically across codebase
4. **Test:** Add tests for state consistency edge cases

---

## Appendix: Test Files for Reference

These tests document expected behavior and edge cases:

- `src/lib/game/__tests__/projections.test.ts` - State projection tests
- `src/lib/game/__tests__/gameplay-simulation.test.ts` - Full game flow
- `src/lib/game/__tests__/player-journeys.test.ts` - Navigation sequences
- `tests/e2e/url-edge-cases.spec.ts` - URL navigation edge cases
- `tests/e2e/card-economy-edge-cases.spec.ts` - Value tracking tests
- `tests/e2e/player-journey-stuck-states.spec.ts` - Stuck state prevention
