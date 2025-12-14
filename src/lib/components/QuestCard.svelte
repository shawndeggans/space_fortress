<!--
  QuestCard - Displays a quest in the quest hub

  States:
  - available: Can be accepted
  - active: Currently in progress
  - locked: Reputation too low
  - completed: Already finished
  - failed: Quest failed

  Usage:
    <QuestCard
      quest={questData}
      state="available"
      on:click={handleSelect}
    />
    <QuestCard quest={questData} state="active" progress={{ current: 2, total: 4 }} />
-->
<script lang="ts">
  import type { QuestDisplayData, QuestState, FactionId } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface QuestProgress {
    current: number
    total: number
  }

  interface AllianceInfo {
    faction: FactionId
    bountyShare: number
  }

  interface Props {
    quest: QuestDisplayData
    state?: QuestState
    progress?: QuestProgress | null
    currentStep?: string | null
    alliance?: AllianceInfo | null
    onclick?: () => void
  }

  let {
    quest,
    state = 'available',
    progress = null,
    currentStep = null,
    alliance = null,
    onclick
  }: Props = $props()

  function renderBountyDots(level: number): string {
    const filled = '●'.repeat(level)
    const empty = '○'.repeat(5 - level)
    return filled + empty
  }

  function getRequiredRepText(rep: number | undefined): string {
    if (rep === undefined) return 'None'
    if (rep >= 75) return 'Devoted'
    if (rep >= 25) return 'Friendly'
    if (rep >= -24) return 'Neutral'
    if (rep >= -74) return 'Unfriendly'
    return 'Hostile'
  }
</script>

{#if state === 'available'}
  <button class="quest-card quest-card--available" onclick={onclick}>
    <header class="quest-card__header">
      <FactionBadge faction={quest.faction} showLabel size="small" />
    </header>

    <div class="quest-card__body">
      <h3 class="quest-card__title">{quest.title}</h3>
      <p class="quest-card__brief">{quest.brief}</p>
    </div>

    <footer class="quest-card__footer">
      <div class="quest-card__meta">
        <span class="quest-card__bounty" title="Bounty Level">
          <span class="label">Bounty:</span>
          <span class="dots">{renderBountyDots(quest.bountyLevel)}</span>
        </span>
        <span class="quest-card__rep-req">
          <span class="label">Rep req:</span>
          <span class="value">{getRequiredRepText(quest.reputationRequired)}</span>
        </span>
      </div>
    </footer>
  </button>

{:else if state === 'active'}
  <div class="quest-card quest-card--active">
    <header class="quest-card__header quest-card__header--active">
      <div class="header-left">
        <FactionBadge faction={quest.faction} size="small" />
        <span class="quest-card__title--active">{quest.title}</span>
      </div>
      {#if progress}
        <span class="quest-card__progress">[{progress.current}/{progress.total}]</span>
      {/if}
    </header>

    <div class="quest-card__body quest-card__body--active">
      {#if currentStep}
        <p class="quest-card__current-step">
          <span class="label">Current:</span> {currentStep}
        </p>
      {/if}
      {#if alliance}
        <p class="quest-card__alliance">
          <span class="label">Allies:</span>
          <FactionBadge faction={alliance.faction} size="small" />
          <span class="alliance-share">({alliance.bountyShare}%)</span>
        </p>
      {/if}
    </div>
  </div>

{:else if state === 'locked'}
  <div class="quest-card quest-card--locked">
    <div class="quest-card__locked-overlay">
      <span class="locked-title">{quest.title}</span>
    </div>
    <footer class="quest-card__locked-reason">
      <FactionBadge faction={quest.faction} size="small" />
      <span>Requires {getRequiredRepText(quest.reputationRequired)} reputation</span>
    </footer>
  </div>

{:else if state === 'completed'}
  <div class="quest-card quest-card--completed">
    <header class="quest-card__header">
      <FactionBadge faction={quest.faction} showLabel size="small" />
      <span class="quest-card__status quest-card__status--completed">✓ Completed</span>
    </header>
    <div class="quest-card__body">
      <h3 class="quest-card__title">{quest.title}</h3>
    </div>
  </div>

{:else if state === 'failed'}
  <div class="quest-card quest-card--failed">
    <header class="quest-card__header">
      <FactionBadge faction={quest.faction} showLabel size="small" />
      <span class="quest-card__status quest-card__status--failed">✗ Failed</span>
    </header>
    <div class="quest-card__body">
      <h3 class="quest-card__title">{quest.title}</h3>
    </div>
  </div>
{/if}

<style>
  .quest-card {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    overflow: hidden;
    text-align: left;
    width: 100%;
  }

  /* Available state */
  .quest-card--available {
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .quest-card--available:hover {
    border-color: var(--accent-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .quest-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-default);
  }

  .quest-card__body {
    padding: var(--space-4);
    flex: 1;
  }

  .quest-card__title {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
  }

  .quest-card__brief {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .quest-card__footer {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-default);
  }

  .quest-card__meta {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
  }

  .quest-card__bounty,
  .quest-card__rep-req {
    display: flex;
    gap: var(--space-2);
  }

  .label {
    color: var(--text-muted);
  }

  .dots {
    color: var(--stat-agility);
    letter-spacing: 0.1em;
  }

  .value {
    color: var(--text-secondary);
  }

  /* Active state */
  .quest-card--active {
    border-color: var(--accent-primary);
    background: var(--bg-elevated);
  }

  .quest-card__header--active {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-default);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .quest-card__title--active {
    font-weight: 600;
    color: var(--text-primary);
  }

  .quest-card__progress {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--accent-primary);
  }

  .quest-card__body--active {
    padding: var(--space-3);
  }

  .quest-card__current-step,
  .quest-card__alliance {
    margin: 0;
    font-size: var(--font-size-sm);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .quest-card__current-step {
    margin-bottom: var(--space-2);
  }

  .alliance-share {
    color: var(--text-muted);
  }

  /* Locked state */
  .quest-card--locked {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .quest-card__locked-overlay {
    padding: var(--space-6) var(--space-4);
    background: repeating-linear-gradient(
      45deg,
      var(--bg-tertiary),
      var(--bg-tertiary) 10px,
      var(--bg-secondary) 10px,
      var(--bg-secondary) 20px
    );
    text-align: center;
  }

  .locked-title {
    font-size: var(--font-size-base);
    color: var(--text-dim);
    font-weight: 500;
  }

  .quest-card__locked-reason {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-default);
  }

  /* Completed state */
  .quest-card--completed {
    opacity: 0.8;
  }

  .quest-card__status {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .quest-card__status--completed {
    color: var(--success);
  }

  /* Failed state */
  .quest-card--failed {
    opacity: 0.6;
  }

  .quest-card__status--failed {
    color: var(--error);
  }

  .quest-card--failed .quest-card__title {
    text-decoration: line-through;
    color: var(--text-muted);
  }
</style>
