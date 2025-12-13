# Building and Shipping Narrative-Driven Indie Games with Event Sourcing
## Complete Implementation Guide: Citizen Sleeper-Style Games from Concept to Steam

You can build and ship a professional narrative-driven indie game using event sourcing architecture in 12-24 months as a solo developer. **The key insight: event sourcing transforms every player choice into an immutable fact, making save systems, time-travel debugging, and DLC expansions architectural givens rather than bolted-on features.** This guide provides step-by-step implementation details for transitioning from cloud architecture to game development using TypeScript, Svelte, Tauri, and SQLite—leveraging your event modeling expertise while filling the game-specific knowledge gaps.

Your existing skills in event modeling and TypeScript give you a significant advantage: the hardest architectural decisions are already familiar. The learning curve focuses on game-specific patterns (asset pipelines, player psychology, Steam integration) rather than wrestling with complex state management that trips up most developers. For a 10-hour narrative game, expect 18-24 months of development with a realistic $5,000-$20,000 budget if outsourcing art and music.

## Critical path to Steam release

The development journey breaks into distinct phases, each building on event sourcing fundamentals. **Most solo developers underestimate timeline by 3x and overestimate scope by 10x**—your cloud architecture background helps avoid this trap through disciplined scope management and incremental delivery.

Start with three months of pre-production: define your core narrative hook, create a one-page pitch focusing on the single mechanic players will repeat most, and build a walking skeleton demonstrating event sourcing with save/load functionality. This skeleton proves your architecture before investing in content creation. Use the Svelte + TypeScript + Vite + Tauri stack—Svelte's built-in reactivity maps naturally to event-driven architecture with 30-40% less boilerplate than React, while Tauri provides native desktop distribution at 10-20 MB bundle sizes versus Electron's 100+ MB.

Months 4-9 focus on vertical slice development: implement one complete chapter with polished gameplay, then test with 10-20 strangers (not friends). **This phase reveals whether your concept is actually fun**—most games die here when developers realize their idea doesn't translate to engaging gameplay. Budget 40% of total development time for this critical validation phase.

Months 10-15 shift to content creation: generate remaining story branches, character portraits, and UI elements while simultaneously building your Steam presence. Create your Steam page 6-12 months before launch, targeting **10,000+ wishlists minimum** through dev logs, GIFs on Twitter, and participation in Steam Next Fest. Chinese localization during this phase adds 15-25% revenue for a $4,000-$7,500 investment.

Final months (16-18) concentrate on polish, marketing, and Steam integration: implement achievements tied to your event system, configure Auto-Cloud saves, automate SteamPipe uploads via Docker, and create your trailer. Launch with monitoring infrastructure ready for rapid hotfixes—the first 48 hours determine your Steam algorithm trajectory.

## Event sourcing architecture for single-player games

Event sourcing for desktop games differs fundamentally from distributed microservices. **You're optimizing for local SQLite performance and save file compatibility, not distributed transactions and network partitions**. This architectural shift simplifies implementation while maintaining event sourcing's core benefits: perfect audit trails, time-travel debugging, and effortless save systems.

The decider pattern forms your core architecture: Commands (player intent) → State → Events (facts) → Store → Projections (UI). Every player action becomes a command that, when applied to current state, generates immutable events. These events rebuild game state through projection functions—pure reducers that fold event streams into queryable read models.

```typescript
// Core event sourcing types
type GameCommand = 
  | { type: 'START_GAME'; data: { playerId: string } }
  | { type: 'MAKE_CHOICE'; data: { choiceId: string; option: string } }
  | { type: 'COLLECT_ITEM'; data: { itemId: string } }

type GameEvent =
  | { type: 'GAME_STARTED'; data: { playerId: string; startedAt: string } }
  | { type: 'CHOICE_MADE'; data: { choiceId: string; option: string; timestamp: string } }
  | { type: 'MORAL_ALIGNMENT_CHANGED'; data: { delta: number; newValue: number } }

interface GameState {
  playerId: string
  currentLocation: string
  moralAlignment: number
  choicesMade: Array<{ choiceId: string; option: string }>
  inventory: string[]
}

// Decider pattern: command validation and event generation
function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    case 'MAKE_CHOICE':
      if (state.status !== 'in_progress') throw new Error('Invalid state')
      
      const events: GameEvent[] = [{
        type: 'CHOICE_MADE',
        data: { ...command.data, timestamp: new Date().toISOString() }
      }]
      
      // Business logic: choices affect moral alignment
      const delta = command.data.option === 'help' ? 25 : -25
      events.push({
        type: 'MORAL_ALIGNMENT_CHANGED',
        data: { delta, newValue: state.moralAlignment + delta }
      })
      
      return events
    default:
      throw new Error(`Unknown command: ${command.type}`)
  }
}

// Projection: events → state
function evolveState(state: GameState, event: GameEvent): GameState {
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

### SQLite event store schema optimized for games

Design your event store for fast stream reads and append-only writes. Use a single ledger table with composite indexing on `(stream_id, sequence)` to enable efficient event replay. Each player gets their own stream (e.g., `player-{userId}`), avoiding the multi-tenant complexity of backend systems.

```sql
-- Core event ledger with guaranteed ordering
CREATE TABLE events (
  event_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  stream_id TEXT NOT NULL,           -- 'player-{playerId}'
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,          -- JSON payload
  metadata TEXT,                     -- Timestamp, causation_id
  sequence INTEGER NOT NULL,         -- Monotonic within stream
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stream_id, sequence)
);

