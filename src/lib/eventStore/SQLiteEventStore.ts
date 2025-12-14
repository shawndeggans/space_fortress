import Database from '@tauri-apps/plugin-sql'
import type { StoredEvent, SaveGamePreview, GameState } from '../game/types'
import type { GameEvent } from '../game/events'

export class SQLiteEventStore {
  private db: Database | null = null

  async initialize(): Promise<void> {
    this.db = await Database.load('sqlite:game.db')
    // Enable Write-Ahead Logging for better concurrency
    await this.db.execute('PRAGMA journal_mode=WAL')
    await this.db.execute('PRAGMA cache_size=10000')
  }

  private async getLastSequence(streamId: string): Promise<number> {
    const result = await this.db!.select<{ max_seq: number | null }[]>(
      'SELECT MAX(sequence) as max_seq FROM events WHERE stream_id = ?',
      [streamId]
    )
    return result[0]?.max_seq ?? 0
  }

  async appendEvent(streamId: string, event: GameEvent): Promise<string> {
    const lastSeq = await this.getLastSequence(streamId)
    const metadata = JSON.stringify({ timestamp: new Date().toISOString() })

    await this.db!.execute(
      `INSERT INTO events (stream_id, event_type, event_data, sequence, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [streamId, event.type, JSON.stringify(event.data), lastSeq + 1, metadata]
    )

    // Return the event_id of the inserted event
    const result = await this.db!.select<{ event_id: string }[]>(
      'SELECT event_id FROM events WHERE stream_id = ? AND sequence = ?',
      [streamId, lastSeq + 1]
    )
    return result[0].event_id
  }

  async appendEvents(streamId: string, events: GameEvent[]): Promise<void> {
    let lastSeq = await this.getLastSequence(streamId)
    const timestamp = new Date().toISOString()

    for (const event of events) {
      lastSeq++
      const metadata = JSON.stringify({ timestamp })
      await this.db!.execute(
        `INSERT INTO events (stream_id, event_type, event_data, sequence, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [streamId, event.type, JSON.stringify(event.data), lastSeq, metadata]
      )
    }
  }

  async getEvents(streamId: string): Promise<GameEvent[]> {
    const rows = await this.db!.select<StoredEvent[]>(
      'SELECT * FROM events WHERE stream_id = ? ORDER BY sequence ASC',
      [streamId]
    )
    return rows.map(row => ({
      type: row.event_type as GameEvent['type'],
      data: JSON.parse(row.event_data)
    })) as GameEvent[]
  }

  async getEventsSince(streamId: string, afterSequence: number): Promise<GameEvent[]> {
    const rows = await this.db!.select<StoredEvent[]>(
      'SELECT * FROM events WHERE stream_id = ? AND sequence > ? ORDER BY sequence ASC',
      [streamId, afterSequence]
    )
    return rows.map(row => ({
      type: row.event_type as GameEvent['type'],
      data: JSON.parse(row.event_data)
    })) as GameEvent[]
  }

  async saveGame(playerId: string, saveName: string, state: GameState): Promise<void> {
    // Get the last event ID for this player
    const lastEvent = await this.db!.select<{ event_id: string }[]>(
      'SELECT event_id FROM events WHERE stream_id = ? ORDER BY sequence DESC LIMIT 1',
      [`player-${playerId}`]
    )

    const previewData: SaveGamePreview = {
      save_name: saveName,
      player_id: playerId,
      phase: state.currentPhase,
      activeQuestTitle: state.activeQuest?.questId,
      bounty: state.bounty,
      questsCompleted: state.completedQuests.length,
      saved_at: new Date().toISOString()
    }

    await this.db!.execute(
      `INSERT OR REPLACE INTO save_games (save_name, player_id, last_event_id, preview_data, saved_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [saveName, playerId, lastEvent[0]?.event_id ?? '', JSON.stringify(previewData)]
    )
  }

  async loadGame(saveName: string): Promise<{ playerId: string; events: GameEvent[] } | null> {
    const saveData = await this.db!.select<{ player_id: string }[]>(
      'SELECT player_id FROM save_games WHERE save_name = ?',
      [saveName]
    )

    if (saveData.length === 0) {
      return null
    }

    const playerId = saveData[0].player_id
    const events = await this.getEvents(`player-${playerId}`)

    return { playerId, events }
  }

  async listSaveGames(): Promise<SaveGamePreview[]> {
    const saves = await this.db!.select<{ preview_data: string }[]>(
      'SELECT preview_data FROM save_games ORDER BY saved_at DESC'
    )
    return saves.map(s => JSON.parse(s.preview_data))
  }

  async deleteSaveGame(saveName: string): Promise<void> {
    await this.db!.execute('DELETE FROM save_games WHERE save_name = ?', [saveName])
  }

  async clearPlayerEvents(playerId: string): Promise<void> {
    await this.db!.execute('DELETE FROM events WHERE stream_id = ?', [`player-${playerId}`])
    await this.db!.execute('DELETE FROM snapshots WHERE stream_id = ?', [`player-${playerId}`])
  }
}

// Singleton instance
let eventStoreInstance: SQLiteEventStore | null = null

export async function getEventStore(): Promise<SQLiteEventStore> {
  if (!eventStoreInstance) {
    eventStoreInstance = new SQLiteEventStore()
    await eventStoreInstance.initialize()
  }
  return eventStoreInstance
}
