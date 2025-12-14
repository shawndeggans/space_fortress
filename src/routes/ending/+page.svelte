<!--
  Ending Screen
  Final evaluation after completing 3 quests.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectEndingView } from '$lib/game'
  import ReputationBar from '$lib/components/ReputationBar.svelte'
  import type { FactionId, ReputationStatus } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let endingView = $derived(projectEndingView([], $gameState))

  async function startNewGame() {
    const result = await gameState.newGame()
    if (result.success) {
      await gameState.handleCommand({
        type: 'START_GAME',
        data: { playerId: gameState.getPlayerId() }
      })
      goto('/')
    }
  }

  function viewChoiceHistory() {
    // TODO: Implement choice archaeology view
  }

  function getReputationStatus(value: number): ReputationStatus {
    if (value >= 75) return 'devoted'
    if (value >= 25) return 'friendly'
    if (value >= -24) return 'neutral'
    if (value >= -74) return 'unfriendly'
    return 'hostile'
  }
</script>

<div class="ending-screen">
  {#if endingView}
    <main class="ending-content">
      <!-- Title Card -->
      <header class="ending-header">
        <div class="title-decoration">
          <span class="decoration-line"></span>
        </div>
        <h1 class="ending-title">{endingView.title}</h1>
        <p class="ending-subtitle">"{endingView.subtitle}"</p>
        <div class="title-decoration">
          <span class="decoration-line"></span>
        </div>
      </header>

      <!-- Narrative Summary -->
      <section class="narrative-section">
        <p>{endingView.narrativeSummary}</p>
      </section>

      <!-- Final Standings -->
      <section class="standings-section">
        <h2>Final Standings</h2>
        <div class="standings-list">
          {#each endingView.factionStandings as faction}
            <ReputationBar
              faction={faction.factionId}
              value={faction.value}
              variant="compact"
            />
          {/each}
        </div>
      </section>

      <!-- Statistics -->
      <section class="stats-section">
        <h2>Record</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.questsCompleted}</span>
            <span class="stat-label">Quests Completed</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.battlesWon}</span>
            <span class="stat-label">Battles Won</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.battlesLost}</span>
            <span class="stat-label">Battles Lost</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.battlesAvoided}</span>
            <span class="stat-label">Battles Avoided</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.diplomaticResolutions}</span>
            <span class="stat-label">Diplomatic Resolutions</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{endingView.stats.betrayals}</span>
            <span class="stat-label">Betrayals</span>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <footer class="actions-section">
        <button class="btn btn--secondary" onclick={viewChoiceHistory}>
          View Choice History
        </button>
        <button class="btn btn--primary" onclick={startNewGame}>
          New Game
        </button>
      </footer>
    </main>
  {:else}
    <main class="no-ending">
      <p>No ending data available.</p>
      <button class="btn btn--primary" onclick={() => goto('/')}>
        Return Home
      </button>
    </main>
  {/if}
</div>

<style>
  .ending-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    padding: var(--space-6);
  }

  .ending-content {
    max-width: 700px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  /* Header/Title */
  .ending-header {
    text-align: center;
  }

  .title-decoration {
    display: flex;
    justify-content: center;
    margin: var(--space-4) 0;
  }

  .decoration-line {
    width: 150px;
    height: 2px;
    background: var(--accent-gradient);
  }

  .ending-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .ending-subtitle {
    font-size: var(--font-size-lg);
    font-style: italic;
    color: var(--text-secondary);
    margin: var(--space-3) 0 0 0;
  }

  /* Narrative */
  .narrative-section {
    padding: var(--space-6);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .narrative-section p {
    margin: 0;
    font-size: var(--font-size-base);
    line-height: 1.8;
    color: var(--text-primary);
  }

  /* Standings */
  .standings-section,
  .stats-section {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .standings-section h2,
  .stats-section h2 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-4) 0;
    text-align: center;
  }

  .standings-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .stat-item {
    text-align: center;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .stat-value {
    display: block;
    font-size: var(--font-size-2xl);
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--accent-primary);
  }

  .stat-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--space-1);
  }

  /* Actions */
  .actions-section {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .btn {
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-base);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn--secondary {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .btn--secondary:hover {
    background: var(--bg-elevated);
    border-color: var(--border-hover);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .no-ending {
    text-align: center;
    padding: var(--space-12);
  }

  .no-ending p {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }

  @media (max-width: 600px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
