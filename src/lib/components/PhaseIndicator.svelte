<!--
  PhaseIndicator - Shows current position in game loop

  Variants:
  - full: Horizontal with labels
  - compact: Just dots
  - labeled: Dots with current phase name

  Usage:
    <PhaseIndicator currentPhase="deployment" />
    <PhaseIndicator currentPhase="execution" variant="compact" />
-->
<script lang="ts">
  import type { BattlePhase } from './types'

  interface Props {
    currentPhase: BattlePhase
    variant?: 'full' | 'compact' | 'labeled'
  }

  let { currentPhase, variant = 'full' }: Props = $props()

  const phases: BattlePhase[] = ['narrative', 'commitment', 'deployment', 'execution', 'consequence']

  const phaseLabels: Record<BattlePhase, string> = {
    narrative: 'Narrative',
    commitment: 'Commit',
    deployment: 'Deploy',
    execution: 'Execute',
    consequence: 'Consequence'
  }

  let currentIndex = $derived(phases.indexOf(currentPhase))
</script>

{#if variant === 'full'}
  <div class="phase-indicator phase-indicator--full">
    {#each phases as phase, i}
      <div class="phase" class:phase--active={phase === currentPhase} class:phase--completed={i < currentIndex}>
        <span class="phase-dot">{i < currentIndex ? '●' : phase === currentPhase ? '●' : '○'}</span>
        <span class="phase-label">{phaseLabels[phase]}</span>
      </div>
      {#if i < phases.length - 1}
        <span class="phase-connector" class:phase-connector--completed={i < currentIndex}>→</span>
      {/if}
    {/each}
  </div>

{:else if variant === 'compact'}
  <div class="phase-indicator phase-indicator--compact">
    {#each phases as phase, i}
      <span
        class="dot"
        class:dot--active={phase === currentPhase}
        class:dot--completed={i < currentIndex}
      >{i < currentIndex ? '●' : phase === currentPhase ? '●' : '○'}</span>
    {/each}
  </div>

{:else}
  <!-- Labeled variant -->
  <div class="phase-indicator phase-indicator--labeled">
    <span class="current-label">{phaseLabels[currentPhase].toUpperCase()}</span>
    <div class="dots">
      {#each phases as phase, i}
        <span
          class="dot"
          class:dot--active={phase === currentPhase}
          class:dot--completed={i < currentIndex}
        >{i < currentIndex ? '●' : phase === currentPhase ? '●' : '○'}</span>
      {/each}
    </div>
    <span class="progress">{currentIndex + 1} / {phases.length}</span>
  </div>
{/if}

<style>
  .phase-indicator--full {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    min-width: fit-content;
  }

  .phase-dot {
    font-size: var(--font-size-sm);
    color: var(--text-dim);
  }

  .phase--active .phase-dot {
    color: var(--accent-primary);
  }

  .phase--completed .phase-dot {
    color: var(--success);
  }

  .phase-label {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
    white-space: nowrap;
  }

  .phase--active .phase-label {
    color: var(--accent-primary);
    font-weight: 600;
  }

  .phase--completed .phase-label {
    color: var(--text-secondary);
  }

  .phase-connector {
    color: var(--text-dim);
    font-size: var(--font-size-sm);
  }

  .phase-connector--completed {
    color: var(--success);
  }

  /* Compact variant */
  .phase-indicator--compact {
    display: flex;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .dot {
    color: var(--text-dim);
  }

  .dot--active {
    color: var(--accent-primary);
  }

  .dot--completed {
    color: var(--success);
  }

  /* Labeled variant */
  .phase-indicator--labeled {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .current-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--accent-primary);
    letter-spacing: 0.05em;
  }

  .dots {
    display: flex;
    gap: var(--space-2);
  }

  .progress {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
  }
</style>
