<!--
  GameHeader - Persistent header with quest tracker, reputation, and bounty

  Usage:
    <GameHeader
      phase="deployment"
      bounty={1500}
      reputations={reputationData}
      activeQuest={questData}
    />
-->
<script lang="ts">
  import type { FactionId, ReputationStatus, BattlePhase } from './types'
  import PhaseIndicator from './PhaseIndicator.svelte'
  import FactionBadge from './FactionBadge.svelte'

  interface ReputationSummary {
    factionId: FactionId
    value: number
    status: ReputationStatus
  }

  interface ActiveQuestSummary {
    title: string
    factionId: FactionId
    progress: { current: number; total: number }
  }

  interface Props {
    phase?: BattlePhase
    bounty: number
    reputations: ReputationSummary[]
    activeQuest?: ActiveQuestSummary | null
  }

  let {
    phase,
    bounty,
    reputations,
    activeQuest = null
  }: Props = $props()

  const statusColors: Record<ReputationStatus, string> = {
    devoted: 'var(--rep-devoted)',
    friendly: 'var(--rep-friendly)',
    neutral: 'var(--rep-neutral)',
    unfriendly: 'var(--rep-unfriendly)',
    hostile: 'var(--rep-hostile)'
  }

  function formatBounty(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`
    }
    return value.toString()
  }

  function formatRepValue(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`
  }
</script>

<header class="game-header">
  <div class="game-header__left">
    <h1 class="game-header__title">Space Fortress</h1>

    {#if activeQuest}
      <div class="quest-tracker">
        <FactionBadge faction={activeQuest.factionId} size="small" />
        <span class="quest-title">{activeQuest.title}</span>
        <span class="quest-progress">[{activeQuest.progress.current}/{activeQuest.progress.total}]</span>
      </div>
    {/if}
  </div>

  <div class="game-header__center">
    {#if phase}
      <PhaseIndicator currentPhase={phase} variant="compact" />
    {/if}
  </div>

  <div class="game-header__right">
    <div class="bounty-display">
      <span class="bounty-icon">💰</span>
      <span class="bounty-value">{formatBounty(bounty)} cr</span>
    </div>

    <div class="rep-summary">
      {#each reputations as rep}
        <div
          class="rep-mini"
          style="color: {statusColors[rep.status]}"
          title="{rep.factionId}: {formatRepValue(rep.value)}"
        >
          <FactionBadge faction={rep.factionId} size="small" />
          <span class="rep-value">{formatRepValue(rep.value)}</span>
        </div>
      {/each}
    </div>
  </div>
</header>

<style>
  .game-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .game-header__left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
    flex: 1;
  }

  .game-header__title {
    font-size: var(--font-size-lg);
    font-weight: 700;
    margin: 0;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;
  }

  .quest-tracker {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    min-width: 0;
  }

  .quest-title {
    color: var(--text-primary);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quest-progress {
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .game-header__center {
    display: flex;
    justify-content: center;
  }

  .game-header__right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .bounty-display {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .bounty-icon {
    font-size: var(--font-size-sm);
  }

  .bounty-value {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--stat-agility);
  }

  .rep-summary {
    display: flex;
    gap: var(--space-2);
  }

  .rep-mini {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
  }

  .rep-value {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .game-header {
      flex-direction: column;
      align-items: stretch;
    }

    .game-header__left {
      flex-direction: column;
      align-items: flex-start;
    }

    .game-header__center {
      order: -1;
    }

    .game-header__right {
      justify-content: space-between;
    }

    .rep-summary {
      flex-wrap: wrap;
    }
  }
</style>
