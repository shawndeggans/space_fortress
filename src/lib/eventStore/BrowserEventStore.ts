import initSqlJs, { type Database } from 'sql.js'
import type { StoredEvent, SaveGamePreview, GameState } from '../game/types'
import type { GameEvent } from '../game/events'

const DB_NAME = 'space_fortress_db'
const DB_STORE = 'database'

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

    return result[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
      type: row[0] as GameEvent['type'],
      data: JSON.parse(row[1] as string)
    })) as GameEvent[]
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

    return result[0].values.map((row: (string | number | null | Uint8Array)[]) => JSON.parse(row[0] as string))
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
