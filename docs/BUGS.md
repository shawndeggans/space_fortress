# Space Fortress - QA Bug Report

**Date:** 2025-12-15
**QA Focus:** Code and UI, Gameplay Simulation, E2E Playtesting
**Test Status:** Unit tests pass (361/361), E2E tests pass (48/48), TypeScript check passes (0 errors)

## Current Status

### Round 1 (Code/UI): ✅ ALL 80 BUGS FIXED
All 80 TypeScript compile errors have been resolved. The codebase now compiles cleanly.

### Round 2 (Gameplay Simulation): ✅ ALL BUGS FIXED
22 gameplay simulations executed covering full game mechanics. BUG-022 has been fixed.

### Round 3 (E2E Playtesting): ✅ BUG FOUND AND FIXED
48 E2E tests executed covering URL navigation, card economy, and game flow. BUG-R3-001 has been fixed.

**Before (Round 1):** 80 errors, 2 warnings
**After (Round 1):** 0 errors, 1 warning (a11y - intentional behavior)

---

## Round 3: E2E Playtesting Bugs

### BUG-R3-001: FLEET_COMMITTED Event Handler Missing Card IDs ✅ FIXED

**File:** `src/lib/game/projections.ts:472-480`

**Description:**
The `FLEET_COMMITTED` event handler only updated the battle phase to `deployment` but did not store the committed card IDs. This caused the deployment screen to show "Assign 5 more cards" with no cards available to drag.

**Root Cause:**
The projection handler was missing the line to store `selectedCardIds` from the event data.

**Before (Broken):**
```typescript
case 'FLEET_COMMITTED':
  if (!state.currentBattle) return state
  return {
    ...state,
    currentBattle: {
      ...state.currentBattle,
      phase: 'deployment'  // Missing: selectedCardIds
    }
  }
```

**After (Fixed):**
```typescript
case 'FLEET_COMMITTED':
  if (!state.currentBattle) return state
  return {
    ...state,
    currentBattle: {
      ...state.currentBattle,
      phase: 'deployment',
      selectedCardIds: event.data.cardIds  // Added
    }
  }
```

**Impact:** Critical - Players could not complete battles as cards weren't available on deployment screen.

**Tests Added:**
- `tests/e2e/url-edge-cases.spec.ts` - 11 tests for URL navigation edge cases
- `tests/e2e/card-economy-edge-cases.spec.ts` - 5 tests for card economy validation

---

## A11y Warnings (Low Priority)

**File:** `src/lib/components/BattleSlot.svelte:61`
- Noninteractive element with nonnegative tabIndex value

**File:** `src/lib/components/GameMenu.svelte:113`
- `<div>` with click handler without ARIA role

---

## Executive Summary (Historical)

The game **had** critical type mismatches between the projection layer (game logic) and the UI layer (Svelte screens). All issues documented below have been **resolved**.

**Original Severity Breakdown:**
- ~~Critical: 9 screens affected with type errors~~ **FIXED**
- ~~High: 80 TypeScript compile errors~~ **FIXED**
- Medium: A11y warnings (1 remaining - intentional)
- Low: Minor inconsistencies

---

## Critical Bugs (Blocking - Compile Errors)

### BUG-001: Alliance Screen - Projection Function Signature Mismatch

**File:** `src/routes/alliance/+page.svelte:16`

**Description:**
`projectAllianceOptions` is called with 3 arguments but the function only accepts 2.

**Current Code:**
```typescript
let allianceOptions = $derived(projectAllianceOptions([], undefined, $gameState))
```

**Expected:**
```typescript
let allianceOptions = $derived(projectAllianceOptions([], $gameState))
```

**Root Cause:** Function signature is `projectAllianceOptions(events: GameEvent[], providedState?: GameState)`

---

### BUG-002: Alliance Screen - Command Data Type Mismatch

**File:** `src/routes/alliance/+page.svelte:38-44`

**Description:**
`FORM_ALLIANCE` command includes `questId` in data, but the command type only expects `factionId`.

**Current Code:**
```typescript
await gameState.handleCommand({
  type: 'FORM_ALLIANCE',
  data: {
    factionId: selectedFaction,
    questId: $gameState.activeQuest?.questId || ''  // <-- Not in type
  }
})
```

**Expected:** Either remove `questId` or update `FormAllianceCommand` type in `commands.ts`

---

### BUG-003: Alliance Screen - Progress Type Mismatch

**File:** `src/routes/alliance/+page.svelte:73-77`

**Description:**
GameHeader expects `progress: { current: number; total: number }` but the page passes a calculated ratio number.

