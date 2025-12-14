import { writable, get } from 'svelte/store'
import type { GameState, SaveGamePreview } from '../game/types'
import type { GameCommand } from '../game/commands'
import type { GameEvent } from '../game/events'
import { getInitialState, evolveState, rebuildState } from '../game/projections'
import { decide, InvalidCommandError } from '../game/decider'
import { getEventStore, type BrowserEventStore } from '../eventStore/BrowserEventStore'

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
      await ensureEventStore()
      await this.refreshSaveGames()
      isLoadingStore.set(false)
    } catch (error) {
      errorStore.set(`Failed to initialize: ${error}`)
      isLoadingStore.set(false)
    }
  },

  async handleCommand(command: GameCommand) {
    try {
      errorStore.set(null)
      const store = await ensureEventStore()
      const currentState = get(gameStateStore)

      // Generate events from command
      const events = decide(command, currentState)

      // Persist events
      await store.appendEvents(`player-${currentPlayerId}`, events)

      // Update projection
      const newState = events.reduce(evolveState, currentState)
      gameStateStore.set(newState)

      return { success: true }
    } catch (error) {
      if (error instanceof InvalidCommandError) {
        errorStore.set(error.message)
      } else {
        errorStore.set(`Command failed: ${error}`)
      }
      return { success: false, error }
    }
  },

  async saveGame(saveName: string) {
    try {
      errorStore.set(null)
      const store = await ensureEventStore()
      const currentState = get(gameStateStore)
      await store.saveGame(currentPlayerId, saveName, currentState)
      await this.refreshSaveGames()
      return { success: true }
    } catch (error) {
      errorStore.set(`Save failed: ${error}`)
      return { success: false, error }
    }
  },

  async loadGame(saveName: string) {
    try {
      errorStore.set(null)
      isLoadingStore.set(true)
      const store = await ensureEventStore()

      const saveData = await store.loadGame(saveName)
      if (!saveData) {
        throw new Error('Save game not found')
      }

      currentPlayerId = saveData.playerId
      const state = rebuildState(saveData.events)
      gameStateStore.set(state)
      isLoadingStore.set(false)
      return { success: true }
    } catch (error) {
      errorStore.set(`Load failed: ${error}`)
      isLoadingStore.set(false)
      return { success: false, error }
    }
  },

  async newGame() {
    try {
      errorStore.set(null)
      const store = await ensureEventStore()

      // Generate a new player ID
      currentPlayerId = `player-${Date.now()}`

      // Reset state
      gameStateStore.set(getInitialState())

      return { success: true }
    } catch (error) {
      errorStore.set(`New game failed: ${error}`)
      return { success: false, error }
    }
  },

  async deleteSave(saveName: string) {
    try {
      errorStore.set(null)
      const store = await ensureEventStore()
      await store.deleteSaveGame(saveName)
      await this.refreshSaveGames()
      return { success: true }
    } catch (error) {
      errorStore.set(`Delete failed: ${error}`)
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
