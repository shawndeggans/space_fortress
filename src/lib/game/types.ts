// Game Commands - Player intents
export type GameCommand =
  | { type: 'START_GAME'; data: { playerId: string; timestamp: string } }
  | { type: 'MAKE_CHOICE'; data: { choiceId: string; option: string } }
  | { type: 'ENTER_LOCATION'; data: { locationId: string } }
  | { type: 'COLLECT_ITEM'; data: { itemId: string } }

// Game Events - Immutable facts
export type GameEvent =
  | { type: 'GAME_STARTED'; data: { playerId: string; startedAt: string } }
  | { type: 'LOCATION_ENTERED'; data: { locationId: string; enteredAt: string } }
  | { type: 'CHOICE_MADE'; data: { choiceId: string; option: string; madeAt: string } }
  | { type: 'MORAL_ALIGNMENT_CHANGED'; data: { delta: number; newValue: number } }
  | { type: 'ITEM_COLLECTED'; data: { itemId: string; collectedAt: string } }

// Game State - Current projection
export interface GameState {
  playerId: string
  currentLocation: string
  moralAlignment: number
  choicesMade: Array<{ choiceId: string; option: string }>
  inventory: string[]
  status: 'not_started' | 'in_progress' | 'completed'
}

// Stored event structure from database
export interface StoredEvent {
  event_id: string
  stream_id: string
  event_type: string
  event_data: string
  metadata: string | null
  sequence: number
  created_at: string
}

// Save game preview data
export interface SaveGamePreview {
  save_name: string
  player_id: string
  location: string
  moralAlignment: number
  choiceCount: number
  saved_at: string
}
