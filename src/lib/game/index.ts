// ============================================================================
// SPACE FORTRESS - Game Module Index
// ============================================================================
//
// Re-exports all game types, events, commands, and functions for easy importing.
// ============================================================================

// Types
export * from './types'

// Events
export * from './events'

// Commands
export * from './commands'

// Decider
export { decide, InvalidCommandError } from './decider'

// Core Projections
export {
  getInitialState,
  evolveState,
  rebuildState,
  countEventsByType,
  filterEventsByType,
  getLatestEvent
} from './projections'

// View Projections (re-export from projections folder)
export * from './projections/index'
