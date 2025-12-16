<!--
  Quest Summary Screen
  Shows the complete summary of a quest: all reputation changes, cards, bounty, and choices.
  Provides closure before returning to quest hub.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectQuestSummaryView } from '$lib/slices/quest-summary'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import { goto } from '$app/navigation'

  // Derive view from game state
  let summaryView = $derived(projectQuestSummaryView($gameState))

  async function handleContinue() {
    const result = await gameState.handleCommand({
      type: 'ACKNOWLEDGE_QUEST_SUMMARY',
      data: {}
    })

    if (result.success) {
      // Check if all quests completed (ending screen)
      if (summaryView.remainingQuests <= 0) {
        goto('/ending')
      } else {
        goto('/quest-hub')
      }
    }
  }
</script>

<div class="summary-screen">
  <main class="summary-content">
    {#if summaryView.isReady}
      <header class="summary-header">
        <div class="outcome-badge" class:outcome-badge--completed={summaryView.outcome === 'completed'} class:outcome-badge--failed={summaryView.outcome === 'failed'}>
          Quest {summaryView.outcome === 'completed' ? 'Complete' : 'Failed'}
        </div>
        <h1>{summaryView.questTitle}</h1>
        <div class="quest-faction">
          <FactionBadge faction={summaryView.questFaction} showLabel size="small" />
        </div>
      </header>

      <!-- Choices Made -->
      {#if summaryView.choicesSummary.length > 0}
        <section class="section">
          <h2>Your Journey</h2>
          <ul class="choices-list">
            {#each summaryView.choicesSummary as choice, i}
              <li class="choice-item">
                <span class="choice-number">{i + 1}.</span>
                <span class="choice-label">{choice.choiceLabel}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Reputation Summary -->
      {#if summaryView.reputationSummary.length > 0}
        <section class="section">
          <h2>Final Standings</h2>
          <div class="rep-summary">
            {#each summaryView.reputationSummary as rep}
              <div class="rep-row">
                <FactionBadge faction={rep.factionId} showLabel size="small" />
                <div class="rep-change-info">
                  <span class="rep-start">{rep.startValue}</span>
                  <span class="rep-arrow">→</span>
                  <span class="rep-delta" class:positive={rep.netChange > 0} class:negative={rep.netChange < 0}>
                    {rep.netChange > 0 ? '+' : ''}{rep.netChange}
                  </span>
                  <span class="rep-end">{rep.endValue}</span>
                  <span class="rep-status">({rep.status})</span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Stats Summary -->
      <section class="section stats-section">
        <h2>Summary</h2>
        <div class="stats-grid">
          <!-- Bounty -->
          <div class="stat-item">
            <span class="stat-icon">💰</span>
            <span class="stat-label">Net Bounty</span>
            <span class="stat-value" class:positive={summaryView.netBounty > 0} class:negative={summaryView.netBounty < 0}>
              {summaryView.netBounty > 0 ? '+' : ''}{summaryView.netBounty} credits
            </span>
          </div>

          <!-- Cards -->
          <div class="stat-item">
            <span class="stat-icon">🃏</span>
            <span class="stat-label">Cards</span>
            <span class="stat-value">
              +{summaryView.cardsGained.length} gained, -{summaryView.cardsLost.length} lost
            </span>
          </div>

          <!-- Battles -->
          {#if summaryView.battlesWon > 0 || summaryView.battlesLost > 0 || summaryView.battlesDraw > 0}
            <div class="stat-item">
              <span class="stat-icon">⚔️</span>
              <span class="stat-label">Battles</span>
              <span class="stat-value">
                {summaryView.battlesWon}W / {summaryView.battlesLost}L / {summaryView.battlesDraw}D
              </span>
            </div>
          {/if}
        </div>
      </section>

      <!-- Cards Detail -->
      {#if summaryView.cardsGained.length > 0 || summaryView.cardsLost.length > 0}
        <section class="section">
          <h2>Card Changes</h2>
          <div class="cards-detail">
            {#if summaryView.cardsGained.length > 0}
              <div class="cards-group cards-gained">
                <h3>Gained</h3>
                {#each summaryView.cardsGained as card}
                  <div class="card-item">
                    <FactionBadge faction={card.factionId} size="small" />
                    <span class="card-name">{card.cardName}</span>
                  </div>
                {/each}
              </div>
            {/if}
            {#if summaryView.cardsLost.length > 0}
              <div class="cards-group cards-lost">
                <h3>Lost</h3>
                {#each summaryView.cardsLost as card}
                  <div class="card-item">
                    <FactionBadge faction={card.factionId} size="small" />
                    <span class="card-name">{card.cardName}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/if}

      <!-- Continue Button -->
      <footer class="continue-section">
        <div class="remaining-info">
          {#if summaryView.remainingQuests > 0}
            {summaryView.remainingQuests} quest{summaryView.remainingQuests !== 1 ? 's' : ''} remaining
          {:else}
            Your journey nears its end...
          {/if}
        </div>
        <button class="btn btn--primary" data-testid="btn-continue" onclick={handleContinue}>
          {#if summaryView.remainingQuests > 0}
            Return to Quest Hub
          {:else}
            View Your Legacy
          {/if}
        </button>
      </footer>
    {:else}
      <div class="no-summary">
        <p>No quest summary to display.</p>
        <button class="btn btn--primary" onclick={() => goto('/quest-hub')}>
          Return to Quest Hub
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .summary-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .summary-content {
    flex: 1;
    max-width: 700px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .summary-header {
    text-align: center;
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-default);
  }

  .outcome-badge {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    font-weight: 600;
    border-radius: var(--radius-md);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--space-3);
  }

  .outcome-badge--completed {
    background: color-mix(in srgb, var(--success) 20%, var(--bg-secondary));
    color: var(--success);
    border: 1px solid var(--success);
  }

  .outcome-badge--failed {
    background: color-mix(in srgb, var(--error) 20%, var(--bg-secondary));
    color: var(--error);
    border: 1px solid var(--error);
  }

  .summary-header h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--space-3) 0;
  }

  .quest-faction {
    display: flex;
    justify-content: center;
  }

  .section {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .section h2 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-4) 0;
  }

  .choices-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .choice-item {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .choice-number {
    color: var(--text-muted);
    font-weight: 600;
    min-width: 1.5rem;
  }

  .choice-label {
    color: var(--text-primary);
  }

  .rep-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .rep-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .rep-change-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .rep-start {
    color: var(--text-muted);
  }

  .rep-arrow {
    color: var(--text-dim);
  }

  .rep-delta {
    font-weight: 600;
  }

  .rep-delta.positive {
    color: var(--success);
  }

  .rep-delta.negative {
    color: var(--error);
  }

  .rep-end {
    font-weight: 600;
    color: var(--text-primary);
  }

  .rep-status {
    color: var(--text-muted);
    font-family: var(--font-sans);
    font-size: var(--font-size-xs);
  }

  .stats-section {
    background: var(--bg-tertiary);
  }

  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .stat-icon {
    font-size: var(--font-size-lg);
    width: 2rem;
    text-align: center;
  }

  .stat-label {
    color: var(--text-muted);
    flex: 1;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-value.positive {
    color: var(--success);
  }

  .stat-value.negative {
    color: var(--error);
  }

  .cards-detail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .cards-group h3 {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-2) 0;
  }

  .cards-gained h3 {
    color: var(--success);
  }

  .cards-lost h3 {
    color: var(--error);
  }

  .card-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
  }

  .card-name {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .continue-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .remaining-info {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-style: italic;
  }

  .btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
    font-weight: 600;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
    min-width: 250px;
  }

  .btn--primary:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .no-summary {
    text-align: center;
    padding: var(--space-12);
  }

  .no-summary p {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }

  @media (max-width: 500px) {
    .cards-detail {
      grid-template-columns: 1fr;
    }
  }
</style>
