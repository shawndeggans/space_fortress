# Space Fortress: Vertical Slice Architecture

This directory contains documentation for the vertical slices that make up Space Fortress.

## What is a Vertical Slice?

A vertical slice is the smallest work unit that delivers complete functionality from UI to persistence. Each slice:

- **Is independent**: Requires no coordination with other slices
- **Is complete**: Contains everything needed for that feature to work
- **Communicates via events**: Slices only interact through the event stream
- **Owns its read model**: Each slice builds its own projection from events

## Slice Identification

Slices are identified using the four event modeling patterns:

### 1. Command Pattern (UI → Command → Events)
User action triggers a command that generates events.
```
[Wireframe] → [Command] → {Event(s)}
```

### 2. View Pattern (Events → View → UI)
Events are projected into a read model that displays in the UI.
```
{Event(s)} → <Read Model> → [Wireframe]
```

### 3. Automation Pattern (Events → Logic → Events)
Events trigger automated logic that generates new events.
```
{Event(s)} → [Processor] → {Event(s)}
```

### 4. Translation Pattern (Cross-system)
Events from one system trigger commands in another.

## Space Fortress Slices

| # | Slice | Pattern | Size (Specs) |
|---|-------|---------|--------------|
| 1 | [Accept Quest](./SLICE-01-ACCEPT-QUEST.md) | Command | 3 |
| 2 | [Make Choice](./SLICE-02-MAKE-CHOICE.md) | Command | 4 |
| 3 | [Form Alliance](./SLICE-03-FORM-ALLIANCE.md) | Command | 4 |
| 4 | [Card Selection](./SLICE-04-CARD-SELECTION.md) | Command | 4 |
| 5 | [Deployment](./SLICE-05-DEPLOYMENT.md) | Command | 3 |
| 6 | [Battle Resolution](./SLICE-06-BATTLE-RESOLUTION.md) | Automation | 4 |
| 7 | [Mediation](./SLICE-07-MEDIATION.md) | Command | 3 |
| 8 | [Consequence](./SLICE-08-CONSEQUENCE.md) | Command | 2 |

## Sizing Guideline

Each slice should have **3-4 Given-When-Then specifications**:
- **3-4 specs**: Right size (~10 hours of work)
- **Fewer than 3**: Too small—absorb into adjacent slice
- **More than 4-5**: Too large—split into multiple slices

## Event Flow Between Slices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAME FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐             │
│   │ Accept Quest │ ───> │ Make Choice  │ ───> │Form Alliance │             │
│   │              │      │              │      │              │             │
│   │ QUEST_       │      │ CHOICE_MADE  │      │ ALLIANCE_    │             │
│   │ ACCEPTED     │      │ REPUTATION_  │      │ FORMED       │             │
│   │              │      │ CHANGED      │      │ CARD_GAINED  │             │
│   └──────────────┘      └──────────────┘      └──────────────┘             │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │             ┌──────────────┐               │
│          │                     │             │Card Selection│               │
│          │                     │             │              │               │
│          │                     │             │ CARD_        │               │
│          │                     │             │ SELECTED     │               │
│          │                     │             │ FLEET_       │               │
│          │                     │             │ COMMITTED    │               │
│          │                     │             └──────────────┘               │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │             ┌──────────────┐               │
│          │                     │             │  Deployment  │               │
│          │                     │             │              │               │
│          │                     │             │ ORDERS_      │               │
│          │                     │             │ LOCKED       │               │
│          │                     │             └──────────────┘               │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │             ┌──────────────┐               │
│          │                     │             │   Battle     │               │
│          │                     │             │ Resolution   │               │
│          │                     │             │              │               │
│          │                     │             │ BATTLE_      │               │
│          │                     │             │ RESOLVED     │               │
│          │                     │             └──────────────┘               │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │             ┌──────────────┐               │
│          │                     └──────────── │ Consequence  │               │
│          │                                   │              │               │
│          └─────────────────────────────────> │ Phase back   │               │
│                                              │ to quest_hub │               │
│                                              └──────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Principle: Each Slice Owns Its Read Model

**Anti-pattern (shared read model):**
```typescript
// playerState.ts - used by ALL screens
export function projectPlayerState(events): PlayerStateView
```

**Correct (slice-owned read model):**
```typescript
// accept-quest/read-model.ts - used by quest hub ONLY
export function projectQuestAcceptanceView(events): QuestAcceptanceView

// form-alliance/read-model.ts - used by alliance screen ONLY
export function projectAllianceView(events): AllianceView
```

Even if multiple slices need reputation data, they each compute it independently from events. This eliminates coupling and allows each slice to evolve independently.

## Shared Kernel (Minimal)

The only truly shared elements are:

- `FactionId` type
- `GamePhase` type
- Event schemas (type definitions only)
- Event bus interface

Everything else should be slice-owned.

## Current Implementation Status

See [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) for tracking.

## Related Documentation

- [GAME-RULES.md](../GAME-RULES.md) - Business rules in Given-When-Then format
- [EVENT-CATALOG.md](../events/EVENT-CATALOG.md) - Complete event reference
- [CORE-LOOP-EVENT-MODEL.md](../events/CORE-LOOP-EVENT-MODEL.md) - Visual event flows
- [SCREENS.md](../screens/SCREENS.md) - UI wireframes
