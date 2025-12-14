<!--
  Alliance Screen
  Select a faction ally before battle.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectAllianceOptions, projectAllianceTermsView, projectPlayerState } from '$lib/game/projections'
  import GameHeader from '$lib/components/GameHeader.svelte'
  import AllianceOption from '$lib/components/AllianceOption.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import Card from '$lib/components/Card.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import NpcVoiceBox from '$lib/components/NpcVoiceBox.svelte'
  import type { CardDisplayData, FactionId, ExtendedFactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let allianceOptions = $derived(projectAllianceOptions([], $gameState))
  let playerState = $derived(projectPlayerState([], $gameState))

  // Modal state
  let selectedFaction = $state<FactionId | null>(null)
  let showTermsModal = $state(false)

  let termsView = $derived(selectedFaction ? projectAllianceTermsView([], $gameState, selectedFaction) : null)

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
        factionId: selectedFaction,
        questId: $gameState.activeQuest?.questId || ''
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
      data: { questId: $gameState.activeQuest?.questId || '' }
    })

    if (result.success) {
      goto('/card-pool')
    }
  }

  function toCardDisplayData(card: { id: string; name: string; faction: FactionId; attack: number; armor: number; agility: number }): CardDisplayData {
    return {
      id: card.id,
      name: card.name,
      faction: card.faction,
      attack: card.attack,
      armor: card.armor,
      agility: card.agility
    }
  }
</script>

<div class="alliance-screen">
  <GameHeader
    bounty={playerState.bounty}
    reputations={playerState.factionSummaries.map(f => ({
      factionId: f.factionId,
      value: f.value,
      status: f.status
    }))}
    activeQuest={playerState.activeQuest ? {
      title: playerState.activeQuest.title,
      factionId: playerState.activeQuest.faction,
      progress: playerState.activeQuest.progress
    } : null}
  />

  <main class="alliance-content">
    <header class="section-header">
      <h1>Form an Alliance</h1>
      {#if allianceOptions?.context}
        <p class="context-text">{allianceOptions.context}</p>
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
              value: option.reputation,
              status: option.status
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
          Warning: You will enter battle with only your current fleet.
          This is not recommended.
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

      {#if termsView.npc}
        <NpcVoiceBox
          npc={{
            name: termsView.npc.name,
            faction: termsView.factionId as ExtendedFactionId,
            portrait: termsView.npc.portrait
          }}
          dialogue={termsView.npc.dialogue}
          variant="compact"
        />
      {/if}

      <div class="terms-section">
        <h4>Cards Provided</h4>
        <div class="cards-preview">
          {#each termsView.cards as card}
            <Card
              card={toCardDisplayData(card)}
              size="compact"
              state="default"
            />
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
          {#if termsView.battleRole}
            <div class="term-item">
              <span class="term-label">Battle role:</span>
              <span class="term-value">{termsView.battleRole}</span>
            </div>
          {/if}
        </div>
      </div>

      {#if termsView.reputationEffects.length > 0}
        <div class="terms-section">
          <h4>Reputation Effects</h4>
          <div class="rep-effects">
            {#each termsView.reputationEffects as effect}
              <div class="rep-effect">
                <FactionBadge faction={effect.factionId} size="small" />
                <span class="rep-delta" class:positive={effect.delta > 0}>
                  {effect.delta > 0 ? '+' : ''}{effect.delta}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    {#snippet actions()}
      <button class="btn btn--secondary" onclick={closeModal}>Cancel</button>
      <button class="btn btn--primary" onclick={formAlliance}>Form Alliance</button>
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

  .cards-preview {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
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

  .rep-effects {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .rep-effect {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .rep-delta {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .rep-delta.positive {
    color: var(--success);
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
</style>
