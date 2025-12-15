import { writable, get } from 'svelte/store'
import type { GameState, SaveGamePreview } from '../game/types'
import type { GameCommand } from '../game/commands'
import type { GameEvent } from '../game/events'
import { getInitialState, evolveState, rebuildState } from '../game/projections'
import { decide, InvalidCommandError } from '../game/decider'
import { getEventStore, type BrowserEventStore } from '../eventStore/BrowserEventStore'
import { debugError, debugLog, debugEvent } from '../debug'

const gameStateStore = writable<GameState>(getInitialState())
const saveGamesStore = writable<SaveGamePreview[]>([])
const errorStore = writable<string | null>(null)
const isLoadingStore = writable<boolean>(true)

let eventStore: BrowserEventStore | null = null
let currentPlayerId = 'player-1'

async function ensureEventStore(): Promise<BrowserEventStore> {
  if (!eventStore) {
    eventStore = await getEventStore()
  }
  return eventStore
}

export const gameState = {
  subscribe: gameStateStore.subscribe,

  async initialize() {
    try {
      isLoadingStore.set(true)
      debugLog('Initializing game store...')
      await ensureEventStore()
      await this.refreshSaveGames()
      isLoadingStore.set(false)
      debugLog('Game store initialized')
    } catch (error) {
      const message = `Failed to initialize: ${error}`
      debugError(message, 'Initialize', error as Error)
      errorStore.set(message)
      isLoadingStore.set(false)
    }
  },

  async handleCommand(command: GameCommand) {
    try {
      errorStore.set(null)
      const store = await ensureEventStore()
      const currentState = get(gameStateStore)

      debugLog(`Executing command: ${command.type}`, command.data)

      // Generate events from command
      const events = decide(command, currentState)

      // Log events in debug mode
      events.forEach(e => debugEvent(e.type, e.data))

      // Persist events
      await store.appendEvents(`player-${currentPlayerId}`, events)

      // Update projection
      const newState = events.reduce(evolveState, currentState)
      gameStateStore.set(newState)

      return { success: true }
    } catch (error) {
      const message = error instanceof InvalidCommandError
        ? error.message
        : `Command failed: ${error}`

      debugError(message, `Command: ${command.type}`, error as Error)
      errorStore.set(message)
      return { success: false, error }
    }
  },

  async saveGame(saveName: string) {
    try {
      errorStore.set(null)
      debugLog(`Saving game: ${saveName}`)
      const store = await ensureEventStore()
      const currentState = get(gameStateStore)
      await store.saveGame(currentPlayerId, saveName, currentState)
      await this.refreshSaveGames()
      debugLog(`Game saved: ${saveName}`)
      return { success: true }
    } catch (error) {
      const message = `Save failed: ${error}`
      debugError(message, 'SaveGame', error as Error)
      errorStore.set(message)
      return { success: false, error }
    }
  },

  async loadGame(saveName: string) {
    try {
      errorStore.set(null)
      isLoadingStore.set(true)
      debugLog(`Loading game: ${saveName}`)
      const store = await ensureEventStore()

      const saveData = await store.loadGame(saveName)
      if (!saveData) {
        throw new Error('Save game not found')
      }

      currentPlayerId = saveData.playerId
      const state = rebuildState(saveData.events)
      gameStateStore.set(state)
      isLoadingStore.set(false)
      debugLog(`Game loaded: ${saveName}`)
      return { success: true }
    } catch (error) {
      const message = `Load failed: ${error}`
      debugError(message, 'LoadGame', error as Error)
      errorStore.set(message)
      isLoadingStore.set(false)
      return { success: false, error }
    }
  },

  async newGame() {
    try {
      errorStore.set(null)
      debugLog('Starting new game...')
      const store = await ensureEventStore()

      // Generate a new player ID
      currentPlayerId = `player-${Date.now()}`

      // Reset state
      gameStateStore.set(getInitialState())
      debugLog(`New game started, player ID: ${currentPlayerId}`)

      return { success: true }
    } catch (error) {
      const message = `New game failed: ${error}`
      debugError(message, 'NewGame', error as Error)
      errorStore.set(message)
      return { success: false, error }
    }
  },

  async deleteSave(saveName: string) {
    try {
      errorStore.set(null)
      debugLog(`Deleting save: ${saveName}`)
      const store = await ensureEventStore()
      await store.deleteSaveGame(saveName)
      await this.refreshSaveGames()
      debugLog(`Save deleted: ${saveName}`)
      return { success: true }
    } catch (error) {
      const message = `Delete failed: ${error}`
      debugError(message, 'DeleteSave', error as Error)
      errorStore.set(message)
      return { success: false, error }
    }
  },

  async refreshSaveGames() {
    try {
      const store = await ensureEventStore()
      const saves = await store.listSaveGames()
      saveGamesStore.set(saves)
    } catch (error) {
      console.error('Failed to refresh save games:', error)
    }
  },

  getPlayerId(): string {
    return currentPlayerId
  },

  async getAllEvents(): Promise<GameEvent[]> {
    try {
      const store = await ensureEventStore()
      return await store.getEvents(`player-${currentPlayerId}`)
    } catch (error) {
      console.error('Failed to get events:', error)
      return []
    }
  }
}

export const saveGames = {
  subscribe: saveGamesStore.subscribe
}

export const gameError = {
  subscribe: errorStore.subscribe,
  clear: () => errorStore.set(null)
}

export const isLoading = {
  subscribe: isLoadingStore.subscribe
}
