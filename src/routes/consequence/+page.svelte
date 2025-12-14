<!--
  Consequence Screen
  Shows battle outcome, bounty breakdown, and reputation changes.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectConsequenceView } from '$lib/game'
  import BountyDisplay from '$lib/components/BountyDisplay.svelte'
  import ConsequenceItem from '$lib/components/ConsequenceItem.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import type { FactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let consequenceView = $derived(projectConsequenceView([], undefined, $gameState))

  async function handleContinue() {
    const result = await gameState.handleCommand({
      type: 'ACKNOWLEDGE_OUTCOME',
      data: { battleId: consequenceView?.battleId || 'battle-1' }
    })

    if (result.success) {
      // Navigate based on what comes next
      if (consequenceView?.hasNextDilemma) {
        goto('/narrative')
      } else if (consequenceView?.questComplete) {
        // Check if game is ending
        if ($gameState.completedQuests.length >= 3) {
          goto('/ending')
        } else {
          goto('/quest-hub')
        }
      } else {
        goto('/narrative')
      }
    }
  }
</script>

<div class="consequence-screen">
  <main class="consequence-content">
    {#if consequenceView}
      <header class="outcome-header">
        <h1>Battle Outcome</h1>
        <div class="outcome-badge" class:outcome-badge--victory={consequenceView.outcome === 'victory'} class:outcome-badge--defeat={consequenceView.outcome === 'defeat'}>
          {#if consequenceView.outcome === 'victory'}
            Victory
          {:else if consequenceView.outcome === 'defeat'}
            Defeat
          {:else}
            Draw
          {/if}
        </div>
      </header>

      <!-- Narrative Text -->
      {#if consequenceView.narrativeText}
        <section class="narrative-box">
          <p>{consequenceView.narrativeText}</p>
        </section>
      {/if}

      <!-- Bounty Section -->
      <section class="section">
        <h2>Bounty</h2>
        <BountyDisplay
          base={consequenceView.bounty.baseReward}
          shares={consequenceView.bounty.shares.map(s => ({
            faction: s.factionId,
            percent: s.percentage,
            amount: s.amount
          }))}
          bonuses={consequenceView.bounty.modifiers.filter(m => m.isPositive).map(m => ({ reason: m.reason, amount: m.amount }))}
          penalties={consequenceView.bounty.modifiers.filter(m => !m.isPositive).map(m => ({ reason: m.reason, amount: Math.abs(m.amount) }))}
          net={consequenceView.bounty.netReward}
          variant="full"
        />
      </section>

      <!-- Reputation Changes -->
      {#if consequenceView.reputationChanges.length > 0}
        <section class="section">
          <h2>Reputation Changes</h2>
          <div class="rep-changes">
            {#each consequenceView.reputationChanges as change}
              <div class="rep-change">
                <FactionBadge faction={change.factionId} showLabel size="small" />
                <span class="rep-delta" class:positive={change.delta > 0} class:negative={change.delta < 0}>
                  {change.delta > 0 ? '+' : ''}{change.delta}
                </span>
                <span class="rep-arrow">→</span>
                <span class="rep-new">{change.newValue} ({change.newStatus})</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Cards Gained/Lost -->
      {#if consequenceView.cardsGained.length > 0 || consequenceView.cardsLost.length > 0}
        <section class="section">
          <h2>Card Changes</h2>
          <div class="card-changes">
            {#each consequenceView.cardsGained as card}
              <ConsequenceItem
                type="card_gained"
                content={card.cardName}
                faction={card.factionId}
              />
            {/each}
            {#each consequenceView.cardsLost as card}
              <ConsequenceItem
                type="card_lost"
                content={card.cardName}
                faction={card.factionId}
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Continue Button -->
      <footer class="continue-section">
        <button class="btn btn--primary" data-testid="btn-continue" onclick={handleContinue}>
          {#if consequenceView.hasNextDilemma}
            Continue
            <span class="btn-hint">A new dilemma awaits...</span>
          {:else if consequenceView.questComplete}
            Complete Quest
          {:else}
            Continue
          {/if}
        </button>
      </footer>
    {:else}
      <div class="no-consequence">
        <p>No battle outcome to display.</p>
        <button class="btn btn--primary" onclick={() => goto('/quest-hub')}>
          Return to Quest Hub
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .consequence-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .consequence-content {
    flex: 1;
    max-width: 700px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .outcome-header {
    text-align: center;
  }

  .outcome-header h1 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-3) 0;
  }

  .outcome-badge {
    display: inline-block;
    padding: var(--space-2) var(--space-6);
    font-size: var(--font-size-2xl);
    font-weight: 700;
    border-radius: var(--radius-md);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: var(--bg-secondary);
    color: var(--text-muted);
  }

  .outcome-badge--victory {
    background: color-mix(in srgb, var(--success) 20%, var(--bg-secondary));
    color: var(--success);
    border: 2px solid var(--success);
  }

  .outcome-badge--defeat {
    background: color-mix(in srgb, var(--error) 20%, var(--bg-secondary));
    color: var(--error);
    border: 2px solid var(--error);
  }

  .narrative-box {
    padding: var(--space-5);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .narrative-box p {
    margin: 0;
    font-size: var(--font-size-base);
    line-height: 1.8;
    color: var(--text-primary);
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

  .rep-changes {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .rep-change {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .rep-delta {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--font-size-base);
  }

  .rep-delta.positive {
    color: var(--success);
  }

  .rep-delta.negative {
    color: var(--error);
  }

  .rep-arrow {
    color: var(--text-dim);
  }

  .rep-new {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .card-changes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .continue-section {
    display: flex;
    justify-content: center;
    margin-top: var(--space-4);
  }

  .btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
    font-weight: 600;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
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

  .btn-hint {
    font-size: var(--font-size-sm);
    font-weight: 400;
    opacity: 0.8;
  }

  .no-consequence {
    text-align: center;
    padding: var(--space-12);
  }

  .no-consequence p {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }
</style>
