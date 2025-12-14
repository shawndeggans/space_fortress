<!--
  GameHeader - Persistent header with menu, quest tracker, phase indicator, reputation, and bounty

  Usage:
    <GameHeader
      navigationView={navView}
      onSave={handleSave}
      onLoad={handleLoad}
      onMainMenu={handleMainMenu}
    />

    Or legacy mode (without navigationView):
    <GameHeader
      phase="deployment"
      bounty={1500}
      reputations={reputationData}
      activeQuest={questData}
    />
-->
<script lang="ts">
  import type { FactionId, ReputationStatus, BattlePhase } from './types'
  import type { NavigationView } from '$lib/game/projections/navigationView'
  import PhaseIndicator from './PhaseIndicator.svelte'
  import FactionBadge from './FactionBadge.svelte'
  import GameMenu from './GameMenu.svelte'

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
    // New navigation view prop
    navigationView?: NavigationView | null
    onSave?: () => void
    onLoad?: () => void
    onSettings?: () => void
    onMainMenu?: () => void
    // Legacy props (for backward compatibility)
    phase?: BattlePhase
    bounty?: number
    reputations?: ReputationSummary[]
    activeQuest?: ActiveQuestSummary | null
  }

  let {
    navigationView = null,
    onSave,
    onLoad,
    onSettings,
    onMainMenu,
    phase,
    bounty = 0,
    reputations = [],
    activeQuest = null
  }: Props = $props()

  // Use navigationView if provided, otherwise fall back to legacy props
  let effectiveBounty = $derived(navigationView?.bounty ?? bounty)
  let effectiveReputations = $derived(navigationView?.reputations ?? reputations)
  let effectiveQuestProgress = $derived(
    navigationView?.questProgress
      ? {
          title: navigationView.questProgress.title,
          factionId: navigationView.questProgress.factionId,
          progress: {
            current: navigationView.questProgress.current,
            total: navigationView.questProgress.total
          }
        }
      : activeQuest
  )
  let showGameFlow = $derived(navigationView !== null && navigationView.phaseSteps.length > 0)
  let canSave = $derived(navigationView?.canSave ?? true)

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

<header class="game-header" data-testid="game-header">
  <div class="game-header__row game-header__row--top">
    <div class="game-header__left">
      {#if navigationView}
        <GameMenu
          {canSave}
          {onSave}
          {onLoad}
          {onSettings}
          {onMainMenu}
        />
      {/if}

      <h1 class="game-header__title">Space Fortress</h1>

      {#if effectiveQuestProgress}
        <div class="quest-tracker">
          <FactionBadge faction={effectiveQuestProgress.factionId} size="small" />
          <span class="quest-title">{effectiveQuestProgress.title}</span>
          <span class="quest-progress">[{effectiveQuestProgress.progress.current}/{effectiveQuestProgress.progress.total}]</span>
        </div>
      {/if}
    </div>

    <div class="game-header__right">
      <div class="bounty-display">
        <span class="bounty-icon">💰</span>
        <span class="bounty-value">{formatBounty(effectiveBounty)} cr</span>
      </div>

      <div class="rep-summary">
        {#each effectiveReputations as rep}
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
  </div>

  {#if showGameFlow && navigationView}
    <div class="game-header__row game-header__row--phases">
      <PhaseIndicator variant="gameFlow" phaseSteps={navigationView.phaseSteps} />
    </div>
  {:else if phase}
    <div class="game-header__row game-header__row--phases">
      <PhaseIndicator currentPhase={phase} variant="compact" />
    </div>
  {/if}
</header>

<style>
  .game-header {
    display: flex;
    flex-direction: column;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
    gap: var(--space-2);
  }

  .game-header__row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .game-header__row--top {
    justify-content: space-between;
  }

  .game-header__row--phases {
    justify-content: center;
  }

  .game-header__left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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
      padding: var(--space-2) var(--space-3);
    }

    .game-header__row--top {
      flex-wrap: wrap;
    }

    .game-header__left {
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .game-header__title {
      font-size: var(--font-size-base);
    }

    .game-header__right {
      gap: var(--space-2);
    }

    .rep-summary {
      display: none; /* Hide on mobile to save space */
    }

    .quest-tracker {
      font-size: var(--font-size-xs);
      padding: var(--space-1) var(--space-2);
    }
  }
</style>