**Current Code:**
```typescript
progress: playerState.activeQuest.currentDilemmaIndex / playerState.activeQuest.totalDilemmas
```

**Expected:**
```typescript
progress: {
  current: playerState.activeQuest.currentDilemmaIndex,
  total: playerState.activeQuest.totalDilemmas
}
```

---

### BUG-004: Quest Hub Screen - Property Name Mismatches

**File:** `src/routes/quest-hub/+page.svelte`

**Description:**
Multiple property name mismatches between what the screen expects and what `QuestListItem` provides.

| Line | Current | Expected |
|------|---------|----------|
| 39 | `selectedQuest.id` | `selectedQuest.questId` |
| 55 | `quest.id` | `quest.questId` |
| 57 | `quest.faction` | `quest.factionId` |
| 58 | `quest.brief` | `quest.briefDescription` |
| 141 | `selectedQuest.faction` | `selectedQuest.factionId` |

**Additional Missing Properties (Lines 145-189):**
- `selectedQuest.description` - Not in `QuestListItem` (need to use `QuestDetailView`)
- `selectedQuest.giver` - Not in `QuestListItem`
- `selectedQuest.initialRewards` - Not in `QuestListItem`
- `selectedQuest.warnings` - Not in `QuestListItem`

**Root Cause:** The modal displays detailed quest info but uses `QuestListItem` type instead of `QuestDetailView`.

---

### BUG-005: Quest Hub Screen - Completed Quest Type Incompatibility

**File:** `src/routes/quest-hub/+page.svelte:121`

**Description:**
Passing `CompletedQuestItem` to `toQuestDisplayData()` which expects `QuestListItem`. These types have different structures.

**Impact:** Completed quests section cannot render properly.

---

### BUG-006: Card Pool Screen - Projection Function Signature Mismatch

**File:** `src/routes/card-pool/+page.svelte:17`

**Description:**
`projectCardPoolView` is called incorrectly - passing `GameState` as second argument when it should be third.

**Current Code:**
```typescript
let cardPoolView = $derived(projectCardPoolView([], $gameState))
```

**Expected:**
```typescript
let cardPoolView = $derived(projectCardPoolView([], undefined, $gameState))
```

**Function Signature:** `projectCardPoolView(events: GameEvent[], battleId?: string, providedState?: GameState)`

---

### BUG-007: Card Pool Screen - Property Name Mismatches

**File:** `src/routes/card-pool/+page.svelte`

**Description:**
Multiple property name mismatches throughout the file.

| Lines | Current | Expected |
|-------|---------|----------|
| 27, 55, 61, 75, 76, 133 | `cardPoolView.cards` | `cardPoolView.allCards` |
| 65, 77 | `card.faction` | `card.factionId` |
| 115-126 | `cardPoolView.enemyIntel` | `cardPoolView.enemyFleet` |
| 121 | `cardPoolView.enemyIntel.factionName` | Property doesn't exist |

**Note:** `EnemyFleetPreview` has `name` and `factionId`, not `factionName`.

---

### BUG-008: Narrative Screen - Projection Function Signature Mismatch

**File:** `src/routes/narrative/+page.svelte:15`

**Description:**
`projectDilemmaView` called with 2 arguments but signature expects `(events, dilemmaId?, providedState?)`.

**Current Code:**
```typescript
let dilemmaView = $derived(projectDilemmaView([], $gameState))
```

**Expected:**
```typescript
let dilemmaView = $derived(projectDilemmaView([], undefined, $gameState))
```

---

### BUG-009: Narrative Screen - Property Name Mismatches

**File:** `src/routes/narrative/+page.svelte`

**Description:**
Multiple property mismatches between screen and `DilemmaViewData`/`ChoiceData`/`VoiceData` types.

| Line | Current | Expected |
|------|---------|----------|
| 24 | `dilemmaView.id` | `dilemmaView.dilemmaId` |
| 32, 113 | `choice.id` | `choice.choiceId` |
| 98 | `voice.faction` | `voice.factionId` |
| 99 | `voice.portrait` | Property doesn't exist |

---

### BUG-010: Narrative Screen - transformChoice Function Broken

**File:** `src/routes/narrative/+page.svelte:50-66`

**Description:**
The `transformChoice` function references non-existent properties on `ChoiceData`.

