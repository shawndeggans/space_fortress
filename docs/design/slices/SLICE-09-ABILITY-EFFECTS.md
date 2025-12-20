# Slice 09: Ability Effects

## Pattern: Automation

Ability effects are triggered automatically when certain game events occur. The ability system listens for trigger events and generates effect events.

## Trigger → Effect Flow

```
{SHIP_DEPLOYED} → [AbilityProcessor: onDeploy] → {ABILITY_TRIGGERED}, {Effect Events}
{SHIP_ATTACKED} → [AbilityProcessor: onAttack/onDefend] → {ABILITY_TRIGGERED}, {Effect Events}
{SHIP_DESTROYED} → [AbilityProcessor: onDestroyed] → {ABILITY_TRIGGERED}, {Effect Events}
{TACTICAL_TURN_STARTED} → [AbilityProcessor: startTurn] → {ABILITY_TRIGGERED}, {Effect Events}
{TACTICAL_TURN_ENDED} → [AbilityProcessor: endTurn] → {ABILITY_TRIGGERED}, {Effect Events}
{ABILITY_ACTIVATED} → [AbilityProcessor: activated] → {Effect Events}
```

## Events

### Trigger Events (Input)
| Event | Triggers |
|-------|----------|
| `{SHIP_DEPLOYED}` | `onDeploy` abilities |
| `{SHIP_ATTACKED}` | `onAttack` (attacker) and `onDefend` (defender) abilities |
| `{SHIP_DESTROYED}` | `onDestroyed` abilities |
| `{TACTICAL_TURN_STARTED}` | `startTurn` abilities |
| `{TACTICAL_TURN_ENDED}` | `endTurn` abilities |
| `{ABILITY_ACTIVATED}` | Manual ability effects |

### Effect Events (Output)
| Event | Description |
|-------|-------------|
| `{ABILITY_TRIGGERED}` | Records that an ability was triggered |
| `{DAMAGE_DEALT}` | Damage from ability effects |
| `{FLAGSHIP_DAMAGED}` | Direct flagship damage |
| `{STATUS_APPLIED}` | Status effect applied (stun, shield, etc.) |
| `{STATUS_EXPIRED}` | Status effect removed |
| `{ENERGY_GAINED}` | Energy from ability |
| `{ENERGY_SPENT}` | Energy cost for ability |
| `{TACTICAL_CARD_DRAWN}` | Draw card effect |
| `{SHIP_DESTROYED}` | If ability kills a ship |

## Ability Triggers

| Trigger | When Fired | Example Abilities |
|---------|------------|-------------------|
| `onDeploy` | Ship enters battlefield | "Diplomatic Immunity" - gain shield |
| `onAttack` | Ship declares attack | "Hull Breach" - extra damage |
| `onDefend` | Ship is attacked | "Evasive Maneuvers" - reduce damage |
| `onDestroyed` | Ship's hull reaches 0 | "Salvage Parts" - gain energy |
| `startTurn` | At start of owner's turn | "Spreading Flames" - damage all enemies |
| `endTurn` | At end of owner's turn | "Compound Interest" - gain energy |
| `activated` | Player manually activates | "Fortify" - boost defense |
| `passive` | Always active while on field | "Reckless Assault" - stat modifier |

## Effect Types

### Damage Effects
- `deal_damage`: Single target damage
- `area_damage`: All enemies or adjacent ships
- `damage_flagship`: Direct flagship damage

### Defensive Effects
- `repair`: Heal hull
- `shield`: Block damage (applied as status)
- `redirect_damage`: Reflect damage to attacker
- `repair_flagship`: Heal flagship

### Control Effects
- `stun`: Target cannot act
- `disable_ability`: Target cannot use abilities
- `force_attack`: Target must attack ally/flagship
- `taunt`: Enemies must attack this ship

### Buff/Debuff Effects
- `boost_attack` / `reduce_attack`: Modify attack stat
- `boost_defense` / `reduce_defense`: Modify defense stat
- `energy_drain`: Reduce opponent energy

### Utility Effects
- `draw_card`: Draw from deck
- `discard_card`: Force opponent to discard
- `return_to_hand`: Bounce ship to hand
- `destroy_random`: Destroy random enemy ship
- `sacrifice`: Destroy own ship for effect

## Given-When-Then Specifications

### Spec 1: onDeploy Ability Triggers
```
GIVEN a tactical battle in the playing phase
  AND a card with an onDeploy ability is in hand
WHEN the player deploys that card
THEN an ABILITY_TRIGGERED event is generated
  AND the ability's effect events are generated
```

### Spec 2: onAttack Ability Triggers
```
GIVEN a tactical battle in the playing phase
  AND a deployed ship has an onAttack ability
WHEN that ship attacks
THEN an ABILITY_TRIGGERED event is generated
  AND the ability's effect is applied
```

### Spec 3: Status Effect Duration
```
GIVEN a ship has a status effect with duration 2
WHEN the owner's turn starts
THEN the duration decreases by 1
  AND if duration reaches 0, STATUS_EXPIRED is generated
```

### Spec 4: Passive Ability Applies
```
GIVEN a ship with a passive stat-boosting ability
WHEN damage calculation occurs
THEN the passive modifier is included in the calculation
```

## Integration Points

### In Decider (Command Handlers)

**handleDeployShip:**
```typescript
// After SHIP_DEPLOYED event
const abilityEvents = processAbilities(battle, 'onDeploy', { shipId, position })
events.push(...abilityEvents)
```

**handleAttackWithShip:**
```typescript
// Before DAMAGE_DEALT
const attackerAbilities = processAbilities(battle, 'onAttack', { attackerId, targetId })
const defenderAbilities = processAbilities(battle, 'onDefend', { attackerId, targetId })
// Apply passive modifiers to damage calculation
```

**handleEndTurn:**
```typescript
// Before turn ends
const turnEndAbilities = processAbilities(battle, 'endTurn', { player })
events.push(...turnEndAbilities)
```

### In Projections

**ABILITY_TRIGGERED:**
- Record in battle log
- Update cooldowns if applicable

**STATUS_APPLIED:**
- Add to ship's statusEffects array

**STATUS_EXPIRED:**
- Remove from ship's statusEffects array

## File Structure

```
src/lib/game/
  abilityEffects.ts       # Core ability processing
  abilityEffects/
    effects.ts            # Individual effect implementations
    triggers.ts           # Trigger detection logic
    modifiers.ts          # Passive stat modifiers
    __tests__/
      abilityEffects.test.ts
```

## Priority for Initial Implementation

### Phase 1: Core Effects (MVP)
1. `deal_damage` - Single target damage
2. `repair` - Heal hull
3. `boost_attack` / `boost_defense` - Stat buffs
4. `stun` - Prevent actions

### Phase 2: Status System
1. Status effect application
2. Duration tracking
3. Status expiration

### Phase 3: Complex Effects
1. `area_damage` - AoE
2. `shield` - Damage prevention
3. `draw_card` / `discard_card`
4. Conditional effects

---

*Created: 2024-12-20*
