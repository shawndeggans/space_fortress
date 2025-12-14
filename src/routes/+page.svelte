<!--
  Main Entry Point
  Shows the main menu when no game is active, or routes to appropriate screen.
-->
<script lang="ts">
  import { gameState, saveGames } from '$lib/stores/gameStore'
  import type { SaveGamePreview } from '$lib/game/types'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let saveName = $state('quicksave')
  let showSaveMenu = $state(false)

  // Route to the appropriate screen based on game phase
  function navigateToPhase() {
    switch ($gameState.currentPhase) {
      case 'quest_hub':
        goto('/quest-hub')
        break
      case 'narrative':
        goto('/narrative')
        break
      case 'alliance':
        goto('/alliance')
        break
      case 'card_selection':
        goto('/card-pool')
        break
      case 'deployment':
        goto('/deployment')
        break
      case 'battle':
        goto('/battle')
        break
      case 'consequence':
        goto('/consequence')
        break
      case 'ending':
        goto('/ending')
        break
    }
  }

  async function startGame() {
    await gameState.newGame()
    await gameState.handleCommand({
      type: 'START_GAME',
      data: { playerId: gameState.getPlayerId() }
    })
    goto('/quest-hub')
  }

  async function continueGame() {
    navigateToPhase()
  }

  async function load(saveToLoad: SaveGamePreview) {
    await gameState.loadGame(saveToLoad.save_name)
    showSaveMenu = false
    navigateToPhase()
  }

  async function deleteSave(saveToDelete: SaveGamePreview) {
    if (confirm(`Delete save "${saveToDelete.save_name}"?`)) {
      await gameState.deleteSave(saveToDelete.save_name)
    }
  }
</script>

<main class="main-menu">
  <header class="game-header">
    <h1 class="game-title">Space Fortress</h1>
    <p class="game-subtitle">A Narrative Tactical Adventure</p>
  </header>

  <div class="menu-content">
    {#if $gameState.gameStatus === 'in_progress'}
      <div class="continue-section">
        <p class="continue-info">
          You have a game in progress:
          <span class="continue-phase">{$gameState.currentPhase}</span>
        </p>
        <button class="btn btn--primary btn--large" data-testid="btn-continue" onclick={continueGame}>
          Continue Game
        </button>
      </div>
      <div class="menu-divider">or</div>
    {/if}

    <div class="menu-buttons">
      <button class="btn btn--primary btn--large" data-testid="btn-new-game" onclick={startGame}>
        New Game
      </button>
      <button class="btn btn--secondary" data-testid="btn-load-game" onclick={() => showSaveMenu = !showSaveMenu}>
        {showSaveMenu ? 'Hide Saves' : 'Load Game'}
      </button>
    </div>

    {#if showSaveMenu}
      <div class="save-list">
        <h3>Save Games</h3>
        {#if $saveGames.length > 0}
          {#each $saveGames as saveGame}
            <div class="save-item">
              <div class="save-info">
                <strong>{saveGame.save_name}</strong>
                <span class="save-details">
                  Phase: {saveGame.phase} | Bounty: {saveGame.bounty}
                </span>
                <span class="save-date">{new Date(saveGame.saved_at).toLocaleString()}</span>
              </div>
              <div class="save-actions">
                <button class="btn btn--small" onclick={() => load(saveGame)}>Load</button>
                <button class="btn btn--small btn--danger" onclick={() => deleteSave(saveGame)}>Delete</button>
              </div>
            </div>
          {/each}
        {:else}
          <p class="no-saves">No save games found</p>
        {/if}
      </div>
    {/if}
  </div>

  <footer class="game-footer">
    <p class="version">v0.1.0 MVP</p>
  </footer>
</main>

<style>
  .main-menu {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    background: var(--bg-primary);
  }

  .game-header {
    text-align: center;
    margin-bottom: var(--space-10);
  }

  .game-title {
    font-size: var(--font-size-4xl);
    font-weight: 700;
    margin: 0;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 0.05em;
  }

  .game-subtitle {
    color: var(--text-muted);
    font-size: var(--font-size-lg);
    margin: var(--space-2) 0 0 0;
  }

  .menu-content {
    width: 100%;
    max-width: 400px;
  }

  .continue-section {
    text-align: center;
    margin-bottom: var(--space-4);
  }

  .continue-info {
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .continue-phase {
    color: var(--accent-primary);
    font-weight: 500;
    text-transform: capitalize;
  }

  .menu-divider {
    text-align: center;
    color: var(--text-dim);
    margin: var(--space-4) 0;
    position: relative;
  }

  .menu-divider::before,
  .menu-divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: var(--border-default);
  }

  .menu-divider::before {
    left: 0;
  }

  .menu-divider::after {
    right: 0;
  }

  .menu-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .btn {
    padding: var(--space-3) var(--space-4);
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
  }

  .btn--large {
    padding: var(--space-4) var(--space-6);
    font-size: var(--font-size-lg);
  }

  .btn--small {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .btn--secondary {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn--secondary:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }

  .btn--danger {
    background: var(--bg-secondary);
    border: 1px solid var(--error);
    color: var(--error);
  }

  .btn--danger:hover {
    background: color-mix(in srgb, var(--error) 10%, var(--bg-secondary));
  }

  .save-list {
    margin-top: var(--space-6);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-default);
  }

  .save-list h3 {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-4) 0;
  }

  .save-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
  }

  .save-item:last-child {
    margin-bottom: 0;
  }

  .save-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .save-info strong {
    color: var(--text-primary);
  }

  .save-details {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .save-date {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
  }

  .save-actions {
    display: flex;
    gap: var(--space-2);
  }

  .no-saves {
    color: var(--text-dim);
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  .game-footer {
    position: fixed;
    bottom: var(--space-4);
    text-align: center;
  }

  .version {
    color: var(--text-dim);
    font-size: var(--font-size-xs);
    margin: 0;
  }
</style>
