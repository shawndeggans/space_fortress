# Space Fortress: MVP Readiness Analysis

## Target: itch.io release for player feedback

---

## Verdict: **Yes, this is MVP-ready in design scope**

The design has enough material for a complete, playable experience. The question is execution risk, not design completeness.

---

## What We Have

| Element | Quantity | MVP Sufficient? |
|---------|----------|-----------------|
| Quest arcs | 3 complete | ✓ Yes |
| Dilemmas per quest | 3-4 | ✓ Yes |
| Total unique dilemmas | ~12 | ✓ Yes |
| Factions | 5 | ✓ Yes |
| Unique cards | ~20 | ✓ Yes |
| Endings | 5+ types | ✓ Yes |
| Screens | 12 | ✓ Yes |
| Playtime target | 45-90 min | ✓ Achievable |

---

## Pros

### 1. Tight Scope
Three quests is the right size. Not too short (feels like a demo), not too long (scope creep). A player can complete the game in one sitting and immediately want to replay with different choices.

### 2. Strong Hook
"You fight with the fleet your values built" is a clear, differentiated pitch. It's not just tower defense. It's not just visual novel. The integration of narrative → tactical consequences is the selling point.

### 3. Simple Combat Math
`d20 + Attack vs 10 + Armor` is instantly understandable. No complex status effects, no resource management mid-battle. Players can focus on the interesting decision: which cards to bring and in what order.

### 4. Meaningful Choices
Every dilemma affects:
- What cards you have access to
- Who will ally with you
- What future paths open/close
- How the story ends

This isn't fake choice. The consequences are mechanical AND narrative.

### 5. Built-in Replayability
- 3 main paths per quest (faction alignment)
- Combat vs diplomacy routes
- Secret alliance risk/reward
- Multiple ending types

A player who does Ironveil → Ashfall → Wardens will have a completely different experience than Ashfall → Meridian → Sundered Oath.

### 6. Clear Event Model
We know exactly:
- What events fire when
- What data each screen needs
- How state flows through the system

This reduces implementation ambiguity significantly.

### 7. Scoped UI
12 screens, 15 components. No infinite scroll feeds. No procedural content. No multiplayer sync. This is buildable by a small team or solo dev.

---

## Cons / Risks

### 1. Combat May Feel Passive ⚠️
**The biggest risk.**

Player decisions happen BEFORE execution:
- Pick 5 cards (Commitment)
- Arrange order (Deployment)
- Watch dice rolls (Execution)

During the actual battle, you're a spectator. This could feel:
- **Good**: Strategic, chess-like, "I set up the dominoes"
- **Bad**: Passive, slot-machine-like, "Why am I watching RNG?"

**Mitigation**: Strong battle presentation. Make the dice rolls feel dramatic. Show near-misses. Let the player feel the tension even without agency.

### 2. Reading-Heavy 📖
Every dilemma has:
- Situation description
- 3 NPC dialogue boxes
- 2-3 choice buttons with consequence previews

That's a lot of text. Mobile players with short attention spans may bounce.

**Mitigation**: Keep dialogue punchy. The current design doc examples are well-written but could be trimmed 20-30% for screen.

### 3. High Variance (d20) 🎲
A d20 has huge swing. A card with Attack 5 vs Armor 4 (target 14) hits 35% of the time. That same card against Armor 7 (target 17) hits only 20%.

Bad luck streaks will happen. Players may feel cheated.

**Mitigation**:
- 5 rounds per battle averages out variance somewhat
- Tank cards (high armor) provide consistent "don't lose" rather than "win"
- Accept that some battles will be lost to luck—make narrative consequences of defeat interesting, not punishing

### 4. Writing Volume Required ✍️
The three-voice rule means every major dilemma needs:
- 3 distinct NPC perspectives
- Each perspective must be legitimate, not strawman
- Dialogue must be in-character for faction

This is good design but expensive to produce. Estimate: 15,000-20,000 words of dialogue for 3 quests.

