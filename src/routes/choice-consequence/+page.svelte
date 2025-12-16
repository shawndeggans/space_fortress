<!--
  Choice Consequence Screen
  Shows the aftermath of a narrative choice: reputation, cards, bounty changes.
  Provides a cinematic pause between choice and next phase.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectChoiceConsequenceView } from '$lib/slices/choice-consequence'
  import ConsequenceItem from '$lib/components/ConsequenceItem.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import { goto } from '$app/navigation'
  import { navigateToPhase } from '$lib/navigation'

  // Derive view from game state
  let consequenceView = $derived(projectChoiceConsequenceView($gameState))

  async function handleContinue() {
    const result = await gameState.handleCommand({
      type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE',
      data: {}
    })

    if (result.success) {
      // Navigate based on what comes next
      const nextPhase = $gameState.currentPhase

      if (nextPhase === 'alliance') {
        navigateToPhase('alliance')
      } else if (nextPhase === 'mediation') {
        navigateToPhase('mediation')
      } else if (nextPhase === 'quest_summary') {
        goto('/quest-summary')
      } else if (nextPhase === 'narrative') {
        navigateToPhase('narrative')
      } else {
        // Fallback - check the consequence view for hints
        if (consequenceView.triggersNext === 'battle' || consequenceView.triggersNext === 'alliance') {
          navigateToPhase('alliance')
        } else if (consequenceView.triggersNext === 'mediation') {
          navigateToPhase('mediation')
        } else if (consequenceView.triggersNext === 'quest_complete') {
          goto('/quest-summary')
        } else {
          navigateToPhase('narrative')
        }
      }
    }
  }
</script>

<div class="consequence-screen">
  <main class="consequence-content">
    {#if consequenceView.isReady}
      <header class="outcome-header">
        <span class="quest-title">{consequenceView.questTitle}</span>
        <h1>Your Choice Echoes...</h1>
        <div class="choice-label">
          "{consequenceView.choiceLabel}"
        </div>
      </header>

      <!-- Narrative Aftermath -->
      {#if consequenceView.narrativeText}
        <section class="narrative-box">
          <p>{consequenceView.narrativeText}</p>
        </section>
      {/if}

      <!-- Consequences Section -->
      {#if consequenceView.reputationChanges.length > 0 || consequenceView.cardsGained.length > 0 || consequenceView.cardsLost.length > 0 || consequenceView.bountyChange}
        <section class="section">
          <h2>Consequences</h2>

          <!-- Reputation Changes -->
          {#if consequenceView.reputationChanges.length > 0}
            <div class="rep-changes">
              {#each consequenceView.reputationChanges as change}
                <div class="rep-change">
                  <FactionBadge faction={change.factionId} showLabel size="small" />
                  <span class="rep-delta" class:positive={change.isPositive} class:negative={!change.isPositive}>
                    {change.delta > 0 ? '+' : ''}{change.delta}
                  </span>
                  <span class="rep-arrow">→</span>
                  <span class="rep-new">{change.newValue} ({change.status})</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Card Changes -->
          {#if consequenceView.cardsGained.length > 0 || consequenceView.cardsLost.length > 0}
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
          {/if}

          <!-- Bounty Change -->
          {#if consequenceView.bountyChange}
            <div class="bounty-change" class:positive={consequenceView.bountyChange.isPositive} class:negative={!consequenceView.bountyChange.isPositive}>
              <span class="bounty-icon">💰</span>
              <span class="bounty-amount">
                {consequenceView.bountyChange.amount > 0 ? '+' : ''}{consequenceView.bountyChange.amount} credits
              </span>
              <span class="bounty-total">(Now: {consequenceView.bountyChange.newTotal})</span>
            </div>
          {/if}
        </section>
      {:else}
        <section class="section section--empty">
          <p class="empty-text">Your choice was noted. The consequences will unfold...</p>
        </section>
      {/if}

      <!-- Continue Button -->
      <footer class="continue-section">
        <button class="btn btn--primary" data-testid="btn-continue" onclick={handleContinue}>
          Continue
          <span class="btn-hint">{consequenceView.nextPhaseHint}</span>
        </button>
      </footer>
    {:else}
      <div class="no-consequence">
        <p>No choice outcome to display.</p>
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

  .quest-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: var(--space-2);
  }

  .outcome-header h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--space-4) 0;
  }

  .choice-label {
    display: inline-block;
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-base);
    font-style: italic;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-default);
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

  .section--empty {
    text-align: center;
    padding: var(--space-6);
  }

  .empty-text {
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
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
    margin-bottom: var(--space-4);
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
    margin-bottom: var(--space-4);
  }

  .bounty-change {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .bounty-change.positive {
    border-left: 3px solid var(--success);
  }

  .bounty-change.negative {
    border-left: 3px solid var(--error);
  }

  .bounty-icon {
    font-size: var(--font-size-lg);
  }

  .bounty-amount {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--font-size-base);
  }

  .bounty-change.positive .bounty-amount {
    color: var(--success);
  }

  .bounty-change.negative .bounty-amount {
    color: var(--error);
  }

  .bounty-total {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
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
    font-style: italic;
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