**Current Code:**
```typescript
function transformChoice(choice: typeof dilemmaView.choices[0]): ChoiceData {
  return {
    id: choice.id,                              // Should be choice.choiceId
    label: choice.label,
    description: choice.description,
    consequences: {
      reputation: choice.consequences.reputation,  // consequences doesn't exist
      cards: choice.consequences.cards,
      bounty: choice.consequences.bounty,
      risk: choice.consequences.risk
    },
    nextStep: choice.nextStep,                  // doesn't exist
    triggersBattle: choice.triggersBattle,
    triggersAlliance: choice.triggersAlliance,
    triggersMediation: choice.triggersMediation
  }
}
```

**`ChoiceData` actual properties:**
- `choiceId`, `label`, `description`
- `reputationPreviews`, `cardsGained`, `cardsLost`
- `bountyModifier`, `triggersBattle`, `triggersAlliance`, `triggersMediation`
- `riskDescription`, `riskProbability`

---

### BUG-011: Battle Screen - CombatLogEntry Missing Property

**File:** `src/routes/battle/+page.svelte:166`

**Description:**
Accessing `entry.isHighlight` but `CombatLogEntry` type doesn't have this property.

**Current Code:**
```svelte
<div class="log-entry" class:highlight={entry.isHighlight}>
```

**`CombatLogEntry` Properties:** `type`, `text`, `isPlayerAction`, `isHit?`

---

### BUG-012: Consequence Screen - Bounty Structure Mismatch

**File:** `src/routes/consequence/+page.svelte:85-93`

**Description:**
Bounty display references incorrect property names from `BountyBreakdownView`.

| Current | Expected |
|---------|----------|
| `consequenceView.bounty.base` | `consequenceView.bounty.baseReward` |
| `share.percent` | `share.percentage` |
| `consequenceView.bounty.bonuses` | `consequenceView.bounty.modifiers` (filter positive) |
| `consequenceView.bounty.penalties` | `consequenceView.bounty.modifiers` (filter negative) |
| `consequenceView.bounty.net` | `consequenceView.bounty.netReward` |

---

### BUG-013: Consequence Screen - Card Change Properties Mismatch

**File:** `src/routes/consequence/+page.svelte:118-136`

**Description:**
`CardChangeView` has different property names than expected.

| Current | Expected |
|---------|----------|
| `card.name` | `card.cardName` |
| `card.faction` | `card.factionId` |

---

### BUG-014: Consequence Screen - Next Dilemma Check

**File:** `src/routes/consequence/+page.svelte:27`

**Description:**
Checking `consequenceView?.nextDilemmaId` but `ConsequenceViewData` has `hasNextDilemma` (boolean).

**Current Code:**
```typescript
if (consequenceView?.nextDilemmaId) {
```

**Expected:**
```typescript
if (consequenceView?.hasNextDilemma) {
```

---

### BUG-015: Deployment Screen - Projection Function Signature Mismatch

**File:** `src/routes/deployment/+page.svelte:15`

**Description:**
`projectDeploymentView` called with 2 arguments but expects 3.

**Current Code:**
```typescript
let deploymentView = $derived(projectDeploymentView([], $gameState))
```

**Expected:**
```typescript
let deploymentView = $derived(projectDeploymentView([], undefined, $gameState))
```

---

### BUG-016: Deployment Screen - Missing committedCards Property

**File:** `src/routes/deployment/+page.svelte:24, 71-74, 76`

**Description:**
References `deploymentView.committedCards` which doesn't exist on `DeploymentViewData`.

**`DeploymentViewData` Properties:** `slots`, `unassignedCards`, `assignedCount`, `totalSlots`, etc.

**Solution:** Use `unassignedCards` and cards from `slots` instead.

---

### BUG-017: Deployment Screen - Card Property Mismatch

**File:** `src/routes/deployment/+page.svelte:80`

**Description:**
`card.faction` should be `card.factionId` (type is `DeploymentCardView`).

---

### BUG-018: Ending Screen - Property Mismatches

**File:** `src/routes/ending/+page.svelte`

**Description:**
Multiple property name mismatches with `EndingViewData`.

| Line | Current | Expected |
|------|---------|----------|
| 56 | `endingView.narrativeSummary` | `endingView.summaryText` |
| 63 | `endingView.factionStandings` | `endingView.standings` |
| 65 | `faction.value` | `faction.reputation` |
| 78-101 | `endingView.stats.*` | Properties in `endingView.statistics` array |

**`EndingViewData.statistics` is an array of `StatisticView` objects, not a stats object.**

---

## Medium Severity Bugs

### BUG-019: BattleSlot A11y Warning

**File:** `src/lib/components/BattleSlot.svelte:61`

**Description:**
A11y warning: noninteractive element cannot have nonnegative tabIndex value.

**Impact:** Accessibility issue, not blocking.

---

## Type Definition Issues

