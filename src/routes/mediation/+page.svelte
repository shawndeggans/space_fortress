<!--
  Mediation Screen
  Resolve disputes between factions by leaning toward one side.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectMediationView } from '$lib/game/projections/mediationView'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import type { FactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive view from game state
  let mediationView = $derived(projectMediationView([], undefined, $gameState))

  async function leanToward(factionId: FactionId) {
    const result = await gameState.handleCommand({
      type: 'LEAN_TOWARD_FACTION',
      data: { towardFactionId: factionId }
    })

    if (result.success) {
      // Navigate to alliance or card selection based on next phase
      goto('/alliance')
    }
  }

  async function refuseToLean() {
    const result = await gameState.handleCommand({
      type: 'REFUSE_TO_LEAN',
      data: {}
    })

    if (result.success) {
      // Navigate to alliance or card selection
      goto('/alliance')
    }
  }
</script>

<div class="mediation-screen">
  <main class="mediation-content">
    {#if mediationView}
      <header class="section-header">
        <h1>Mediation</h1>
        <p class="quest-title">{mediationView.questTitle}</p>
      </header>

      <!-- Facilitator -->
      <section class="facilitator-section">
        <div class="facilitator-badge">
          <FactionBadge faction={mediationView.facilitator.factionId} size="medium" showLabel />
        </div>
        <div class="facilitator-dialogue">
          <strong>{mediationView.facilitator.name}</strong>
          <p>{mediationView.facilitator.introDialogue}</p>
        </div>
      </section>

      <!-- Two Parties -->
      <section class="parties-section">
        {#each mediationView.parties as party, index}
          <div class="party-card" style="--faction-color: {party.factionColor}">
            <div class="party-header">
              <FactionBadge faction={party.factionId} size="small" showLabel />
              <span class="rep-status" class:hostile={party.reputationStatus === 'hostile'} class:friendly={party.reputationStatus === 'friendly'}>
                {party.reputationStatus}
              </span>
            </div>

            <div class="party-representative">
              <strong>{party.representativeName}</strong>
            </div>

            <div class="party-dialogue">
              <p>"{party.representativeDialogue}"</p>
            </div>

            <div class="party-position">
              <span class="position-label">Position:</span>
              <span class="position-value">{party.position}</span>
            </div>

            <div class="party-demands">
              <span class="demands-label">Demands:</span>
              <ul class="demands-list">
                {#each party.demands as demand}
                  <li>{demand}</li>
                {/each}
              </ul>
            </div>
          </div>
        {/each}
      </section>

      <!-- Lean Options -->
      <section class="options-section">
        <h2>Your Decision</h2>
        <p class="options-intro">Which side do you lean toward?</p>

        <div class="lean-options">
          {#each mediationView.leanOptions as option}
            <button
              class="lean-btn"
              data-testid="btn-lean-{option.towardFactionId}"
              onclick={() => leanToward(option.towardFactionId)}
              disabled={mediationView.hasLeaned}
            >
              <div class="lean-header">
                <span class="lean-toward">
                  Lean toward <strong>{option.towardName}</strong>
                </span>
              </div>

              <div class="lean-preview">
                {option.outcomePreview}
              </div>

              <div class="lean-effects">
                {#each option.reputationEffects as effect}
                  <span class="rep-effect" class:positive={effect.isPositive} class:negative={!effect.isPositive}>
                    {effect.factionIcon} {effect.delta > 0 ? '+' : ''}{effect.delta}
                  </span>
                {/each}
              </div>

              <div class="lean-bounty">
                Bounty modifier: {option.bountyModifier}%
              </div>
            </button>
          {/each}
        </div>

        <!-- Refuse Option -->
        {#if mediationView.canRefuseToLean && !mediationView.hasLeaned}
          <button
            class="refuse-btn"
            data-testid="btn-refuse-mediation"
            onclick={refuseToLean}
          >
            <span class="refuse-title">Refuse to Choose a Side</span>
            <span class="refuse-warning">{mediationView.refuseWarning}</span>
          </button>
        {/if}
      </section>

      <!-- Already Leaned -->
      {#if mediationView.hasLeaned}
        <section class="leaned-section">
          <p class="leaned-message">
            You have leaned toward <strong>{mediationView.leanedToward}</strong>.
            The facilitator is working on a compromise.
          </p>
          <button
            class="continue-btn"
            data-testid="btn-continue-after-mediation"
            onclick={() => goto('/alliance')}
          >
            Continue
          </button>
        </section>
      {/if}
    {:else}
      <div class="no-mediation">
        <h2>No Active Mediation</h2>
        <p>There is no mediation currently in progress.</p>
        <button onclick={() => goto('/')}>Return to Menu</button>
      </div>
    {/if}
  </main>
</div>

<style>
  .mediation-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .mediation-content {
    flex: 1;
    max-width: 1000px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
  }

  .section-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }

  .section-header h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .quest-title {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  /* Facilitator */
  .facilitator-section {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-6);
  }

  .facilitator-dialogue {
    flex: 1;
  }

  .facilitator-dialogue p {
    margin: var(--space-2) 0 0;
    font-style: italic;
    color: var(--text-secondary);
  }

  /* Parties */
  .parties-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .party-card {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 2px solid var(--faction-color, var(--border-default));
    border-radius: var(--radius-lg);
  }

  .party-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }

  .rep-status {
    font-size: var(--font-size-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .rep-status.hostile {
    background: color-mix(in srgb, var(--error) 20%, var(--bg-tertiary));
    color: var(--error);
  }

  .rep-status.friendly {
    background: color-mix(in srgb, var(--success) 20%, var(--bg-tertiary));
    color: var(--success);
  }

  .party-representative {
    margin-bottom: var(--space-2);
    color: var(--text-primary);
  }

  .party-dialogue {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-3);
  }

  .party-dialogue p {
    margin: 0;
    font-style: italic;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .party-position,
  .party-demands {
    margin-bottom: var(--space-2);
  }

  .position-label,
  .demands-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .position-value {
    font-weight: 600;
    color: var(--text-primary);
    margin-left: var(--space-2);
  }

  .demands-list {
    margin: var(--space-1) 0 0;
    padding-left: var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  /* Options */
  .options-section {
    margin-bottom: var(--space-6);
  }

  .options-section h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .options-intro {
    color: var(--text-secondary);
    margin-bottom: var(--space-4);
  }

  .lean-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .lean-btn {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .lean-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--bg-tertiary);
  }

  .lean-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .lean-header {
    margin-bottom: var(--space-2);
  }

  .lean-toward {
    color: var(--text-primary);
    font-size: var(--font-size-base);
  }

  .lean-preview {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-3);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .lean-effects {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .rep-effect {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
  }

  .rep-effect.positive {
    background: color-mix(in srgb, var(--success) 15%, var(--bg-tertiary));
    color: var(--success);
  }

  .rep-effect.negative {
    background: color-mix(in srgb, var(--error) 15%, var(--bg-tertiary));
    color: var(--error);
  }

  .lean-bounty {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .refuse-btn {
    width: 100%;
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .refuse-btn:hover {
    border-color: var(--warning);
    background: color-mix(in srgb, var(--warning) 5%, var(--bg-tertiary));
  }

  .refuse-title {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }

  .refuse-warning {
    font-size: var(--font-size-sm);
    color: var(--warning);
  }

  /* Leaned state */
  .leaned-section {
    text-align: center;
    padding: var(--space-6);
    background: color-mix(in srgb, var(--success) 10%, var(--bg-secondary));
    border: 1px solid var(--success);
    border-radius: var(--radius-lg);
  }

  .leaned-message {
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  .continue-btn {
    padding: var(--space-3) var(--space-6);
    background: var(--accent-gradient);
    border: none;
    border-radius: var(--radius-md);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .continue-btn:hover {
    opacity: 0.9;
  }

  /* No mediation fallback */
  .no-mediation {
    text-align: center;
    padding: var(--space-8);
  }

  .no-mediation h2 {
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .no-mediation p {
    color: var(--text-secondary);
    margin-bottom: var(--space-4);
  }

  .no-mediation button {
    padding: var(--space-2) var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .parties-section,
    .lean-options {
      grid-template-columns: 1fr;
    }
  }
</style>
