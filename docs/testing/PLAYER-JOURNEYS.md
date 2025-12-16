# Space Fortress - Player Journey Testing Guide

This document defines all player journeys through Space Fortress for comprehensive testing.
These journeys help identify sequences that end incorrectly or leave players without options.

## Table of Contents
1. [Core Game Loop](#core-game-loop)
2. [Happy Path Journeys](#happy-path-journeys)
3. [Branching Path Journeys](#branching-path-journeys)
4. [Edge Case Journeys](#edge-case-journeys)
5. [Stuck State Scenarios](#stuck-state-scenarios)
6. [Player Communication Requirements](#player-communication-requirements)

---

## Core Game Loop

```
┌──────────────────────────────────────────────────────────────────┐
│                         GAME FLOW                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  HOME (/) ──START_GAME──> QUEST HUB (/quest-hub)                │
│                                  │                                │
│                           ACCEPT_QUEST                           │
│                                  ▼                                │
│                     ┌────NARRATIVE (/narrative)                  │
│                     │           │                                 │
│                     │      MAKE_CHOICE                           │
│                     │           ▼                                 │
│                     │   CHOICE CONSEQUENCE (/choice-consequence) │
│                     │           │                                 │
│                     │    ACKNOWLEDGE                             │
│                     │           │                                 │
│                     │    ┌──────┴──────┐──────────────────┐      │
│                     │    │             │                   │      │
│                     │    ▼             ▼                   ▼      │
│                     └──NEXT         TRIGGERS            TRIGGERS │
│                       DILEMMA       BATTLE              MEDIATION│
│                                        │                   │      │
│                                        ▼                   ▼      │
│                               ALLIANCE (/alliance)    MEDIATION  │
│                                        │             (/mediation)│
│                               FORM_ALLIANCE              │       │
│                               or PROCEED_SOLO            │       │
│                                        │        ┌────────┤       │
│                                        ▼        │        ▼       │
│                               CARD POOL    REFUSED?    LEANED    │
│                              (/card-pool)     │         │        │
│                                   │           ▼         ▼        │
│                               COMMIT      (BATTLE)   COMPROMISE  │
│                                   ▼                     │        │
│                              DEPLOYMENT                 ▼        │
│                             (/deployment)          CONSEQUENCE   │
│                                   │                     │        │
│                              LOCK_ORDERS                │        │
│                                   ▼                     │        │
│                               BATTLE (/battle)          │        │
│                                   │                     │        │
│                              BATTLE_RESOLVED            │        │
│                                   ▼                     │        │
│                            CONSEQUENCE (/consequence) ◄─┘        │
│                                   │                              │
│                              ACKNOWLEDGE                         │
│                                   │                              │
│                    ┌──────────────┼───────────────┐              │
│                    │              │               │              │
│                    ▼              ▼               ▼              │
│              POST-BATTLE      QUEST           GAME ENDING        │
│              DILEMMA         SUMMARY        (if 3 quests)       │
│                 │          (/quest-summary)      │               │
│                 │              │                 ▼               │
│                 └─────>  ACKNOWLEDGE      ENDING (/ending)       │
│                              │                   │               │
│                              ▼                   ▼               │
│                         QUEST HUB            NEW GAME            │
│                        (loop back)          (restart)            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Happy Path Journeys

### Journey HP-1: Complete Quest with Battle (Standard Flow)

**Description**: Player completes a single quest following the combat path.

**Steps**:
1. Start new game → `quest_hub`
2. Accept quest (e.g., `quest_salvage_claim`) → `narrative`
3. Make choice triggering battle (e.g., `choice_attack_immediately`) → `choice_consequence`
4. Acknowledge consequence → `alliance`
5. Form alliance with faction → stays in `alliance`
6. Continue to cards → `card_selection`
7. Select 5 cards → stays in `card_selection`
8. Commit fleet → `deployment`
9. Position all 5 cards → stays in `deployment`
10. Lock orders → `battle`
11. Battle auto-plays → `battle` (resolved)
12. View consequences → `consequence`
13. Acknowledge outcome → `quest_summary` or next `narrative`
14. Acknowledge summary → `quest_hub`

**Expected Outcomes**:
- Player always has clear action to take
- Each phase transition is visible
- Bounty calculated correctly
- Reputation changes reflected

**Test ID**: `HP-1-standard-battle-flow`

---

### Journey HP-2: Complete Quest with Mediation (Diplomatic Path)

**Description**: Player completes quest via diplomatic resolution.

**Steps**:
1. Start new game → `quest_hub`
2. Accept quest (e.g., `quest_sanctuary_run`) → `narrative`
3. Make choice triggering mediation (`choice_direct_approach`) → `choice_consequence`
4. Acknowledge → `mediation`
5. Lean toward faction → stays in `mediation`
6. Accept compromise → `consequence`
7. Acknowledge → `narrative` (next dilemma) or `quest_summary`
8. Complete remaining dilemmas
9. Acknowledge quest summary → `quest_hub`

**Expected Outcomes**:
- Battle is avoided
- Reduced bounty from compromise
- Reputation balanced between factions

**Test ID**: `HP-2-diplomatic-mediation`

---

### Journey HP-3: Complete All Three Quests → Game Ending

**Description**: Full game playthrough completing all 3 quests.

**Steps**:
1. Start new game
2. Complete Quest 1 (Salvage Claim) → return to `quest_hub`
3. Complete Quest 2 (Sanctuary Run) → return to `quest_hub`
4. Complete Quest 3 (Broker's Gambit) → `ending` screen
5. View ending evaluation
6. Start new game

**Verification Points**:
- After Quest 3, phase becomes `ending` (not `quest_hub`)
- `questsCompleted` count equals 3
- Ending type correctly calculated from choices/reputation
- "New Game" button returns to home

**Test ID**: `HP-3-full-game-three-quests`

---

### Journey HP-4: Narrative Chain Without Battle

**Description**: Quest path with multiple dilemmas but no battle trigger.

**Steps**:
1. Accept `quest_salvage_claim`
2. Choose `choice_hail_first` (no battle trigger) → `choice_consequence`
3. Acknowledge → `narrative` (next dilemma)
4. Choose `choice_negotiate_split` → `choice_consequence`
5. Acknowledge → `alliance` (triggers alliance phase)
6. Continue through battle flow

**Key Verification**:
- Multiple narrative → choice_consequence → narrative cycles work
- Eventually transitions out of narrative loop

**Test ID**: `HP-4-narrative-chain`

---

## Branching Path Journeys

### Journey BP-1: Proceed Without Alliance

**Description**: Player chooses to fight without faction assistance.

**Steps**:
1. Reach alliance phase
2. Click "Continue without allies"
3. Continue to card selection
4. Complete battle with starter cards only

**Expected Outcomes**:
- Player can still select 5 cards (has 3 starter + 1 quest card minimum)
- Battle is harder without alliance cards
- No bounty share deducted

**Test ID**: `BP-1-solo-battle`

---

### Journey BP-2: Mediation Collapse → Forced Battle

**Description**: Player refuses to lean in mediation, collapsing talks.

**Steps**:
1. Reach mediation phase
2. Click "Refuse to Lean"
3. Mediation collapses → `card_selection`
4. Complete battle flow

**Expected Outcomes**:
- Both factions angered (reputation loss)
- Battle triggered as fallback
- Clear message about why battle occurred

**Test ID**: `BP-2-mediation-collapse`

---

### Journey BP-3: Switch Sides Mid-Quest

**Description**: Player betrays initial quest faction.

**Steps**:
1. Accept Ironveil quest (`quest_salvage_claim`)
2. Choose `choice_release_survivors` (sides with Ashfall)
3. Later choose `choice_switch_to_ashfall`
4. Fight former allies

**Expected Outcomes**:
- Major reputation swing
- Lose Ironveil card, gain Ashfall card
- Battle against Ironveil instead

**Test ID**: `BP-3-faction-betrayal`

---

### Journey BP-4: Multiple Alliance Formation

**Description**: Form alliances with multiple factions before battle.

**Steps**:
1. Reach alliance phase
2. Form alliance with Meridian
3. Form alliance with Void Wardens
4. Continue to battle

**Expected Outcomes**:
- Multiple alliance cards gained
- Combined bounty share deducted
- Both alliances tracked

**Test ID**: `BP-4-multiple-alliances`

---

## Edge Case Journeys

### Journey EC-1: Minimum Card Selection

**Description**: Player has exactly 5 cards available.

**Preconditions**:
- 3 starter cards
- 1 quest card
- 1 alliance card = 5 total

**Steps**:
1. Enter card selection with exactly 5 unlocked cards
2. Select all 5 cards
3. Commit fleet
4. Deploy and battle

**Expected Outcomes**:
- All cards automatically available for selection
- Cannot proceed with fewer than 5
- Clear message if cards are insufficient

**Test ID**: `EC-1-minimum-cards`

---

### Journey EC-2: Card Locked Due to Reputation

**Description**: Reputation change locks a previously available card.

**Steps**:
1. Gain card from faction A
2. Make choices that tank faction A reputation
3. Card becomes locked (`isLocked: true`)
4. Enter card selection
5. Cannot select locked card

**Expected Outcomes**:
- Locked card shows lock indicator
- Hover/click shows lock reason
- Player can still select 5 from unlocked cards

**Test ID**: `EC-2-reputation-card-lock`

---

### Journey EC-3: Battle Loss Scenario

**Description**: Player loses a battle (opponent wins 3+ rounds).

**Steps**:
1. Select weak cards for battle
2. Battle against hard opponent
3. Lose 3 or more rounds
4. Battle outcome: `defeat`

**Expected Outcomes**:
- Consequence screen shows defeat
- Reduced or zero bounty
- Quest can still complete (partial success)
- Game doesn't softlock

**Test ID**: `EC-3-battle-defeat`

---

### Journey EC-4: Quest Without Final Battle

**Description**: Some choice paths skip the final battle.

**Steps**:
1. Accept `quest_salvage_claim`
2. Choose `choice_hail_first`
3. Choose `choice_negotiate_split` (triggers alliance, but negotiated)
4. Choose `choice_accept_warden_escort` (third dilemma - no battle)

**Expected Outcomes**:
- Quest completes without battle
- Navigate directly to quest_summary
- Bounty calculated from choices only

**Test ID**: `EC-4-no-final-battle`

---

### Journey EC-5: Dilemma with All Choices Leading to Same Outcome

**Description**: Verify navigation works when all choices converge.

**Steps**:
1. Reach final dilemma of quest
2. All choices have no `nextDilemmaId` (quest ends)
3. Make any choice
4. Consequence shows quest completion

**Expected Outcomes**:
- `triggersNext` correctly set to `quest_complete`
- Navigate to `quest_summary` after acknowledge

**Test ID**: `EC-5-converging-choices`

---

## Stuck State Scenarios

These scenarios identify situations where players can become stuck without clear options.

### Stuck-1: All Quests Locked by Reputation

**Scenario**: Player has hostile (-75+) reputation with all quest factions.

**How to reach**:
1. Complete Quest 1, making all hostile choices
2. Complete Quest 2, making all hostile choices
3. Return to quest hub
4. All remaining quests locked

**Current Behavior**: Player sees locked quests with no way forward.

**Required Fix**:
- At least one quest must always be available
- OR provide reputation recovery mechanism
- OR provide "desperate measures" quest for any reputation

**Test ID**: `STUCK-1-all-quests-locked`

---

### Stuck-2: Insufficient Cards for Battle

**Scenario**: Player has fewer than 5 unlocked cards when entering card selection.

**How to reach**:
1. Lose cards through choices
2. Have hostile rep with factions (cards locked)
3. Enter battle phase with < 5 available cards

**Current Behavior**: Cannot commit fleet, no alternative.

**Required Fix**:
- Prevent entering battle with < 5 cards
- OR provide loaner cards
- OR allow forfeit option

**Test ID**: `STUCK-2-insufficient-cards`

---

### Stuck-3: Battle Screen Without Continue Button

**Scenario**: Battle completes but no UI to proceed.

**How to reach**:
1. Battle auto-plays all 5 rounds
2. Battle resolved but button doesn't appear
3. Player stuck on battle screen

**Current Behavior**: Should show "View Consequences" button.

**Verification**:
- Button must appear within 2 seconds of battle completion
- Button must be visible (not hidden by overflow)

**Test ID**: `STUCK-3-battle-no-continue`

---

### Stuck-4: Consequence Screen Without Next Phase

**Scenario**: Acknowledge consequence but no navigation occurs.

**How to reach**:
1. Complete battle
2. View consequence
3. Click continue
4. Nothing happens

**Current Behavior**: Should navigate to quest_summary or next_dilemma.

**Verification**:
- `triggersNext` field must be set
- Navigation must occur on acknowledge

**Test ID**: `STUCK-4-consequence-no-navigation`

---

### Stuck-5: Quest Summary Without Return Button

**Scenario**: Quest summary displays but cannot return to quest hub.

**How to reach**:
1. Complete quest
2. View quest summary
3. No "Continue" button visible

**Current Behavior**: Should show continue button to quest hub.

**Test ID**: `STUCK-5-summary-no-return`

---

### Stuck-6: Alliance Phase with All Factions Hostile

**Scenario**: Every faction is hostile, cannot form any alliance.

**How to reach**:
1. Make all hostile choices
2. All factions at -75 or below
3. Enter alliance phase

**Current Behavior**: "Continue without allies" should always be available.

**Verification**:
- Solo option always visible
- Player informed why alliances unavailable

**Test ID**: `STUCK-6-no-alliances-available`

---

### Stuck-7: Deployment with Missing Position Assignment

**Scenario**: Player cannot figure out how to assign all positions.

**How to reach**:
1. Enter deployment phase
2. Assign 3 of 5 cards
3. Cannot find remaining cards or slots
4. Lock Orders button disabled

**Current Behavior**: Button disabled until all 5 positioned.

**Required Verification**:
- Clear indicator of unassigned cards
- Clear indicator of empty slots
- Help text for confused players

**Test ID**: `STUCK-7-deployment-confusion`

---

### Stuck-8: Game Ending Not Triggered After 3rd Quest

**Scenario**: Complete 3 quests but return to quest hub instead of ending.

**How to reach**:
1. Complete Quest 1
2. Complete Quest 2
3. Complete Quest 3
4. Acknowledge summary
5. Navigate to quest_hub instead of ending

**Current Behavior**: Should go to ending screen.

**Verification**:
- Check `completedQuests.length === 3` triggers ending
- Check `questsCompleted` stat matches

**Test ID**: `STUCK-8-ending-not-triggered`

---

## Player Communication Requirements

### PC-1: Current Phase Indicator

**Requirement**: Player always knows which phase they're in.

**Implementation**:
- Phase shown in UI header
- Progress indicator shows journey position
- Breadcrumb navigation where applicable

**Test**: Verify phase indicator on all screens.

---

### PC-2: Why Option Is Unavailable

**Requirement**: Locked/disabled options explain why.

**Examples**:
- Locked quest: "Requires +25 reputation with Ironveil"
- Locked card: "Locked due to hostile Ashfall reputation"
- Disabled alliance: "Cannot ally with hostile faction"
- Disabled commit: "Select 5 cards to continue"

**Test**: Verify tooltips/messages for all disabled states.

---

### PC-3: Consequence Preview

**Requirement**: Player can see likely outcomes before choosing.

**Examples**:
- Choice shows reputation changes that will occur
- Alliance shows bounty share percentage
- Mediation lean shows reputation effects

**Test**: Verify consequence previews match actual results.

---

### PC-4: Recovery Options

**Requirement**: Player has path forward from any state.

**Examples**:
- Lost battle: Still completes quest (reduced reward)
- Hostile reputation: Recovery quests available
- Low cards: Can proceed without alliance

**Test**: Verify no dead-end game states exist.

---

### PC-5: Save Game Integrity

**Requirement**: Player can save/load without losing progress.

**Verification**:
- Save works in all phases
- Load restores exact game state
- No corruption on save/load cycle

**Test**: Save and load in every phase, verify state matches.

---

## Test Matrix

| Journey ID | Phase Coverage | Priority | Automation |
|------------|----------------|----------|------------|
| HP-1 | All battle phases | High | E2E |
| HP-2 | All mediation phases | High | E2E |
| HP-3 | Full game | Critical | E2E |
| HP-4 | Narrative loop | High | E2E |
| BP-1 | Alliance skip | Medium | E2E |
| BP-2 | Mediation collapse | Medium | E2E |
| BP-3 | Faction betrayal | Medium | Unit |
| BP-4 | Multiple alliances | Medium | Unit |
| EC-1 | Minimum cards | High | Unit |
| EC-2 | Card locking | High | Unit |
| EC-3 | Battle defeat | High | Unit |
| EC-4 | No final battle | Medium | E2E |
| EC-5 | Converging choices | Medium | Unit |
| STUCK-1 | Quest locking | Critical | Unit |
| STUCK-2 | Card shortage | Critical | Unit |
| STUCK-3 | Battle UI | Critical | E2E |
| STUCK-4 | Consequence nav | Critical | E2E |
| STUCK-5 | Summary nav | Critical | E2E |
| STUCK-6 | Alliance availability | High | Unit |
| STUCK-7 | Deployment UI | High | E2E |
| STUCK-8 | Ending trigger | Critical | E2E |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-XX | Initial player journey documentation |