CREATE INDEX idx_events_stream ON events(stream_id, sequence);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);

-- Snapshots for performance (every 50-100 events)
CREATE TABLE snapshots (
  stream_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL,
  state_data TEXT NOT NULL,          -- JSON of GameState
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Save game metadata for UI
CREATE TABLE save_games (
  save_name TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  last_event_id TEXT NOT NULL,
  preview_data TEXT NOT NULL,        -- Location, stats for save UI
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Performance optimization strategy**: Implement snapshotting every 50-100 events to avoid replaying thousands of events on load. When reconstructing state, load the latest snapshot then replay events since that snapshot—reducing load times from seconds to milliseconds. SQLite handles 30,000+ transactions/second on modern hardware, more than sufficient for single-player games where typical sessions generate 100-1,000 events.

Enable SQLite's Write-Ahead Logging mode for concurrent reads during writes: `PRAGMA journal_mode=WAL`. Tune cache size for game workloads: `PRAGMA cache_size=10000`. Batch event writes in single transactions to minimize I/O overhead—writing 100 events in one transaction outperforms 100 individual writes by 50-100x.

### Event modeling methodology for game mechanics

Map game systems to event model boards using the 7-step process: brainstorm state-changing events, arrange chronologically, identify commands triggering events, define projections for UI queries, and organize into bounded contexts (inventory, combat, dialogue, progression). **Each game system becomes a distinct aggregate with its own event stream**.

For narrative games, model dialogue choices as commands that generate ChoiceMade events. These events cascade into secondary effects: MoralAlignmentChanged, RelationshipUpdated, QuestProgressUpdated. Business rules live in the decide function, keeping game logic testable and separate from UI concerns.

Design events to represent domain concepts, not technical implementation. Use `PlayerDefeatedBoss` not `HealthSetToZero`. Use `DialogueCompleted` not `NodeIndexIncremented`. This domain focus makes event streams readable months later when adding DLC content or debugging player-reported issues.

Event versioning uses weak schema patterns: never rename fields, never change semantic meaning, only add optional fields with defaults. When DLC adds new event fields, old saves load successfully by applying defaults to missing fields. Version your save files explicitly, tracking which DLC was active when the save was created.

```typescript
// Base game event
interface ItemCollected {
  type: 'ITEM_COLLECTED'
  data: {
    itemId: string
    quantity: number
    timestamp: string
  }
}

// DLC extension (backward compatible)
interface ItemCollectedV2 {
  type: 'ITEM_COLLECTED'
  data: {
    itemId: string
    quantity: number
    timestamp: string
    // DLC fields (optional with defaults)
    dlcSource?: string            // null if not DLC item
    enchantmentLevel?: number     // 0 if base game
    rarity?: 'common' | 'rare' | 'epic'  // 'common' if undefined
  }
}

// Loading handles missing fields gracefully
function loadEvent(json: any): ItemCollectedV2 {
  return {
    type: 'ITEM_COLLECTED',
    data: {
      itemId: json.itemId,
      quantity: json.quantity ?? 1,
      timestamp: json.timestamp,
      dlcSource: json.dlcSource ?? null,
      enchantmentLevel: json.enchantmentLevel ?? 0,
      rarity: json.rarity ?? 'common'
    }
  }
}
```

## Frontend implementation with Svelte and Tauri

Svelte wins over React for event-sourced games through built-in reactivity, simpler state management, and smaller bundle sizes. **Svelte stores map naturally to event streams with less boilerplate**—no useEffect dependencies, no useMemo optimization, no context provider nesting. The reactive `$store` syntax automatically subscribes to state changes, updating UI when projections rebuild from new events.

```typescript
// Svelte store wrapping event sourcing logic
import { writable } from 'svelte/store'
import { SQLiteEventStore } from './eventStore'
import { decide, evolveState, getInitialState } from './game'

const eventStore = new SQLiteEventStore()
await eventStore.initialize()

const gameStateStore = writable<GameState>(getInitialState())
const playerId = 'player-1'

export const gameState = {
  subscribe: gameStateStore.subscribe,
  
  async handleCommand(command: GameCommand) {
    const currentState = await this.getCurrentState()
    const events = decide(command, currentState)
    
    // Persist events
    for (const event of events) {
      await eventStore.appendEvent(`player-${playerId}`, event)
    }
    
    // Update projection
    const newState = events.reduce(evolveState, currentState)
    gameStateStore.set(newState)
  },
  
  async getCurrentState(): Promise<GameState> {
    const events = await eventStore.getEvents(`player-${playerId}`)
    return events.reduce(evolveState, getInitialState())
  },
  
  async saveGame(saveName: string) {
    await eventStore.saveGame(playerId, saveName)
  },
  
  async loadGame(saveName: string) {
    const { events } = await eventStore.loadGame(saveName)
    const state = events.reduce(evolveState, getInitialState())
    gameStateStore.set(state)
  }
}
```

### Component architecture for narrative UI

Structure your UI around diegetic (in-world) and non-diegetic (overlay) elements. Dialogue trees, character portraits, and choice buttons form the core interaction layer—keep these components pure, receiving state via props and emitting commands via events. Avoid direct database access in UI components; all state changes flow through the event sourcing pipeline.

```svelte
<!-- GameScreen.svelte -->
<script lang="ts">
  import { gameState } from '../stores/gameStore'
  import ChoiceButton from './ChoiceButton.svelte'
  
  async function makeChoice(option: string) {
    await gameState.handleCommand({
      type: 'MAKE_CHOICE',
      data: { choiceId: 'moral_dilemma_1', option }
    })
  }
</script>

<div class="narrative-container">
  <div class="scene">
    <p class="narration">A wounded stranger lies before you. Help them?</p>
    <p class="stats">Moral Alignment: {$gameState.moralAlignment}</p>
  </div>
  
  {#if $gameState.choicesMade.length === 0}
    <div class="choices">
      <ChoiceButton on:click={() => makeChoice('help')}>
        Offer assistance
      </ChoiceButton>
      <ChoiceButton on:click={() => makeChoice('ignore')}>
        Walk away
      </ChoiceButton>
    </div>
  {:else}
    <p class="result">
      {$gameState.choicesMade[0].option === 'help' 
        ? 'They smile weakly as you bandage their wounds. (+25 Alignment)'
        : 'Their cries fade as you leave. (-25 Alignment)'}
    </p>
  {/if}
</div>
```

Use CSS animations for UI transitions—GPU-accelerated transforms and opacity changes outperform JavaScript-driven animations for 2D interfaces. Implement dialogue fade-ins with `@keyframes`, hover effects with `transition`, and loading states with skeleton screens. Reserve JavaScript animations for complex sequences requiring precise timing or physics simulation.

Asset loading strategy for narrative games: preload current scene plus next 2-3 scenes in background. Implement an AssetManager with in-memory caching using Map data structures. Load assets on-demand when entering new locations, displaying loading screens only if assets aren't cached. For games with 100+ character portraits, consider lazy loading with progressive enhancement—show placeholder while loading full resolution.

### Tauri integration and SQLite persistence

Tauri wraps your web-based game in a native desktop shell, providing OS integration and database access. The `tauri-plugin-sql` bridges your TypeScript frontend to embedded SQLite, enabling type-safe queries with automatic migrations.

```rust
// src-tauri/src/lib.rs
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create event store tables",
            sql: include_str!("../migrations/001_event_store.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:game.db", migrations)
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

```typescript
// Frontend database access
import Database from '@tauri-apps/plugin-sql'

export class SQLiteEventStore {
  private db: Database | null = null

  async initialize() {
    this.db = await Database.load('sqlite:game.db')
    // Enable Write-Ahead Logging for better concurrency
    await this.db.execute('PRAGMA journal_mode=WAL')
    await this.db.execute('PRAGMA cache_size=10000')
  }

  async appendEvent(streamId: string, event: Event): Promise<string> {
    const lastSeq = await this.getLastSequence(streamId)
    const result = await this.db!.execute(
      `INSERT INTO events (stream_id, event_type, event_data, sequence, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [streamId, event.type, JSON.stringify(event.data), lastSeq + 1, 
       JSON.stringify({ timestamp: new Date().toISOString() })]
    )
    return result.lastInsertId.toString()
  }

  async getEvents(streamId: string): Promise<Event[]> {
    const rows = await this.db!.select<StoredEvent[]>(
      'SELECT * FROM events WHERE stream_id = ? ORDER BY sequence ASC',
      [streamId]
    )
    return rows.map(row => ({
      type: row.event_type,
      data: JSON.parse(row.event_data)
    }))
  }
}
```

**Critical Tauri configuration** in `tauri.conf.json`: set bundle identifier, configure window properties for game UX (disable maximize, set fixed aspect ratio for pixel-perfect rendering), and declare database permissions. Bundle size optimization uses LTO (link-time optimization) and strip symbols in release builds—expect 10-20 MB total including assets for typical narrative games.

## Asset creation pipeline with AI and automation

Generate character portraits and backgrounds using free Stable Diffusion services—Hugging Face Spaces, Google Colab, or local ComfyUI installations provide production-quality results without subscription fees. **Prompt engineering ensures consistent art style**: define a master prompt template specifying style, lighting, and technical parameters, then iterate with character-specific details.

```python
# Master style prompt for character portraits
BASE_STYLE = """
high quality digital painting, cyberpunk aesthetic, dramatic lighting,
character portrait, detailed facial features, muted color palette,
trending on artstation, 4k, professional concept art
"""

def generate_character_prompt(name: str, description: str, emotion: str) -> str:
    return f"{BASE_STYLE}, {description}, {emotion} expression, looking at viewer"

# Examples
prompts = {
    'detective_neutral': generate_character_prompt(
        'Detective', 
        'middle-aged woman in trench coat, cybernetic eye implant',
        'neutral'
    ),
    'detective_angry': generate_character_prompt(
        'Detective',
        'middle-aged woman in trench coat, cybernetic eye implant', 
        'angry'
    )
}
```

Batch processing workflow using Python automates asset standardization. Create scripts that resize portraits to standard dimensions (512x512 for characters, 1920x1080 for backgrounds), apply consistent filters, and optimize file sizes. Use Pillow for image manipulation and opencv-python for advanced processing like edge detection or style transfer.

```python
# batch_process_portraits.py
from PIL import Image
import os
from pathlib import Path

def process_portrait(input_path: Path, output_path: Path):
    """Standardize character portraits for game engine"""
    with Image.open(input_path) as img:
        # Resize to standard dimensions
        img = img.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Convert to RGB (remove alpha if present)
        if img.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', img.size, (0, 0, 0))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img, mask=img.split()[1])
            img = background
        
        # Apply sharpening filter
        from PIL import ImageFilter
        img = img.filter(ImageFilter.SHARPEN)
        
        # Optimize and save
        img.save(output_path, 'PNG', optimize=True, quality=95)

def batch_process(source_dir: str, output_dir: str):
    """Process all images in directory"""
    source = Path(source_dir)
    output = Path(output_dir)
    output.mkdir(exist_ok=True)
    
    for img_path in source.glob('*.png'):
        out_path = output / f"{img_path.stem}_processed.png"
        process_portrait(img_path, out_path)
        print(f"Processed: {img_path.name} → {out_path.name}")

if __name__ == '__main__':
    batch_process('./raw_portraits', './game_assets/characters')
```

### Asset organization and version control

Structure assets by type and location, maintaining separate directories for raw sources and processed game assets. Use descriptive naming conventions that encode metadata: `character_detective_neutral_512.png` clearly identifies content, character, emotional state, and resolution. Track binary assets with Git LFS (Large File Storage) to avoid bloating repository size—images, audio, and video files remain referenced by hash rather than stored directly.

```
/Assets
  /Raw                        # Unprocessed sources
    /Characters
      /Detective
        detective_neutral_4k.png
        detective_angry_4k.png
    /Backgrounds
      /Locations
        city_street_day.png
  /Processed                  # Game-ready assets
    /Characters
      /Detective
        character_detective_neutral_512.png
        character_detective_angry_512.png
    /Backgrounds
      background_city_street_1920x1080.png
  /Spritesheets              # Generated atlases
    characters_atlas.png
    characters_atlas.json
```

Create asset manifest files tracking dependencies and metadata. When DLC adds new characters, append to manifests without modifying base game files—enabling independent loading and unloading. Version manifests alongside code to ensure asset-code synchronization.

## Internationalization architecture for English and Chinese

Implement i18n from day one using `@nanostores/i18n` for Svelte projects—its 1 KB size and zero dependencies make it ideal for Tauri applications. Structure translation files by feature module rather than single monolithic file, enabling lazy loading of translation data for large games.

```typescript
// src/lib/i18n/index.ts
import { createI18n, localeFrom, browser } from '@nanostores/i18n'
import { persistentAtom } from '@nanostores/persistent'

export const locale = persistentAtom<string>('locale', 'en')

export const i18n = createI18n(locale, {
  async get(code) {
    // Lazy load translation files
    return await import(`./locales/${code}/index.json`)
  }
})

// Detect system locale with fallback chain
export async function initializeLocale() {
  // 1. Check Steam language (if available)
  try {
    const steamLang = await invoke('get_steam_language')
    const langMap = { 'schinese': 'zh-CN', 'english': 'en' }
    locale.set(langMap[steamLang] || 'en')
    return
  } catch {}
  
  // 2. Check browser/OS locale
  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    locale.set('zh-CN')
  } else {
    locale.set('en')
  }
}
```

**Chinese language technical requirements**: Use Noto Sans SC (Simplified Chinese) or Source Han Sans for font rendering—these open-source fonts provide comprehensive glyph coverage at 5-10 MB per weight. Set `lang="zh-CN"` attribute on HTML elements to ensure browsers select correct CJK font variants—without this, browsers may render Chinese characters with Japanese glyph shapes.

SQLite handles Chinese characters perfectly with UTF-8 encoding (default). No special configuration needed—TEXT columns store Unicode strings natively. Console display issues on Windows CMD require `chcp 65001` to set UTF-8 code page, but this doesn't affect Tauri applications which render text through web views.

Handle text length differences in UI design: Chinese text averages 30-50% fewer characters than English for equivalent meaning, but requires larger font sizes for legibility. Design flexible UI containers with min-width properties and overflow handling. Use CSS `word-break: keep-all` and `overflow-wrap: anywhere` for proper Chinese line breaking—unlike English, Chinese has no spaces between words so line breaks can occur between any characters.

```css
/* Language-specific text handling */
:lang(zh-CN) {
  font-family: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-size: 1.1em;  /* Slightly larger for CJK legibility */
  word-break: keep-all;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

:lang(en) {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  word-break: normal;
  overflow-wrap: break-word;
  line-height: 1.5;
}

/* Flexible button sizing for translation variance */
.choice-button {
  padding: 0.5em 1.5em;
  min-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Translation workflow and tooling

For solo developers, use machine translation during development for UI testing, hire professional translators for release. DeepL provides highest quality machine translation for Chinese at $0.02 per 1,000 characters (API pricing). **Budget $4,000-$7,500 for professional Chinese translation** of 50,000-word narrative game—expect 15-25% revenue increase from Chinese market.

Integrate Gridly or Lokalise for translation management if working with professional translators. These platforms provide visual context, character limits, and linguistic QA tools specifically designed for game content. Export strings with context metadata: character personality, scene mood, maximum UI length, branching consequences.

```json
// Translation file with context metadata
{
  "dialogue": {
    "npc_merchant_greeting_first": {
      "en": "Welcome, traveler! First time in our market?",
      "zh": "欢迎，旅行者！第一次来我们的市场吗？",
      "_context": {
        "speaker": "Merchant (friendly, informal)",
        "scene": "Market entrance, daytime",
        "max_length": 60,
        "variables": null
      }
    },
    "quest_accept_confirm": {
      "en": "You accepted the quest: {questName}",
      "zh": "你接受了任务：{questName}",
      "_context": {
        "ui_element": "Toast notification",
        "max_length": 40,
        "variables": ["questName"]
      }
    }
  }
}
```

## Tauri packaging and multi-platform distribution

Configure Tauri for Windows, macOS, and Linux builds with platform-specific optimizations. Set bundle identifiers, icons, and signing certificates in `tauri.conf.json`. **Code obfuscation in Tauri provides minimal protection**—JavaScript/TypeScript source is visible in app bundle, but this rarely matters for narrative games where story content is the asset worth protecting, not code.

```json
{
  "identifier": "com.yourstudio.narrativegame",
  "productName": "Narrative Game",
  "version": "1.0.0",
  "bundle": {
    "active": true,
    "targets": ["msi", "dmg", "deb", "appimage"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    },
    "macOS": {
      "entitlements": null,
      "hardenedRuntime": true
    }
  }
}
```

**Cross-platform build workflow**: Develop on your primary OS, use GitHub Actions for automated builds on all three platforms. Windows requires EV Code Signing certificate ($300-$400/year) to avoid SmartScreen warnings. macOS requires Apple Developer account ($99/year) and notarization. Linux has no signing requirements.

```yaml
# .github/workflows/build.yml
name: Build Tauri App
on: [push]

jobs:
  build:
    strategy:
      matrix:
        platform: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 18 }
      - run: npm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
```

Bundle size optimization through Cargo profile tuning: enable LTO, optimize for size, strip debug symbols. Typical narrative game bundles: 15-30 MB including assets. Use asset streaming for games exceeding 100 MB—load base assets at launch, stream DLC content on-demand.

## Steam integration and deployment automation

Integrate Steamworks SDK via steamworks-rs Rust crate, exposing functionality to frontend through Tauri commands. **Steam overlay currently broken in Tauri**—workaround by manually invoking overlay functions or accepting limitation. Most narrative games don't rely heavily on overlay features.

```rust
// src-tauri/src/steam.rs
use steamworks::Client;

#[tauri::command]
fn unlock_achievement(
    achievement: String, 
    client: tauri::State<Client>
) -> Result<bool, String> {
    client.user_stats().set_achievement(&achievement);
    client.user_stats().store_stats()
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_steam_language(client: tauri::State<Client>) -> String {
    client.apps().current_game_language()
}

pub fn init_steam() -> Result<Client, Box<dyn std::error::Error>> {
    let (client, single) = Client::init()?;
    Ok(client)
}
```

```typescript
// Frontend Steam integration
import { invoke } from '@tauri-apps/api/tauri'

export async function unlockAchievement(id: string) {
  try {
    await invoke('unlock_achievement', { achievement: id })
  } catch (error) {
    console.error('Failed to unlock achievement:', error)
  }
}

// Tie achievements to event sourcing
export function processEventsForAchievements(events: GameEvent[]) {
  const choiceCount = events.filter(e => e.type === 'CHOICE_MADE').length
  if (choiceCount >= 100) {
    unlockAchievement('ACH_100_CHOICES')
  }
  
  const alignment = events
    .filter(e => e.type === 'MORAL_ALIGNMENT_CHANGED')
    .reduce((sum, e) => sum + e.data.delta, 0)
  if (alignment >= 100) {
    unlockAchievement('ACH_PARAGON')
  }
}
```

### Steam Cloud saves and Auto-Cloud configuration

Use Auto-Cloud for automatic save file synchronization—requires zero code, just configuration in Steamworks dashboard. Point Auto-Cloud at your SQLite database location with wildcard pattern: `WinAppDataLocalLow/CompanyName/GameName/{64BitSteamID}/*.db`. Set cross-platform root overrides for macOS and Linux paths.

Before cloud sync, optimize database: execute `PRAGMA journal_mode=DELETE; VACUUM;` to compact file size and ensure compatibility. Auto-Cloud has 200 MB per-user quota—more than sufficient for event sourced save files which typically range 1-10 MB even for 100-hour playthroughs.

Manual Cloud API provides more control but requires implementation: track which files changed, upload deltas, handle conflicts. For most indie games, Auto-Cloud suffices. Reserve manual implementation for multiplayer or games requiring sophisticated conflict resolution.

### SteamPipe automation and deployment pipeline

Automate Steam uploads using Docker and SteamPipe CLI. Create build scripts defining app configuration, depot mapping, and content directories. Store in version control alongside code for reproducible deployments.

```vdf
// scripts/app_build.vdf
"appbuild"
{
  "appid" "YOUR_APP_ID"
  "desc" "Build description"
  "buildoutput" "./output"
  "contentroot" "./dist"
  "setlive" "default"
  "preview" "0"
  "depots"
  {
    "YOUR_DEPOT_ID"
    {
      "FileMapping"
      {
        "LocalPath" "*"
        "DepotPath" "."
        "recursive" "1"
      }
    }
  }
}
```

```bash
#!/bin/bash
# deploy.sh - Automated Steam deployment
set -e

# Build game
npm run build
npm run tauri build

# Copy artifacts to content directory
mkdir -p ./dist
cp -r src-tauri/target/release/bundle/msi/*.msi ./dist/

# Upload to Steam via Docker
docker run --rm -it \
  -v "$(pwd)/scripts:/scripts" \
  -v "$(pwd)/dist:/dist" \
  -e STEAM_USER="$STEAM_USER" \
  -e STEAM_PASSWORD="$STEAM_PASSWORD" \
  cm2network/steampipe \
  +login "$STEAM_USER" "$STEAM_PASSWORD" \
  +run_app_build /scripts/app_build.vdf \
  +quit
```

**Beta branch workflow**: Upload patches to beta branch first, test with community, promote to default branch after validation. Set branch passwords to limit access during testing. This workflow enables rapid iteration—hotfixes deploy within hours rather than days.

### Marketing strategy and pricing

Price narrative indie games at $14.99-$19.99 for Western markets, ¥58-78 for China (50-60% of USD price). Launch with 10-20% discount to maximize algorithm momentum. Plan 30-50% discounts during Steam seasonal sales.

**Timeline for 10,000+ wishlists** (minimum viable launch):
- 12-18 months before launch: Create Steam page, start weekly dev log
- 6-12 months: Announce game, post GIFs to Twitter/Reddit, start Discord
- 3-6 months: Release demo, participate in Steam Next Fest (provides 2,000-5,000 wishlists for quality demos), pitch to publishers and press
- 1-3 months: Set launch date, intensify marketing, contact streamers
- Launch week: Monitor reviews, engage community, prepare rapid hotfixes

Target 1,000-2,000 launch sales from 10,000 wishlists (10-20% conversion typical). First-week performance determines Steam algorithm treatment—high conversion rates trigger additional featuring.

Chinese market strategy: Publish to global Steam with Chinese localization rather than official Steam China initially. Steam China requires government ISBN approval (12-24 months, requires Chinese publisher partner), affecting only 100+ games versus 50,000+ on global Steam. Chinese players access global Steam via VPN or direct download—localized store page and language support sufficient to capture this market.

## DLC architecture patterns

Structure DLC as separate module extending base game without modifying core code. Each DLC defines additional event types, handlers, and assets loaded conditionally based on ownership. **Event schema versioning enables DLC compatibility**: base game events never change, DLC adds optional fields with defaults.

```typescript
// Base game event
interface QuestCompleted {
  type: 'QUEST_COMPLETED'
  data: {
    questId: string
    rewardGold: number
    timestamp: string
  }
}

// DLC extends with optional fields
interface QuestCompletedWithDLC extends QuestCompleted {
  data: QuestCompleted['data'] & {
    dlcSource?: string        // null if base game quest
    dlcRewardItem?: string    // null if no DLC reward
    factionReputation?: number // 0 if base game
  }
}

// Loading logic handles both versions
function loadQuestEvent(json: any): QuestCompletedWithDLC {
  return {
    type: 'QUEST_COMPLETED',
    data: {
      questId: json.questId,
      rewardGold: json.rewardGold ?? 0,
      timestamp: json.timestamp ?? new Date().toISOString(),
      dlcSource: json.dlcSource ?? null,
      dlcRewardItem: json.dlcRewardItem ?? null,
      factionReputation: json.factionReputation ?? 0
    }
  }
}
```

### DLC content loading and save compatibility

Implement feature flags checking DLC ownership before loading content. Store DLC ownership state in save files, gracefully degrading when DLC removed—replace DLC items with base game equivalents, skip DLC-only events during replay.

```typescript
// DLC manager
class DLCManager {
  private installedDLC = new Set<string>()
  
  async initialize() {
    // Check Steam DLC ownership
    const dlcs = ['expansion_1', 'cosmetic_pack']
    for (const dlcId of dlcs) {
      const owned = await invoke('check_dlc_owned', { dlcId })
      if (owned) this.installedDLC.add(dlcId)
    }
  }
  
  hasDLC(dlcId: string): boolean {
    return this.installedDLC.has(dlcId)
  }
  
  // Load DLC events conditionally
  async loadDLCContent(dlcId: string) {
    if (!this.hasDLC(dlcId)) return
    
    const dlcModule = await import(`./dlc/${dlcId}/index.js`)
    dlcModule.registerEventHandlers()
    await this.loadDLCAssets(dlcId)
  }
}

// Graceful degradation when loading saves
function reconstructStateWithDLC(events: GameEvent[], dlcManager: DLCManager) {
  return events.reduce((state, event) => {
    // Check if event requires DLC
    if (event.data.dlcSource && !dlcManager.hasDLC(event.data.dlcSource)) {
      // Replace DLC items with base game equivalents
      return applyEventWithFallback(state, event)
    }
    return evolveState(state, event)
  }, getInitialState())
}
```

**Steam DLC configuration**: Create DLC App ID under base game's "Associated Packages" in Steamworks dashboard. Add depot to base game (not DLC app) associating with DLC ID. No additional $100 Steam Direct fee for DLC. Check ownership via `client.apps().is_dlc_installed(AppId(dlc_id))`.

Citizen Sleeper's episodic model provides proven template: release free episodic DLC post-launch maintaining community engagement for 10+ months. Each episode expanded word count by 30-40%, kept game relevant in Steam algorithm, and built goodwill for future paid DLC. Design base game intentionally limited in scope, planning expansion vectors during pre-production.

## Walking skeleton implementation guide

Build a 30-second playable demo demonstrating core architecture: one location, one character, one meaningful choice, save/load functionality. This skeleton proves event sourcing patterns work before investing in content creation. **Estimated completion: 8-10 hours for experienced TypeScript developer**.

### Phase 1: Project setup (1 hour)

```bash
# Create Tauri + Svelte project
npm create tauri-app@latest narrative-skeleton -- --template svelte-ts

cd narrative-skeleton

# Add SQLite plugin
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
cd ..

npm install
```

Configure Tauri plugin in `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create event store",
            sql: include_str!("../migrations/001_events.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:game.db", migrations)
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Create migration file `src-tauri/migrations/001_events.sql` with schema from earlier section.

### Phase 2: Event store implementation (2 hours)

Create `src/lib/eventStore/SQLiteEventStore.ts` with implementation from frontend section. Define types in `src/lib/game/types.ts`:

```typescript
export type GameCommand = 
  | { type: 'START_GAME'; data: { playerId: string; timestamp: string } }
  | { type: 'MAKE_CHOICE'; data: { choiceId: string; option: string } }
  | { type: 'SAVE_GAME'; data: { saveName: string } }
  | { type: 'LOAD_GAME'; data: { saveName: string } }

export type GameEvent =
  | { type: 'GAME_STARTED'; data: { playerId: string; startedAt: string } }
  | { type: 'LOCATION_ENTERED'; data: { locationId: string; enteredAt: string } }
  | { type: 'CHOICE_MADE'; data: { choiceId: string; option: string; madeAt: string } }
  | { type: 'MORAL_ALIGNMENT_CHANGED'; data: { delta: number; newValue: number } }

export interface GameState {
  playerId: string
  currentLocation: string
  moralAlignment: number
  choicesMade: Array<{ choiceId: string; option: string }>
  status: 'not_started' | 'in_progress' | 'completed'
}
```

Implement projection and decider in `src/lib/game/projections.ts` and `src/lib/game/decider.ts` using examples from earlier sections.

### Phase 3: Svelte integration (2 hours)

Create game store wrapping event sourcing logic in `src/lib/stores/gameStore.ts`. Build UI components:

```svelte
<!-- src/components/GameScreen.svelte -->
<script lang="ts">
  import { gameState } from '../lib/stores/gameStore'
  
  let saveName = 'quicksave'
  
  async function startGame() {
    await gameState.handleCommand({
      type: 'START_GAME',
      data: { playerId: 'player-1', timestamp: new Date().toISOString() }
    })
  }
  
  async function makeChoice(option: string) {
    await gameState.handleCommand({
      type: 'MAKE_CHOICE',
      data: { choiceId: 'moral_dilemma', option }
    })
  }
  
  async function save() {
    await gameState.saveGame(saveName)
  }
  
  async function load() {
    await gameState.loadGame(saveName)
  }
</script>

<div class="game-container">
  <h1>The Walking Skeleton</h1>
  
  {#if $gameState.status === 'not_started'}
    <button on:click={startGame}>Start Game</button>
  {:else}
    <div class="scene">
      <p class="narration">
        You enter a dimly lit room. A wounded stranger lies before you.
      </p>
      <p class="stats">
        Moral Alignment: {$gameState.moralAlignment}
      </p>
    </div>
    
    {#if $gameState.choicesMade.length === 0}
      <div class="choices">
        <button on:click={() => makeChoice('help')}>
          Help the stranger
        </button>
        <button on:click={() => makeChoice('ignore')}>
          Walk away
        </button>
      </div>
    {:else}
      <p class="result">
        {$gameState.choicesMade[0].option === 'help' 
          ? 'You bandage their wounds. They smile weakly. (+25 Alignment)'
          : 'You turn away. Their cries fade behind you. (-25 Alignment)'}
      </p>
    {/if}
    
    <div class="save-controls">
      <input bind:value={saveName} placeholder="Save name" />
      <button on:click={save}>Save</button>
      <button on:click={load}>Load</button>
    </div>
  {/if}
</div>

<style>
  .game-container {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    background: #1a1a1a;
    color: #fff;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  .choices {
    display: flex;
    gap: 1rem;
    margin: 2rem 0;
  }
  
  button {
    padding: 0.75rem 1.5rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  button:hover {
    background: #45a049;
    transform: translateY(-2px);
  }
  
  .save-controls {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #444;
  }
  
  input {
    padding: 0.5rem;
    margin-right: 0.5rem;
    background: #333;
    border: 1px solid #555;
    color: white;
    border-radius: 4px;
  }
</style>
```

### Phase 4: Testing and deployment (3 hours)

Test the complete flow:
1. Start game → See initial location
2. Make choice → See alignment change
3. Save game → Confirm save
4. Reload app → Load save → Verify state restored
5. Make opposite choice in new game → Verify different outcome

Build production bundle: `npm run tauri build`. Output appears in `src-tauri/target/release/bundle/` with platform-specific installers.

This walking skeleton demonstrates event sourcing fundamentals, save/load mechanics, and Tauri integration. Expand by adding locations, characters, and narrative complexity while maintaining the same architectural patterns.

## Development workflow optimization

Structure your project for AI-assisted development using Claude Code. Break implementation into discrete, well-defined tasks: "Implement event store append function with optimistic concurrency" rather than "Build event sourcing system". Provide explicit acceptance criteria for each task enabling Claude to generate complete, testable implementations.

Generate boilerplate from event model boards by describing command-event mappings to Claude: "Create TypeScript types for inventory system with AddItem, RemoveItem commands generating ItemAdded, ItemRemoved events, plus projection building inventory state." Claude excels at expanding well-defined specifications into implementation code.

Test event sourcing systems through property-based testing: verify events rebuild identical state regardless of batch size, confirm event ordering preservation, validate idempotency. Example test suite:

```typescript
import { describe, it, expect } from 'vitest'
import { evolveState, getInitialState } from './projections'
import { GameEvent } from './types'

describe('Event Projections', () => {
  it('rebuilds identical state from events', () => {
    const events: GameEvent[] = [
      { type: 'GAME_STARTED', data: { playerId: '1', startedAt: '2024-01-01' } },
      { type: 'CHOICE_MADE', data: { choiceId: 'a', option: 'help', madeAt: '2024-01-01' } },
      { type: 'MORAL_ALIGNMENT_CHANGED', data: { delta: 25, newValue: 25 } }
    ]
    
    const state1 = events.reduce(evolveState, getInitialState())
    const state2 = events.reduce(evolveState, getInitialState())
    
    expect(state1).toEqual(state2)
  })
  
  it('handles events in batches', () => {
    const events = generateManyEvents(1000)
    
    // Process all at once
    const stateAll = events.reduce(evolveState, getInitialState())
    
    // Process in batches of 100
    let stateBatched = getInitialState()
    for (let i = 0; i < events.length; i += 100) {
      const batch = events.slice(i, i + 100)
      stateBatched = batch.reduce(evolveState, stateBatched)
    }
    
    expect(stateAll).toEqual(stateBatched)
  })
})
```

Maintain architecture decision records (ADRs) documenting why you chose specific patterns. Example: "ADR-001: Use Svelte over React. Context: Need event-driven UI with minimal boilerplate. Decision: Svelte's built-in stores map to event streams more naturally. Consequences: Smaller bundle, faster development, less mature ecosystem than React." These records prevent revisiting settled decisions months later.

## Timeline and scope management

Budget 18-24 months for solo development of 10-hour narrative game, multiplying initial estimates by 3x. Break development into discrete milestones with hard deadlines: vertical slice complete by month 6, content complete by month 15, marketing materials by month 17. **Missing early milestones predicts missing launch date**—adjust scope immediately rather than hoping to catch up.

Scope management formula: `(Features × Content × (Unexplored Territory + 1)) / 100 = years`. For 5 features, 100 content pieces, and 2 unexplored systems: `(5 × 100 × 3) / 100 = 1.5 years`. Add 50% buffer for first commercial game, 25% for subsequent projects.

Common pitfalls destroying timelines:

**Perfectionism paralysis**: Spending weeks polishing art for features you'll cut. Solution: Use placeholder assets until gameplay proven fun through testing with strangers.

**Scope creep**: Adding "just one more feature" every week. Solution: Freeze feature list at month 3, maintain separate "version 2.0 ideas" document.

**Marketing procrastination**: Starting marketing at launch. Solution: Create Steam page at month 10, post weekly dev updates, build Discord community 6+ months pre-launch.

**Underestimating narrative scope**: Writing branching stories without understanding exponential complexity. Solution: Use linear structure with state-based variations rather than full branching—10x faster to write, equally satisfying for players.

When to hire contractors versus DIY: Hire artists after month 6-9 when core gameplay validated, hire translators after English launch successful, consider hiring composers at month 12-15. Never outsource programming for first game—learning the implementation proves invaluable for debugging and expansion. Budget $5,000-$20,000 for contractors if aiming for professional polish.

Revenue expectations for small indie narrative game: 1,000-2,000 launch sales from 10,000 wishlists at $14.99 price point generates $10,500-$21,000 after Steam's 30% cut. Chinese localization adds 15-25% sales. Plan to break even on first game, profit on second game after applying lessons learned.

## Conclusion

Event sourcing architecture transforms narrative game development from managing complex mutable state to simply recording immutable facts. Every player choice becomes a permanent event enabling save systems, debugging, analytics, and DLC expansions to emerge naturally from architecture rather than requiring extensive custom implementation. Your cloud solutions architect background positions you perfectly to leverage these patterns—the transition from backend event sourcing to single-player games simplifies concerns (no distributed transactions, no network partitions) while maintaining conceptual consistency.

Focus initial efforts on walking skeleton proving core mechanics fun before investing in content creation. Build systems that scale from 2-hour experimental games to 100-hour epics by designing for event stream growth rather than predetermined state structures. Start marketing 12+ months before launch, targeting 10,000+ wishlists through steady content sharing and community building. Localize to Chinese immediately for 15-25% revenue boost requiring modest $4,000-$7,500 investment. Ship MVP with core gameplay polished, accepting that peripheral features can arrive in post-launch updates.

The path from concept to Steam release spans 18-24 months for solo developers building 10-hour narrative games. Multiply initial estimates by 3x, cut features ruthlessly maintaining focus on core gameplay loop, test with strangers by month 6, and prepare for marketing to matter as much as development quality. Your first game likely breaks even while teaching invaluable lessons—second and third games profit from accumulated knowledge and audience.

Event sourcing provides competitive advantage for narrative games: perfect debugging through event replay, trivial save systems through stream checkpoints, natural DLC architecture through event schema versioning. Combine this architectural foundation with disciplined scope management, early community building, and willingness to ship imperfect first versions. The indie game market rewards finished projects over perfect prototypes—your cloud architecture discipline positions you to actually ship where most aspiring developers stall indefinitely polishing never-released projects.