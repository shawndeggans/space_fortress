# Navigation Remediation Plan

This document outlines the fixes needed for navigation sequences that don't complete as expected, identified by the player journey tests.

## Summary of Issues

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| Game ending not triggered after 3 quests | `quest-summary/command.ts` | Critical | Open |
| Mediation collapse missing BATTLE_TRIGGERED event | `mediation/command.ts` | High | Open |
| LOCK_ORDERS requires positions in command data | Test setup issue | Medium | Test fix needed |
| Quest summary requires activeQuest | Test setup + potential UX issue | Medium | Open |

---

## Issue 1: Game Ending Not Triggered After 3 Quests

### Problem
When player completes their 3rd quest and acknowledges the quest summary, they return to `quest_hub` instead of transitioning to `ending`.

### Root Cause
`src/lib/slices/quest-summary/command.ts:108-116` always emits `PHASE_CHANGED` to `quest_hub`:

```typescript
// Current code - always goes to quest_hub
events.push({
  type: 'PHASE_CHANGED',
  data: {
    timestamp: ts,
    fromPhase: 'quest_summary',
    toPhase: 'quest_hub'  // <-- Always quest_hub, never checks for ending
  }
})
```

### Expected Behavior
After completing the 3rd quest (all quests done), phase should transition to `ending` instead of `quest_hub`.

### Fix Location
`src/lib/slices/quest-summary/command.ts`

### Proposed Fix

1. **Expand QuestSummaryState** to include completed quest count:
```typescript
export interface QuestSummaryState {
  currentPhase: GamePhase
  activeQuest: {
    questId: string
    factionId: FactionId
  } | null
  bounty: number
  completedQuestsCount: number  // NEW: Track how many quests are completed
  totalQuests: number           // NEW: Total quests in game (3)
}
```

2. **Update handler** to check completion status:
```typescript
export function handleAcknowledgeQuestSummary(
  command: AcknowledgeQuestSummaryCommand,
  state: QuestSummaryState
): GameEvent[] {
  // ... existing validation ...

  // Emit quest completed event
  events.push({
    type: 'QUEST_COMPLETED',
    data: { /* ... */ }
  })

  // Determine next phase based on completion
  const questsAfterThis = state.completedQuestsCount + 1
  const isGameComplete = questsAfterThis >= state.totalQuests

  if (isGameComplete) {
    // Game complete - go to ending
    events.push({
      type: 'GAME_ENDED',
      data: {
        timestamp: ts,
        totalQuests: state.totalQuests,
        finalBounty: state.bounty
      }
    })
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'quest_summary',
        toPhase: 'ending'
      }
    })
  } else {
    // More quests available - return to quest hub
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'quest_summary',
        toPhase: 'quest_hub'
      }
    })
  }

  return events
}
```

3. **Update decider** to pass completedQuestsCount to handler:
```typescript
// In decider.ts, toQuestSummaryState function
function toQuestSummaryState(state: GameState): QuestSummaryState {
  return {
    currentPhase: state.currentPhase,
    activeQuest: state.activeQuest ? {
      questId: state.activeQuest.questId,
      factionId: state.activeQuest.factionId
    } : null,
    bounty: state.bounty,
    completedQuestsCount: state.completedQuests.length,
    totalQuests: 3  // Or from config
  }
}
```

### Files to Modify
- `src/lib/slices/quest-summary/command.ts` - Add completion check
- `src/lib/game/decider.ts` - Update state mapping
- `src/lib/game/events.ts` - Add GAME_ENDED event if not exists

### Test Verification
After fix, this test should pass:
```typescript
it('ending triggered exactly when 3 quests completed', () => {
  // ... setup state with 2 completed quests ...
  const { state: afterThird } = executeCommand(
    { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
    state3Complete
  )
  expect(afterThird.completedQuests.length).toBe(3)
  expect(afterThird.currentPhase).toBe('ending')  // Should now pass
})
```

---

## Issue 2: Mediation Collapse Missing BATTLE_TRIGGERED Event

### Problem
When player refuses to lean in mediation (`REFUSE_TO_LEAN`), the handler emits `MEDIATION_COLLAPSED` but not `BATTLE_TRIGGERED`. The test expects both events.

### Root Cause
`src/lib/slices/mediation/command.ts:151-168`:

```typescript
// Current code
return [
  {
    type: 'MEDIATION_COLLAPSED',
    data: {
      timestamp: ts,
      reason: 'Player refused to lean toward either party',
      battleTriggered: true  // Flag exists but no actual BATTLE_TRIGGERED event
    }
  },
  {
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'mediation',
      toPhase: 'card_selection'
    }
  }
]
```

### Expected Behavior
When mediation collapses and battle is triggered:
1. Emit `MEDIATION_COLLAPSED` event
2. Emit `BATTLE_TRIGGERED` event (for consistency with other battle triggers)
3. Emit `PHASE_CHANGED` to `card_selection`