### BUG-020: GameHeader ActiveQuestSummary Type Inconsistency

**Files:**
- `src/lib/components/GameHeader.svelte:23-27`
- `src/lib/game/projections/playerState.ts:36-43`

**Description:**
GameHeader's internal `ActiveQuestSummary` type differs from `playerState.ts` export:

**GameHeader expects:**
```typescript
interface ActiveQuestSummary {
  title: string
  factionId: FactionId
  progress: { current: number; total: number }
}
```

**playerState.ts provides:**
```typescript
interface ActiveQuestSummary {
  questId: string
  title: string
  factionId: FactionId
  currentDilemmaIndex: number
  totalDilemmas: number
  factionIcon: string
}
```

**Solution:** Screens currently transform the data, but transformations have bugs (see BUG-003).

---

### BUG-021: Component Types Import Inconsistency

**File:** `src/lib/components/types.ts`

**Description:**
Components have their own type definitions that don't match projection types. Need to either:
1. Import from projection types, or
2. Create explicit transformation functions

---

## Summary by Screen

| Screen | Bugs | Severity |
|--------|------|----------|
| Alliance | BUG-001, BUG-002, BUG-003 | Critical |
| Quest Hub | BUG-004, BUG-005 | Critical |
| Card Pool | BUG-006, BUG-007 | Critical |
| Narrative | BUG-008, BUG-009, BUG-010 | Critical |
| Battle | BUG-011 | High |
| Consequence | BUG-012, BUG-013, BUG-014 | Critical |
| Deployment | BUG-015, BUG-016, BUG-017 | Critical |
| Ending | BUG-018 | Critical |
| BattleSlot | BUG-019 | Medium |

---

## Recommended Fixes

### Priority 1: Fix Projection Function Calls
Update all screens to pass arguments correctly:
- `projectAllianceOptions([], $gameState)`
- `projectCardPoolView([], undefined, $gameState)`
- `projectDilemmaView([], undefined, $gameState)`
- `projectDeploymentView([], undefined, $gameState)`
- `projectConsequenceView([], $gameState)`

### Priority 2: Fix Property Name Mismatches
Either:
1. Update screens to use correct property names from projection types
2. Create explicit mapping/transformation functions with proper typing

### Priority 3: Unify Type Definitions
Create a single source of truth for view types:
- Export component prop types from a shared location
- Create documented transformation functions
- Consider generating component types from projection types

### Priority 4: Command Type Alignment
Either:
1. Add `questId` to `FORM_ALLIANCE` command type
2. Remove `questId` from screen dispatches

---

## Testing Recommendations

1. **Add Integration Tests**: Test the full flow from screen to projection
2. **Add Type Tests**: Ensure projection outputs match component inputs
3. **Enable Strict Mode**: Catch these issues earlier with stricter TypeScript config
4. **Add Svelte Check to CI**: Run `npm run check` in CI pipeline

---

## Files Affected

### Screens (9 files)
- `src/routes/alliance/+page.svelte`
- `src/routes/quest-hub/+page.svelte`
- `src/routes/card-pool/+page.svelte`
- `src/routes/narrative/+page.svelte`
- `src/routes/battle/+page.svelte`
- `src/routes/consequence/+page.svelte`
- `src/routes/deployment/+page.svelte`
- `src/routes/ending/+page.svelte`
- `src/routes/+page.svelte` (main menu - likely affected)

### Projections (may need updates)
- `src/lib/game/projections/allianceView.ts`
- `src/lib/game/projections/questList.ts`
- `src/lib/game/projections/cardPool.ts`
- `src/lib/game/projections/dilemmaView.ts`
- `src/lib/game/projections/battleView.ts`
- `src/lib/game/projections/consequenceView.ts`
- `src/lib/game/projections/deploymentView.ts`
- `src/lib/game/projections/endingView.ts`

### Components
- `src/lib/components/GameHeader.svelte`
- `src/lib/components/BattleSlot.svelte`
- `src/lib/components/types.ts`

### Commands
- `src/lib/game/commands.ts`

---

## Round 2: Gameplay Simulation Bugs

### BUG-022: ActiveQuest Missing factionId Property

**Status:** ✅ FIXED
**Severity:** Medium
**Found in:** Gameplay Simulation Test #3
**Fixed in:** 2025-12-14

**File:** `src/lib/game/projections.ts:161-170`

**Description:**
When a quest is accepted, the `QUEST_ACCEPTED` event contains `factionId`, but the `evolveState` function does not store it in the `activeQuest` state. This means the game loses track of which faction a quest belongs to.

