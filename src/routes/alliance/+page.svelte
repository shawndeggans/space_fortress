<!--
  Alliance Screen
  Select a faction ally before battle.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectAllianceOptions, projectAllianceTermsView, projectPlayerState } from '$lib/game'
  import GameHeader from '$lib/components/GameHeader.svelte'
  import AllianceOption from '$lib/components/AllianceOption.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import type { FactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let allianceOptions = $derived(projectAllianceOptions([], $gameState))
  let playerState = $derived(projectPlayerState([], $gameState))

  // Modal state
  let selectedFaction = $state<FactionId | null>(null)
  let showTermsModal = $state(false)

  let termsView = $derived(selectedFaction ? projectAllianceTermsView([], selectedFaction, $gameState) : null)

  function viewTerms(factionId: FactionId) {
    selectedFaction = factionId
    showTermsModal = true
  }

  function closeModal() {
    showTermsModal = false
    selectedFaction = null
  }

  async function formAlliance() {
    if (!selectedFaction) return

    const result = await gameState.handleCommand({
      type: 'FORM_ALLIANCE',
      data: {
        factionId: selectedFaction
      }
    })

    if (result.success) {
      closeModal()
      goto('/card-pool')
    }
  }

  async function proceedWithoutAllies() {
    const result = await gameState.handleCommand({
      type: 'DECLINE_ALL_ALLIANCES',
      data: {}
    })

    if (result.success) {
      goto('/card-pool')
    }
  }
</script>

<div class="alliance-screen">
  {#if playerState}
    <GameHeader
      bounty={playerState.bounty}
      reputations={playerState.reputations.map(f => ({
        factionId: f.factionId,
        value: f.value,
        status: f.status
      }))}
      activeQuest={playerState.activeQuest ? {
        title: playerState.activeQuest.title,
        factionId: playerState.activeQuest.factionId,
        progress: { current: playerState.activeQuest.currentDilemmaIndex, total: playerState.activeQuest.totalDilemmas }
      } : null}
    />
  {/if}

  <main class="alliance-content">
    <header class="section-header">
      <h1>Form an Alliance</h1>
      {#if allianceOptions?.battleContext}
        <p class="context-text">{allianceOptions.battleContext}</p>
      {/if}
    </header>

    <!-- Available Allies -->
    <section class="allies-section">
      <div class="allies-grid">
        {#each allianceOptions?.options || [] as option}
          <AllianceOption
            faction={option.factionId}
            available={option.available}
            unavailableReason={option.unavailableReason}
            terms={option.available ? {
              cardProfile: option.cardProfile,
              cardCount: option.cardCount,
              bountyShare: option.bountyShare
            } : null}
            reputation={{
              value: option.currentReputation,
              status: option.reputationStatus
            }}
            onviewterms={option.available ? () => viewTerms(option.factionId) : undefined}
          />
        {/each}
      </div>
    </section>

    <!-- Proceed Alone Option -->
    <section class="alone-section">
      <button class="alone-btn" onclick={proceedWithoutAllies}>
        <span class="alone-title">Proceed Without Allies</span>
        <span class="alone-warning">
          {allianceOptions?.proceedAloneWarning || 'Warning: You will enter battle with only your current fleet.'}
        </span>
      </button>
    </section>
  </main>
</div>

{#if showTermsModal && termsView}
  <Modal title="Alliance Terms" onclose={closeModal} size="medium">
    <div class="terms-detail">
      <div class="terms-faction">
        <FactionBadge faction={termsView.factionId} showLabel size="medium" />
      </div>

      <div class="representative-box">
        <strong>{termsView.representativeName}</strong>
        <p class="representative-dialogue">"{termsView.representativeDialogue}"</p>
      </div>

      <div class="terms-section">
        <h4>Ships Provided ({termsView.cardsProvided.length})</h4>
        <div class="cards-list">
          {#each termsView.cardsProvided as card}
            <div class="card-preview">
              <span class="card-name">{card.name}</span>
              <span class="card-stats">⚔{card.attack} 🛡{card.armor} ⚡{card.agility}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="terms-section">
        <h4>Terms</h4>
        <div class="terms-list">
          <div class="term-item">
            <span class="term-label">Bounty share:</span>
            <span class="term-value">{termsView.bountyShare}%</span>
          </div>
          <div class="term-item">
            <span class="term-label">Battle role:</span>
            <span class="term-value">{termsView.battleRole}</span>
          </div>
          <div class="term-item">
            <span class="term-label">Reputation gain:</span>
            <span class="term-value rep-gain">+{termsView.reputationGain}</span>
          </div>
        </div>
      </div>

      {#if termsView.conflictWarnings.length > 0}
        <div class="terms-section warning-section">
          <h4>Warnings</h4>
          <div class="warnings-list">
            {#each termsView.conflictWarnings as warning}
              <div class="warning-item">
                <FactionBadge faction={warning.factionId} size="small" />
                <span class="warning-text">{warning.delta} with {warning.factionName}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    {#snippet actions()}
      <button class="btn btn--secondary" onclick={closeModal}>Cancel</button>
      {#if termsView.canAccept}
        <button class="btn btn--primary" onclick={formAlliance}>Form Alliance</button>
      {:else}
        <button class="btn btn--disabled" disabled>Cannot Accept</button>
      {/if}
    {/snippet}
  </Modal>
{/if}

<style>
  .alliance-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .alliance-content {
    flex: 1;
    max-width: 900px;
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
    margin: 0 0 var(--space-3) 0;
  }

  .context-text {
    color: var(--text-secondary);
    max-width: 500px;
    margin: 0 auto;
  }

  .allies-section {
    margin-bottom: var(--space-8);
  }

  .allies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .alone-section {
    padding-top: var(--space-6);
    border-top: 1px solid var(--border-default);
  }

  .alone-btn {
    width: 100%;
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .alone-btn:hover {
    border-color: var(--warning);
    background: var(--bg-tertiary);
  }

  .alone-title {
    display: block;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .alone-warning {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--warning);
  }

  /* Terms Modal Styles */
  .terms-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .terms-faction {
    display: flex;
    justify-content: center;
  }

  .representative-box {
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .representative-dialogue {
    margin: var(--space-2) 0 0;
    font-style: italic;
    color: var(--text-secondary);
  }

  .terms-section {
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }

  .terms-section h4 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-3) 0;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-preview {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2);
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .card-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  .card-stats {
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .terms-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .term-item {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .term-label {
    color: var(--text-muted);
  }

  .term-value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .rep-gain {
    color: var(--success);
  }

  .warning-section h4 {
    color: var(--warning);
  }

  .warnings-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .warning-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: color-mix(in srgb, var(--warning) 10%, var(--bg-tertiary));
    border-radius: var(--radius-sm);
  }

  .warning-text {
    color: var(--warning);
    font-size: var(--font-size-sm);
  }

  /* Button styles */
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
  }

  .btn--secondary {
    background: var(--bg-elevated);
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  .btn--secondary:hover {
    background: var(--bg-hover);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
  }

  .btn--disabled {
    background: var(--bg-tertiary);
    color: var(--text-dim);
    cursor: not-allowed;
  }
</style>