### 5. No Onboarding Designed
We haven't designed:
- Tutorial flow
- First-time player experience
- Tooltips / help system

A player dropping into Dilemma 1 cold might be overwhelmed.

**Mitigation**: Add a "Prologue" quest that's shorter, lower stakes, teaches mechanics. Or: trust itch.io players to figure it out (they often do).

### 6. Art Requirements
Even lo-fi needs:
- 5 faction icons
- ~20 card illustrations (ship silhouettes)
- ~15 NPC portraits (can be minimal/symbolic)
- UI elements (dice, stats icons)

**Mitigation**: ASCII/text-only version first. Or: commission a small asset pack. Itch.io players are forgiving of minimal art if gameplay is good.

### 7. Untested Balance
The 10-point card budget *sounds* balanced, but:
- Is Agility 7 too strong? (always strikes first)
- Is Armor 7 too strong? (almost never hit)
- Are Interceptors (high agility, low armor) viable?

**Mitigation**: This is what the itch.io release is FOR. Get feedback. Adjust numbers.

---

## What's Missing for MVP

| Missing Element | Priority | Notes |
|-----------------|----------|-------|
| Tutorial/onboarding | High | At minimum, a "how to play" screen |
| Save/load system | High | Players need to quit and resume |
| Settings screen | Medium | Volume, text speed, accessibility |
| Sound design | Medium | Even minimal audio adds polish |
| Card art direction | Medium | Silhouettes vs detailed? |
| Edge case handling | Low | What if player has 0 cards? |
| Achievements | Low | Nice for replayability but not MVP |

---

## How It Will Feel

### Strengths (what players will praise)
- "The choices actually matter"
- "I want to replay and try different alliances"
- "The writing is good—NPCs feel distinct"
- "Simple combat but meaningful prep decisions"
- "Endings felt earned, not arbitrary"

### Weaknesses (what players will critique)
- "Combat is just watching dice rolls"
- "I got unlucky and lost a battle I should have won"
- "Too much reading between fights"
- "I wanted more cards / more quests" (good problem to have)
- "No way to affect battle once it starts"

---

## Comparison to Similar Games

| Game | Similarity | Space Fortress Advantage |
|------|------------|-------------------------|
| Slay the Spire | Card-based combat | Narrative integration, no deckbuilding complexity |
| 80 Days | Narrative choices with consequences | Tactical combat layer adds gameplay |
| FTL | Space fleet management | Focused scope, no real-time pressure |
| Reigns | Binary choices, resource management | Deeper choices (3 options), transparent consequences |
| Banner Saga | Narrative + tactical combat | Simpler combat, faster pace |

Space Fortress occupies a niche: **narrative-driven tactical game with transparent consequences**. Not as complex as Banner Saga, not as simple as Reigns. That's a viable itch.io space.

---

## Recommendation

### Ship it (after implementation).

The design is solid for MVP. The scope is appropriate. The risks are known and manageable.

**Suggested implementation order:**
1. Core loop (one quest, combat working)
2. All 3 quests playable
3. Save/load
4. Polish pass (UI, transitions)
5. Onboarding
6. Release to itch.io for feedback

**What feedback to seek:**
- Does combat feel engaging or passive?
- Is the writing compelling or tedious?
- Are choices meaningful or obvious?
- What made you want to replay (or not)?
- Where did you get confused?

The itch.io release is not the end—it's the beginning of learning what works.

---

## Final Assessment

| Criteria | Rating | Notes |
|----------|--------|-------|
| Design completeness | ✓✓✓✓ | Solid, well-documented |
| Scope appropriateness | ✓✓✓✓ | Right size for MVP |
| Core loop clarity | ✓✓✓✓ | Event model is excellent |
| Risk identification | ✓✓✓ | Combat passivity is known risk |
| Fun potential | ✓✓✓ | Depends on execution |
| Differentiation | ✓✓✓✓ | Clear hook, underserved niche |
| Implementation feasibility | ✓✓✓ | Achievable by small team |

**Bottom line**: This design is ready for implementation. Build it, ship it, learn from it.
