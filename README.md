# Space Fortress

A tactical card game of diplomacy and survival in a forgotten corner of the galaxy.

## The Story

You are the captain of the *Debt Collector*, a salvage vessel operating in the Shattered Reach - a lawless region filled with ancient ruins, desperate factions, and dangerous opportunities. With your ship's AI companion ARIA and a ragtag crew, you'll navigate treacherous alliances, make impossible choices, and fight for survival in a universe where every faction has its own agenda.

## How to Play

### Starting the Game

```bash
npm install
npm run dev
```

Open your browser to `http://localhost:1420` to begin.

### Game Flow

1. **Quest Hub** - Accept missions from various factions
2. **Narrative** - Face dilemmas with multiple NPC perspectives
3. **Choice Consequence** - See the immediate effects of your decision
4. *(Repeat steps 2-3 for each dilemma in the quest)*
5. **Alliance** - Choose faction allies (or go it alone) if battle is required
6. **Card Pool** - Select 5 ships for battle from your fleet
7. **Deployment** - Arrange your ships in combat order
8. **Battle** - Watch automated combat unfold
9. **Battle Consequence** - See the results of combat
10. **Quest Summary** - Review your journey and choices
11. *(Return to Quest Hub for more quests)*

### The Factions

| Faction | Philosophy | Specialty |
|---------|------------|-----------|
| **Ironveil Combine** | Order through industry | Heavy armor, siege weapons |
| **Sundered Oath** | Profit above all | Balanced, adaptable |
| **Void Wardens** | Preserve the old ways | High agility, hit-and-run |
| **Crimson Accord** | Power through unity | Glass cannons, high damage |
| **Outer Rim Collective** | Freedom at any cost | Tank-heavy, defensive |

### Reputation System

Your choices affect how factions view you:

| Status | Reputation | Effect |
|--------|------------|--------|
| Allied | 50+ | Access to elite cards, favorable terms |
| Friendly | 20 to 49 | Standard alliance options |
| Neutral | -19 to 19 | Limited cooperation |
| Unfriendly | -49 to -20 | Hostile encounters more likely |
| Hostile | -50 or below | Faction becomes an enemy |

### Card Combat

Each ship card has three stats:

- **Attack** - Damage dealt per round
- **Armor** - Damage absorbed before taking hull damage
- **Agility** - Determines strike order (higher strikes first)

Combat is automated and proceeds round-by-round:
1. Both sides reveal cards for the round
2. Higher agility strikes first
3. Damage is calculated (attack minus defender's armor)
4. Ships with 0 or less health are destroyed
5. Win the round by destroying your opponent's ship

Win 3 of 5 rounds to claim victory.

### Making Choices

Every dilemma presents multiple perspectives from NPCs with their own agendas. Consider:

- **Immediate consequences** - Bounty, cards, reputation changes
- **Long-term effects** - Which factions will remember your choice?
- **Hidden costs** - Some choices trigger battles or lock out options

There's no "right" answer - only the captain you choose to become.

## Your Crew

**ARIA** - Your ship's AI. Provides tactical analysis and historical context. Speaks in precise, data-driven observations.

**Jax** - Your first mate. Pragmatic and focused on crew survival. Often disagrees with risky ventures.

## Endings

Your choices throughout the game determine your final fate:

- **Faction Commander** - Become a leader within a faction you've championed
- **Independent Broker** - Balance all factions as a neutral power
- **Opportunist** - Profit from chaos, trusted by none
- **Conqueror** - Dominate through force, leaving enemies in your wake
- **Negotiator** - Bring unlikely peace through careful diplomacy

## Tips for New Captains

1. **Balance your fleet** - Mix high-agility strikers with armored tanks
2. **Watch reputation** - Going hostile with a faction closes doors permanently
3. **Read the NPCs** - Their perspectives often hint at hidden consequences
4. **Alliance cards matter** - Faction allies provide powerful temporary ships
5. **Deployment order counts** - Lead with ships that counter enemy strengths

## Development

For technical documentation and contribution guidelines, see:
- [Framework Development Guide](docs/FRAMEWORK-DEVELOPMENT-GUIDE.md)
- [Development Plan](docs/DEVELOPMENT-PLAN.md)
- [Screen Designs](docs/design/screens/SCREENS.md)

### Quick Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests (Playwright) |

## Tech Stack

Built with Svelte 5, SvelteKit, TypeScript, and an event-sourced architecture for perfect save/load and branching narratives.

## License

MIT
