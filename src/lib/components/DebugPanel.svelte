<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { DEBUG } from '$lib/debug'
  import type { GameEvent } from '$lib/game/events'

  // Only render if debug mode is enabled
  let isVisible = $state(DEBUG)
  let isCollapsed = $state(true)
  let recentEvents = $state<GameEvent[]>([])
  let isLoadingEvents = $state(false)

  // Get current state
  let currentPhase = $derived($gameState.currentPhase)
  let currentDilemmaId = $derived($gameState.currentDilemmaId)
  let activeQuest = $derived($gameState.activeQuest)
  let gameStatus = $derived($gameState.gameStatus)

  function toggle() {
    isCollapsed = !isCollapsed
    if (!isCollapsed && recentEvents.length === 0) {
      loadEvents()
    }
  }

  async function loadEvents() {
    isLoadingEvents = true
    const events = await gameState.getAllEvents()
    recentEvents = events.slice(-20).reverse() // Last 20, most recent first
    isLoadingEvents = false
  }

  async function exportEvents() {
    const events = await gameState.getAllEvents()

    const tacticalBattle = $gameState.currentTacticalBattle
    const debugData = {
      exportedAt: new Date().toISOString(),
      playerId: gameState.getPlayerId(),
      currentState: {
        currentPhase: $gameState.currentPhase,
        currentDilemmaId: $gameState.currentDilemmaId,
        activeQuest: $gameState.activeQuest,
        gameStatus: $gameState.gameStatus,
        reputation: $gameState.reputation,
        bounty: $gameState.bounty,
        ownedCardCount: $gameState.ownedCards.length,
        // Include tactical battle state for debugging
        tacticalBattle: tacticalBattle ? {
          phase: tacticalBattle.phase,
          turnNumber: tacticalBattle.turnNumber,
          activePlayer: tacticalBattle.activePlayer,
          playerHand: tacticalBattle.player.hand,
          playerEnergy: tacticalBattle.player.energy,
          playerDeckCount: tacticalBattle.player.deck.length
        } : null
      },
      eventCount: events.length,
      events: events
    }

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `space-fortress-debug-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function refreshEvents() {
    loadEvents()
  }

  // Highlight phase-related events
  function getEventClass(eventType: string): string {
    if (eventType.includes('PHASE') || eventType === 'DILEMMA_PRESENTED') {
      return 'event-phase'
    }
    if (eventType.includes('ERROR') || eventType.includes('FAILED')) {
      return 'event-error'
    }
    return ''
  }
</script>

{#if isVisible}
  <div class="debug-panel" class:collapsed={isCollapsed}>
    <button class="toggle-btn" onclick={toggle}>
      Debug {isCollapsed ? '▲' : '▼'}
    </button>

    {#if !isCollapsed}
      <div class="panel-content">
        <div class="state-section">
          <h4>Current State</h4>
          <div class="state-grid">
            <div class="state-item">
              <span class="label">Phase:</span>
              <span class="value phase-value">{currentPhase}</span>
            </div>
            <div class="state-item">
              <span class="label">Status:</span>
              <span class="value">{gameStatus}</span>
            </div>
            <div class="state-item">
              <span class="label">Dilemma:</span>
              <span class="value">{currentDilemmaId || 'none'}</span>
            </div>
            <div class="state-item">
              <span class="label">Quest:</span>
              <span class="value">{activeQuest?.questId || 'none'}</span>
            </div>
            {#if activeQuest}
              <div class="state-item">
                <span class="label">Dilemma Index:</span>
                <span class="value">{activeQuest.currentDilemmaIndex}</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="events-section">
          <div class="events-header">
            <h4>Recent Events</h4>
            <button class="refresh-btn" onclick={refreshEvents} disabled={isLoadingEvents}>
              {isLoadingEvents ? '...' : '↻'}
            </button>
          </div>
          <div class="event-list">
            {#if recentEvents.length === 0}
              <div class="no-events">No events yet</div>
            {:else}
              {#each recentEvents as event, i}
                <div class="event {getEventClass(event.type)}">
                  <span class="event-index">{recentEvents.length - i}.</span>
                  <span class="event-type">{event.type}</span>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="actions-section">
          <button class="export-btn" onclick={exportEvents}>
            Export Events (JSON)
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .debug-panel {
    position: fixed;
    bottom: var(--space-4);
    right: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--accent-gold);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-xs);
    z-index: 9999;
    max-width: 320px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .debug-panel.collapsed {
    max-width: auto;
  }

  .toggle-btn {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: none;
    border-radius: var(--radius-lg);
    color: var(--accent-gold);
    cursor: pointer;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .toggle-btn:hover {
    background: var(--bg-elevated);
  }

  .panel-content {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-height: 400px;
    overflow-y: auto;
  }

  h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .state-section {
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: var(--space-3);
  }

  .state-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .state-item {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .label {
    color: var(--text-muted);
  }

  .value {
    color: var(--text-primary);
    font-family: monospace;
    text-align: right;
    word-break: break-all;
  }

  .phase-value {
    color: var(--accent-gold);
    font-weight: 600;
  }

  .events-section {
    flex: 1;
    min-height: 0;
  }

  .events-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .events-header h4 {
    margin: 0;
  }

  .refresh-btn {
    padding: var(--space-1) var(--space-2);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: var(--font-size-xs);
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--bg-elevated);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .event-list {
    max-height: 150px;
    overflow-y: auto;
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    margin-top: var(--space-2);
  }

  .event {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--border-subtle);
    font-family: monospace;
  }

  .event:last-child {
    border-bottom: none;
  }

  .event-index {
    color: var(--text-muted);
    min-width: 24px;
  }

  .event-type {
    color: var(--text-primary);
  }

  .event-phase .event-type {
    color: var(--accent-gold);
    font-weight: 600;
  }

  .event-error .event-type {
    color: var(--error);
  }

  .no-events {
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-2);
  }

  .actions-section {
    border-top: 1px solid var(--border-subtle);
    padding-top: var(--space-3);
  }

  .export-btn {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--accent-gold);
    border-radius: var(--radius-md);
    color: var(--accent-gold);
    cursor: pointer;
    font-size: var(--font-size-xs);
    font-weight: 600;
    transition: background var(--transition-fast);
  }

  .export-btn:hover {
    background: var(--bg-elevated);
  }
</style>
