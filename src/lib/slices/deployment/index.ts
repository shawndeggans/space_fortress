// ============================================================================
// DEPLOYMENT SLICE - Public API
// ============================================================================
//
// This module exports the public API for the deployment slice.
//
// The deployment slice handles:
// - Positioning cards in battle slots (1-5)
// - Locking orders to begin battle execution
// ============================================================================

// ----------------------------------------------------------------------------
// Command Handlers
// ----------------------------------------------------------------------------

export {
  handleSetCardPosition,
  handleLockOrders,
  createSetCardPositionCommand,
  createLockOrdersCommand,
  DeploymentError,
  TOTAL_POSITIONS,
  type SetCardPositionCommand,
  type LockOrdersCommand,
  type DeploymentCommand,
  type DeploymentState
} from './command'

// ----------------------------------------------------------------------------
// Read Model
// ----------------------------------------------------------------------------

export {
  // View types
  type DeploymentCardView,
  type DeploymentSlot,
  type DeploymentView,

  // Projection factory
  createDeploymentProjection,

  // View builders
  buildDeploymentView,

  // Convenience projections (pure event-sourced)
  projectDeploymentFromEvents,

  // Legacy API adapter (for backward compatibility with existing UI)
  projectDeploymentView
} from './read-model'