### Fix Location
`src/lib/slices/mediation/command.ts`

### Proposed Fix

```typescript
export function handleRefuseToLean(
  command: RefuseToLeanCommand,
  state: MediationState
): GameEvent[] {
  if (state.currentPhase !== 'mediation') {
    throw new MediationError('Not in mediation phase')
  }

  const ts = timestamp()
  const battleId = `battle_mediation_collapse_${Date.now()}`

  return [
    {
      type: 'MEDIATION_COLLAPSED',
      data: {
        timestamp: ts,
        reason: 'Player refused to lean toward either party',
        battleTriggered: true
      }
    },
    // NEW: Emit actual BATTLE_TRIGGERED event
    {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: ts,
        battleId: battleId,
        trigger: 'mediation_collapse',
        context: 'Mediation collapsed - factions refuse to negotiate',
        opponentType: 'hostile_factions',
        difficulty: 'medium'
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'mediation',
        toPhase: 'card_selection'
      }
    }
  ]
}
```

### Files to Modify
- `src/lib/slices/mediation/command.ts` - Add BATTLE_TRIGGERED event

### Test Verification
```typescript
it('mediation collapse triggers battle', () => {
  const { state: afterRefuse, events } = executeCommand(
    { type: 'REFUSE_TO_LEAN', data: {} },
    state
  )
  expect(afterRefuse.currentPhase).toBe('card_selection')
  expect(events.some(e => e.type === 'MEDIATION_COLLAPSED')).toBe(true)
  expect(events.some(e => e.type === 'BATTLE_TRIGGERED')).toBe(true)  // Should now pass
})
```

---

## Issue 3: Quest Summary Requires Active Quest

### Problem
`ACKNOWLEDGE_QUEST_SUMMARY` throws error if `activeQuest` is null, but there may be valid scenarios where the quest has already been cleared from activeQuest state.

### Root Cause
The handler strictly requires `activeQuest` to be present:
```typescript
if (!state.activeQuest) {
  throw new QuestSummaryError('No active quest to summarize')
}
```

### Analysis
This might be intentional - the quest should remain "active" until the summary is acknowledged. However, the test setup wasn't providing `activeQuest`.

### Recommended Approach
**Option A: Test Fix (if current behavior is correct)**
Update tests to always provide `activeQuest` in quest_summary phase state.

**Option B: UX Enhancement (if behavior should change)**
Store quest info in `pendingQuestSummary` instead of requiring `activeQuest`. This is more defensive since the quest logically is "completing" not "active".

### Proposed Fix (Option B - More Robust)

1. **Use pendingQuestSummary for quest info**:
```typescript
export interface QuestSummaryState {
  currentPhase: GamePhase
  pendingQuestSummary: {
    questId: string
    questTitle: string
    outcome: 'completed' | 'failed' | 'abandoned'
    factionId: FactionId
  } | null
  bounty: number
  completedQuestsCount: number
  totalQuests: number
}
```

2. **Update handler validation**:
```typescript
if (!state.pendingQuestSummary) {
  throw new QuestSummaryError('No quest summary pending')
}
// Use state.pendingQuestSummary.questId instead of state.activeQuest.questId
```

---

## Issue 4: LOCK_ORDERS Command Data Requirements

### Problem
Tests were calling `LOCK_ORDERS` with empty data or data from state, but the command requires `positions` array in command data.

### Root Cause
Test setup issue - the command interface requires:
```typescript
interface LockOrdersCommand {
  type: 'LOCK_ORDERS'
  data: {
    positions: string[]  // Card IDs in position order (1-5)
  }
}
```

### Fix
This is a **test fix**, not a code fix. Tests have been updated to pass positions array.

---

## Implementation Priority

### Phase 1: Critical (Blocking Game Completion)
1. **Fix game ending trigger** - Players cannot complete the game without this
   - Estimated effort: 2-3 hours
   - Files: quest-summary/command.ts, decider.ts

### Phase 2: High Priority (Player Experience)
2. **Fix mediation BATTLE_TRIGGERED event** - Consistency in event flow
   - Estimated effort: 30 minutes
   - Files: mediation/command.ts

### Phase 3: Medium Priority (Code Quality)
3. **Refactor quest summary state handling** - More defensive code
   - Estimated effort: 1-2 hours
   - Files: quest-summary/command.ts, projections.ts

---

## Verification Checklist

After implementing fixes, verify:

- [ ] Complete 3 quests → lands on ending screen (not quest_hub)
- [ ] Refuse mediation → BATTLE_TRIGGERED event emitted
- [ ] All player journey tests pass
- [ ] E2E tests for stuck states pass
- [ ] No regression in existing gameplay flows

---

## Test Commands

```bash
# Run player journey unit tests
npm test -- src/lib/game/__tests__/player-journeys.test.ts

# Run all unit tests
npm test

# Run E2E tests (requires dev server)
npm run test:e2e
```
