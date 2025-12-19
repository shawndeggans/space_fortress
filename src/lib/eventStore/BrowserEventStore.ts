import initSqlJs, { type Database } from 'sql.js'
import type { StoredEvent, SaveGamePreview, GameState } from '../game/types'
import type { GameEvent } from '../game/events'

const DB_NAME = 'space_fortress_db'
const DB_STORE = 'database'

// Snapshot configuration
// Increment SCHEMA_VERSION when GameState shape changes to invalidate old snapshots
const SCHEMA_VERSION = 1
const SNAPSHOT_THRESHOLD = 50  // Create snapshot after this many events

export class BrowserEventStore {
  private db: Database | null = null

  async initialize(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    })

    // Try to load existing database from IndexedDB
    const savedData = await this.loadFromIndexedDB()
    if (savedData) {
      this.db = new SQL.Database(savedData)
    } else {
      this.db = new SQL.Database()
      await this.createTables()
    }
  }

  private async createTables(): Promise<void> {
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        metadata TEXT,
        sequence INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(stream_id, sequence)
      )
    `)

    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_events_stream ON events(stream_id, sequence)`)
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`)

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        stream_id TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL,
        state_data TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    this.db!.run(`
      CREATE TABLE IF NOT EXISTS save_games (
        save_name TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        last_event_id TEXT NOT NULL,
        preview_data TEXT NOT NULL,
        saved_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await this.persistToIndexedDB()
  }

  private generateId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE)
        }
      }

      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(DB_STORE, 'readonly')
        const store = tx.objectStore(DB_STORE)
        const getRequest = store.get('db')

        getRequest.onsuccess = () => {
          resolve(getRequest.result || null)
        }

        getRequest.onerror = () => {
          resolve(null)
        }
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  }

  private async persistToIndexedDB(): Promise<void> {
    if (!this.db) return

    const data = this.db.export()

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE)
        }
      }

      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(DB_STORE, 'readwrite')
        const store = tx.objectStore(DB_STORE)
        store.put(data, 'db')

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }

      request.onerror = () => reject(request.error)
    })
  }

  private getLastSequence(streamId: string): number {
    const result = this.db!.exec(
      'SELECT MAX(sequence) as max_seq FROM events WHERE stream_id = ?',
      [streamId]
    )
    if (result.length === 0 || result[0].values.length === 0) {
      return 0
    }
    return (result[0].values[0][0] as number) ?? 0
  }

  async appendEvent(streamId: string, event: GameEvent): Promise<string> {
    const lastSeq = this.getLastSequence(streamId)
    const eventId = this.generateId()
    const metadata = JSON.stringify({ timestamp: new Date().toISOString() })
    const createdAt = new Date().toISOString()

    this.db!.run(
      `INSERT INTO events (event_id, stream_id, event_type, event_data, sequence, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, streamId, event.type, JSON.stringify(event.data), lastSeq + 1, metadata, createdAt]
    )

    await this.persistToIndexedDB()
    return eventId
  }

  async appendEvents(streamId: string, events: GameEvent[]): Promise<void> {
    let lastSeq = this.getLastSequence(streamId)
    const timestamp = new Date().toISOString()

    for (const event of events) {
      lastSeq++
      const eventId = this.generateId()
      const metadata = JSON.stringify({ timestamp })

      this.db!.run(
        `INSERT INTO events (event_id, stream_id, event_type, event_data, sequence, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [eventId, streamId, event.type, JSON.stringify(event.data), lastSeq, metadata, timestamp]
      )
    }

    await this.persistToIndexedDB()
  }

  async getEvents(streamId: string): Promise<GameEvent[]> {
    const result = this.db!.exec(
      'SELECT event_type, event_data FROM events WHERE stream_id = ? ORDER BY sequence ASC',
      [streamId]
    )

    if (result.length === 0) {
      return []
    }

    // Parse events with error handling for corrupted data
    const events: GameEvent[] = []
    for (const row of result[0].values) {
      try {
        const event = {
          type: row[0],
          data: JSON.parse(row[1] as string)
        } as GameEvent
        events.push(event)
      } catch (error) {
        // Log corrupted event but continue loading other events
        // This provides graceful degradation instead of failing entirely
        console.error('Failed to parse event data, skipping corrupted event:', {
          type: row[0],
          rawData: row[1],
          error
        })
      }
    }
    return events
  }

  // ============================================================================
  // Snapshot Methods
  // ============================================================================

  /**
   * Save a snapshot of the current state at the given sequence number.
   * Snapshots speed up state reconstruction by reducing events to replay.
   */
  async saveSnapshot(streamId: string, state: GameState, sequence: number): Promise<void> {
    this.db!.run(
      `INSERT OR REPLACE INTO snapshots (stream_id, sequence, state_data, schema_version, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [streamId, sequence, JSON.stringify(state), SCHEMA_VERSION]
    )
    await this.persistToIndexedDB()
  }

  /**
   * Load a snapshot for the given stream if one exists and is valid.
   * Returns null if no snapshot exists or if the schema version doesn't match.
   */
  async loadSnapshot(streamId: string): Promise<{ state: GameState; sequence: number } | null> {
    const result = this.db!.exec(
      'SELECT state_data, sequence, schema_version FROM snapshots WHERE stream_id = ?',
      [streamId]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    const row = result[0].values[0]
    const schemaVersion = row[2] as number

    // Invalidate snapshot if schema version doesn't match
    if (schemaVersion !== SCHEMA_VERSION) {
      console.log(`Snapshot schema version mismatch (${schemaVersion} != ${SCHEMA_VERSION}), will rebuild from events`)
      this.db!.run('DELETE FROM snapshots WHERE stream_id = ?', [streamId])
      await this.persistToIndexedDB()
      return null
    }

    try {
      return {
        state: JSON.parse(row[0] as string) as GameState,
        sequence: row[1] as number
      }
    } catch (error) {
      console.error('Failed to parse snapshot, will rebuild from events:', error)
      this.db!.run('DELETE FROM snapshots WHERE stream_id = ?', [streamId])
      await this.persistToIndexedDB()
      return null
    }
  }

  /**
   * Load state for a stream, using snapshot if available.
   * Falls back to replaying all events if no valid snapshot exists.
   *
   * @param streamId - The stream to load
   * @param evolve - Function to fold events into state
   * @param initialState - Initial state to start from
   * @returns The reconstructed state
   */
  async loadStateWithSnapshot(
    streamId: string,
    evolve: (state: GameState, event: GameEvent) => GameState,
    initialState: GameState
  ): Promise<GameState> {
    // Try to load snapshot
    const snapshot = await this.loadSnapshot(streamId)

    let state: GameState
    let startSequence: number

    if (snapshot) {
      state = snapshot.state
      startSequence = snapshot.sequence
    } else {
      state = initialState
      startSequence = 0
    }

    // Load events after the snapshot sequence
    const result = this.db!.exec(
      'SELECT event_type, event_data FROM events WHERE stream_id = ? AND sequence > ? ORDER BY sequence ASC',
      [streamId, startSequence]
    )

    if (result.length > 0) {
      for (const row of result[0].values) {
        try {
          const event = {
            type: row[0],
            data: JSON.parse(row[1] as string)
          } as GameEvent
          state = evolve(state, event)
        } catch (error) {
          console.error('Failed to parse event during state reconstruction:', error)
        }
      }
    }

    // Get total event count to decide if we should save a snapshot
    const countResult = this.db!.exec(
      'SELECT COUNT(*) FROM events WHERE stream_id = ?',
      [streamId]
    )
    const totalEvents = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0
    const eventsAfterSnapshot = totalEvents - startSequence

    // Save snapshot if we've replayed enough events
    if (eventsAfterSnapshot >= SNAPSHOT_THRESHOLD) {
      await this.saveSnapshot(streamId, state, totalEvents)
      console.log(`Saved snapshot for ${streamId} at sequence ${totalEvents}`)
    }

    return state
  }

  /**
   * Delete snapshot for a stream (e.g., when starting a new game)
   */
  async deleteSnapshot(streamId: string): Promise<void> {
    this.db!.run('DELETE FROM snapshots WHERE stream_id = ?', [streamId])
    await this.persistToIndexedDB()
  }

  async saveGame(playerId: string, saveName: string, state: GameState): Promise<void> {
    const lastEventResult = this.db!.exec(
      'SELECT event_id FROM events WHERE stream_id = ? ORDER BY sequence DESC LIMIT 1',
      [`player-${playerId}`]
    )

    const lastEventId = lastEventResult.length > 0 && lastEventResult[0].values.length > 0
      ? lastEventResult[0].values[0][0] as string
      : ''

    const previewData: SaveGamePreview = {
      save_name: saveName,
      player_id: playerId,
      phase: state.currentPhase,
      activeQuestTitle: state.activeQuest?.questId,
      bounty: state.bounty,
      questsCompleted: state.completedQuests.length,
      saved_at: new Date().toISOString()
    }

    this.db!.run(
      `INSERT OR REPLACE INTO save_games (save_name, player_id, last_event_id, preview_data, saved_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [saveName, playerId, lastEventId, JSON.stringify(previewData)]
    )

    await this.persistToIndexedDB()
  }

  async loadGame(saveName: string): Promise<{ playerId: string; events: GameEvent[] } | null> {
    const saveResult = this.db!.exec(
      'SELECT player_id FROM save_games WHERE save_name = ?',
      [saveName]
    )

    if (saveResult.length === 0 || saveResult[0].values.length === 0) {
      return null
    }

    const playerId = saveResult[0].values[0][0] as string
    const events = await this.getEvents(`player-${playerId}`)

    return { playerId, events }
  }

  async listSaveGames(): Promise<SaveGamePreview[]> {
    const result = this.db!.exec(
      'SELECT preview_data FROM save_games ORDER BY saved_at DESC'
    )

    if (result.length === 0) {
      return []
    }

    // Parse save previews with error handling for corrupted data
    const saves: SaveGamePreview[] = []
    for (const row of result[0].values) {
      try {
        saves.push(JSON.parse(row[0] as string))
      } catch (error) {
        console.error('Failed to parse save game preview, skipping:', {
          rawData: row[0],
          error
        })
      }
    }
    return saves
  }

  async deleteSaveGame(saveName: string): Promise<void> {
    this.db!.run('DELETE FROM save_games WHERE save_name = ?', [saveName])
    await this.persistToIndexedDB()
  }

  async clearPlayerEvents(playerId: string): Promise<void> {
    this.db!.run('DELETE FROM events WHERE stream_id = ?', [`player-${playerId}`])
    this.db!.run('DELETE FROM snapshots WHERE stream_id = ?', [`player-${playerId}`])
    await this.persistToIndexedDB()
  }
}

// Singleton instance
let eventStoreInstance: BrowserEventStore | null = null

export async function getEventStore(): Promise<BrowserEventStore> {
  if (!eventStoreInstance) {
    eventStoreInstance = new BrowserEventStore()
    await eventStoreInstance.initialize()
  }
  return eventStoreInstance
}
