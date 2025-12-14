<!--
  Quest Hub Screen
  Entry point for selecting quests. Shows available, locked, and completed quests.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectQuestList, projectPlayerState } from '$lib/game'
  import GameHeader from '$lib/components/GameHeader.svelte'
  import QuestCard from '$lib/components/QuestCard.svelte'
  import Modal from '$lib/components/Modal.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import ConsequenceItem from '$lib/components/ConsequenceItem.svelte'
  import type { QuestDisplayData, FactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let questList = $derived(projectQuestList([], $gameState))
  let playerState = $derived(projectPlayerState([], $gameState))

  // Modal state
  let selectedQuest = $state<typeof questList.available[0] | null>(null)
  let showQuestDetail = $state(false)

  function handleQuestClick(quest: typeof questList.available[0]) {
    selectedQuest = quest
    showQuestDetail = true
  }

  function closeModal() {
    showQuestDetail = false
    selectedQuest = null
  }

  async function acceptQuest() {
    if (!selectedQuest) return

    const result = await gameState.handleCommand({
      type: 'ACCEPT_QUEST',
      data: { questId: selectedQuest.id }
    })

    if (result.success) {
      closeModal()
      goto('/narrative')
    }
  }

  function declineQuest() {
    closeModal()
  }

  // Transform quest data for QuestCard component
  function toQuestDisplayData(quest: typeof questList.available[0]): QuestDisplayData {
    return {
      id: quest.id,
      title: quest.title,
      faction: quest.faction,
      brief: quest.brief,
      bountyLevel: quest.bountyLevel,
      reputationRequired: quest.reputationRequired
    }
  }
</script>

<div class="quest-hub-screen">
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

  <main class="quest-hub-content">
    <header class="section-header">
      <h1>Quest Hub</h1>
      <p class="section-subtitle">Choose your next contract</p>
    </header>

    {#if questList.available.length > 0}
      <section class="quest-section">
        <h2 class="section-title">Available Quests</h2>
        <div class="quest-grid">
          {#each questList.available as quest}
            <QuestCard
              quest={toQuestDisplayData(quest)}
              state="available"
              onclick={() => handleQuestClick(quest)}
            />
          {/each}
        </div>
      </section>
    {/if}

    {#if questList.locked.length > 0}
      <section class="quest-section">
        <h2 class="section-title">Locked Quests</h2>
        <div class="quest-grid">
          {#each questList.locked as quest}
            <QuestCard
              quest={toQuestDisplayData(quest)}
              state="locked"
            />
          {/each}
        </div>
      </section>
    {/if}

    {#if questList.completed.length > 0}
      <section class="quest-section">
        <h2 class="section-title">Completed Quests</h2>
        <div class="quest-grid">
          {#each questList.completed as quest}
            <QuestCard
              quest={toQuestDisplayData(quest)}
              state="completed"
            />
          {/each}
        </div>
      </section>
    {/if}

    {#if questList.available.length === 0 && questList.locked.length === 0 && questList.completed.length === 0}
      <div class="empty-state">
        <p>No quests available at this time.</p>
      </div>
    {/if}
  </main>
</div>

{#if showQuestDetail && selectedQuest}
  <Modal title={selectedQuest.title} onclose={closeModal} size="medium">
    <div class="quest-detail">
      <div class="quest-detail__faction">
        <FactionBadge faction={selectedQuest.faction} showLabel size="medium" />
      </div>

      <div class="quest-detail__description">
        <p>{selectedQuest.description}</p>
      </div>

      {#if selectedQuest.giver}
        <div class="quest-detail__giver">
          <h4>Quest Giver</h4>
          <div class="giver-info">
            <FactionBadge faction={selectedQuest.giver.faction} size="small" />
            <span class="giver-name">{selectedQuest.giver.name}</span>
          </div>
          <p class="giver-quote">"{selectedQuest.giver.quote}"</p>
        </div>
      {/if}

      <div class="quest-detail__rewards">
        <h4>Initial Rewards</h4>
        <div class="consequences-list">
          {#each selectedQuest.initialRewards.cards as card}
            <ConsequenceItem
              type="card_gained"
              content={card.name}
              faction={card.faction}
            />
          {/each}
          {#each selectedQuest.initialRewards.reputation as rep}
            <ConsequenceItem
              type={rep.delta > 0 ? 'rep_up' : 'rep_down'}
              content="{rep.faction} {rep.delta > 0 ? '+' : ''}{rep.delta}"
            />
          {/each}
        </div>
      </div>

      {#if selectedQuest.warnings.length > 0}
        <div class="quest-detail__warnings">
          <h4>Warnings</h4>
          <div class="consequences-list">
            {#each selectedQuest.warnings as warning}
              <ConsequenceItem
                type="risk"
                content={warning}
              />
            {/each}
          </div>
        </div>
      {/if}
    </div>

    {#snippet actions()}
      <button class="btn btn--secondary" onclick={declineQuest}>Decline</button>
      <button class="btn btn--primary" onclick={acceptQuest}>Accept Quest</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .quest-hub-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .quest-hub-content {
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
  }

  .section-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }

  .section-header h1 {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 var(--space-2) 0;
  }

  .section-subtitle {
    color: var(--text-muted);
    font-size: var(--font-size-lg);
    margin: 0;
  }

  .quest-section {
    margin-bottom: var(--space-8);
  }

  .section-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 var(--space-4) 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .quest-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12);
    color: var(--text-muted);
  }

  /* Quest Detail Modal Styles */
  .quest-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .quest-detail__faction {
    display: flex;
    justify-content: center;
  }

  .quest-detail__description {
    color: var(--text-secondary);
    line-height: 1.7;
  }

  .quest-detail__description p {
    margin: 0;
  }

  .quest-detail__giver {
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .quest-detail__giver h4 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .giver-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .giver-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .giver-quote {
    margin: 0;
    font-style: italic;
    color: var(--text-secondary);
  }

  .quest-detail__rewards,
  .quest-detail__warnings {
    border-top: 1px solid var(--border-default);
    padding-top: var(--space-4);
  }

  .quest-detail__rewards h4,
  .quest-detail__warnings h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .consequences-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Button styles for modal */
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
