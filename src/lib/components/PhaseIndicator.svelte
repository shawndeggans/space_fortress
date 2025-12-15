<!--
  PhaseIndicator - Shows current position in game loop

  Variants:
  - full: Horizontal with labels (battle phases)
  - compact: Just dots (battle phases)
  - labeled: Dots with current phase name (battle phases)
  - gameFlow: Full quest flow (Quest Hub -> Narrative -> Alliance -> Battle -> Result)

  Usage:
    <PhaseIndicator currentPhase="deployment" />
    <PhaseIndicator currentPhase="execution" variant="compact" />
    <PhaseIndicator variant="gameFlow" phaseSteps={navigationView.phaseSteps} />
-->
<script lang="ts">
  import type { BattlePhase } from './types'
  import type { PhaseStep } from '$lib/game/projections/navigationView'

  interface Props {
    currentPhase?: BattlePhase
    variant?: 'full' | 'compact' | 'labeled' | 'gameFlow'
    phaseSteps?: PhaseStep[]
  }

  let { currentPhase, variant = 'full', phaseSteps = [] }: Props = $props()

  // Battle phases (for legacy variants)
  const phases: BattlePhase[] = ['narrative', 'commitment', 'deployment', 'execution', 'consequence']

  const phaseLabels: Record<BattlePhase, string> = {
    narrative: 'Narrative',
    commitment: 'Commit',
    deployment: 'Deploy',
    execution: 'Execute',
    consequence: 'Consequence'
  }

  let currentIndex = $derived(currentPhase ? phases.indexOf(currentPhase) : -1)
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

{:else if variant === 'labeled'}
  <!-- Labeled variant -->
  <div class="phase-indicator phase-indicator--labeled">
    <span class="current-label">{currentPhase ? phaseLabels[currentPhase].toUpperCase() : ''}</span>
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

{:else if variant === 'gameFlow'}
  <!-- Game Flow variant - full quest progression -->
  <div class="phase-indicator phase-indicator--game-flow" data-testid="phase-indicator">
    {#each phaseSteps as step, i}
      <div
        class="flow-step"
        class:flow-step--completed={step.status === 'completed'}
        class:flow-step--current={step.status === 'current'}
        class:flow-step--upcoming={step.status === 'upcoming'}
      >
        <span class="flow-dot">
          {#if step.status === 'completed'}
            ✓
          {:else if step.status === 'current'}
            ●
          {:else}
            ○
          {/if}
        </span>
        <span class="flow-label">{step.label}</span>
      </div>
      {#if i < phaseSteps.length - 1}
        <span
          class="flow-connector"
          class:flow-connector--completed={step.status === 'completed'}
        >→</span>
      {/if}
    {/each}
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

  /* Game Flow variant */
  .phase-indicator--game-flow {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .flow-step {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
  }

  .flow-dot {
    font-size: var(--font-size-xs);
    width: 1em;
    text-align: center;
    color: var(--text-dim);
  }

  .flow-step--completed .flow-dot {
    color: var(--success);
  }

  .flow-step--current .flow-dot {
    color: var(--accent-primary);
  }

  .flow-label {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
  }

  .flow-step--completed .flow-label {
    color: var(--text-secondary);
  }

  .flow-step--current .flow-label {
    color: var(--accent-primary);
    font-weight: 600;
  }

  .flow-connector {
    color: var(--text-dim);
    font-size: var(--font-size-xs);
  }

  .flow-connector--completed {
    color: var(--success);
  }

  /* Hide labels on mobile for game flow */
  @media (max-width: 640px) {
    .phase-indicator--game-flow .flow-label {
      display: none;
    }

    .phase-indicator--game-flow {
      gap: var(--space-1);
    }

    .flow-dot {
      font-size: var(--font-size-sm);
    }
  }
</style>