**Event Data Contains:**
```typescript
// events.ts line 50-56
type: 'QUEST_ACCEPTED'
data: {
  questId: string
  factionId: FactionId  // ← This data is available
  initialBounty: number
  initialCardIds: string[]
}
```

**But evolveState Discards It:**
```typescript
// projections.ts line 161-170
case 'QUEST_ACCEPTED':
  return {
    ...state,
    activeQuest: {
      questId: event.data.questId,
      currentDilemmaIndex: 0,
      dilemmasCompleted: 0,
      alliances: [],
      battlesWon: 0,
      battlesLost: 0
      // factionId is NOT stored!
    },
    ...
  }
```

**Impact:**
- Cannot track which faction the active quest belongs to
- UI components that need quest faction info (GameHeader, alliance options) must look it up separately
- Alliance logic may not correctly filter out the quest-giving faction

**Fix Required:**
1. Update `ActiveQuest` interface in `types.ts` to include `factionId: FactionId`
2. Update `evolveState` in `projections.ts` to store `event.data.factionId`

```typescript
// types.ts - Add factionId to ActiveQuest
export interface ActiveQuest {
  questId: string
  factionId: FactionId  // ADD THIS
  currentDilemmaIndex: number
  dilemmasCompleted: number
  alliances: QuestAlliance[]
  battlesWon: number
  battlesLost: number
}

// projections.ts - Store factionId
case 'QUEST_ACCEPTED':
  return {
    ...state,
    activeQuest: {
      questId: event.data.questId,
      factionId: event.data.factionId,  // ADD THIS
      currentDilemmaIndex: 0,
      dilemmasCompleted: 0,
      alliances: [],
      battlesWon: 0,
      battlesLost: 0
    },
    ...
  }
```

---

## BUG-R4-001: Tactical Battle Round Limit Not Working + E2E Test Compatibility

**Status:** ✅ Core fix complete, E2E test fix ready to implement
**Severity:** Critical
**Found in:** E2E Playthrough Tests
**Date:** 2025-12-21

### Problem
Tactical battles don't timeout after 5 rounds (10 turns). Battles continue indefinitely (25+ turns in tests).

### Root Cause (Architecture Violation)
The decider was calling `generateOpponentTurnEvents()` inline with a manually constructed "simulated" state, bypassing the projection system. This worked in unit tests (synchronous) but failed in browser (async/state sync issues).

### Solution Implemented
1. Refactored `handleEndTurn` to only emit turn transition events
2. Added `PROCESS_OPPONENT_TURN` command that uses properly projected state
3. Added auto-dispatch in game store when `activePlayer === 'opponent'`

### Files Modified
- `src/lib/game/commands.ts` - Added `ProcessOpponentTurnCommand` type
- `src/lib/game/decider.ts` - Added `handleProcessOpponentTurn`, refactored `handleEndTurn`
- `src/lib/stores/gameStore.ts` - Added auto-dispatch for opponent turn

### E2E Test Compatibility Issue
After fixing the core bug, E2E tests still failed because Playwright clicks don't trigger Svelte 5 button handlers after phase transitions.

**Root Cause:** Svelte 5 uses event delegation with deferred DOM updates. After state changes (mulligan→playing transition), the `__click` handler property isn't attached to buttons when Playwright clicks.

**Solution:** Add helper function to wait for Svelte 5's `__click` handler:

```typescript
async function clickSvelteButton(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel) as any
      return el && !el.disabled && el.__click !== undefined
    },
    selector,
    { timeout: 5000 }
  )
  await page.locator(selector).click()
}
```

### File to Modify for E2E Fix
- `tests/e2e/complete-playthrough.spec.ts` - Add helper, update battle loop

### Verification
```bash
npm test -- --run                    # Unit tests (486 should pass)
npx playwright test tests/e2e/complete-playthrough.spec.ts  # E2E tests
```

---

## Gameplay Simulation Test Summary

22 simulations were executed testing the full game loop:

| Category | Tests | Status |
|----------|-------|--------|
| Game Initialization | 2 | ✅ Pass |
| Quest Flow | 2 | ⚠️ 1 bug found (BUG-022) |
| Choice Making | 2 | ✅ Pass |
| Alliance System | 3 | ✅ Pass |
| Battle System | 3 | ✅ Pass |
| Combat Resolution | 2 | ✅ Pass |
| Opponent Generation | 2 | ✅ Pass |
| Mediation System | 3 | ✅ Pass |
| Deployment Phase | 2 | ✅ Pass |
| Full Game Loop | 1 | ✅ Pass |

**Test File:** `src/lib/game/__tests__/gameplay-simulation.test.ts`
