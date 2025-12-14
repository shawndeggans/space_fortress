<!--
  DiceRoll - Shows attack roll resolution during battle

  Variants:
  - full: Complete breakdown with animation
  - compact: Inline version for log

  Usage:
    <DiceRoll roll={14} attackBonus={5} targetArmor={4} result="hit" />
    <DiceRoll roll={8} attackBonus={3} targetArmor={5} result="miss" variant="compact" />
-->
<script lang="ts">
  import type { DiceRollData } from './types'

  interface Props {
    roll: number
    attackBonus: number
    targetArmor: number
    result: 'hit' | 'miss'
    variant?: 'full' | 'compact'
    animate?: boolean
    attacker?: string  // Name of attacker for context
  }

  let {
    roll,
    attackBonus,
    targetArmor,
    result,
    variant = 'full',
    animate = false,
    attacker
  }: Props = $props()

  let total = $derived(roll + attackBonus)
  let targetValue = $derived(10 + targetArmor)
  let isHit = $derived(result === 'hit')
</script>

{#if variant === 'full'}
  <div class="dice-roll" class:dice-roll--animate={animate}>
    <div class="dice-roll__header">
      {#if attacker}
        <span class="dice-roll__attacker">{attacker}</span>
      {/if}
      <span class="dice-roll__title">ATTACK ROLL</span>
    </div>

    <div class="dice-roll__equation">
      <div class="dice-roll__die" class:dice-roll__die--animate={animate}>
        <span class="die-value">{roll}</span>
        <span class="die-label">d20</span>
      </div>

      <span class="dice-roll__operator">+</span>

      <div class="dice-roll__bonus">
        <span class="bonus-value">⚔ {attackBonus}</span>
        <span class="bonus-label">ATK</span>
      </div>

      <span class="dice-roll__operator">=</span>

      <div class="dice-roll__total">
        <span class="total-value">{total}</span>
        <span class="total-label">total</span>
      </div>
    </div>

    <div class="dice-roll__target">
      <span>vs Target: <strong>{targetValue}</strong></span>
      <span class="target-breakdown">(10 + 🛡{targetArmor})</span>
    </div>

    <div class="dice-roll__result dice-roll__result--{result}">
      <span class="result-icon">{isHit ? '✓' : '✗'}</span>
      <span class="result-text">{isHit ? 'HIT!' : 'MISS!'}</span>
    </div>
  </div>

{:else}
  <!-- Compact variant -->
  <span class="dice-roll--compact dice-roll--compact--{result}">
    [{roll}] + ⚔{attackBonus} = {total} vs {targetValue}
    <span class="compact-result">→ {isHit ? 'HIT' : 'MISS'}</span>
  </span>
{/if}

<style>
  .dice-roll {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    text-align: center;
  }

  .dice-roll__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .dice-roll__attacker {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
  }

  .dice-roll__title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .dice-roll__equation {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .dice-roll__die {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .die-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xl);
    font-weight: bold;
    color: var(--accent-primary);
    background: var(--bg-secondary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 2px solid var(--accent-primary);
    min-width: 50px;
  }

  .dice-roll__die--animate .die-value {
    animation: roll 0.5s ease-out;
  }

  .die-label {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
    margin-top: var(--space-1);
  }

  .dice-roll__operator {
    font-size: var(--font-size-xl);
    color: var(--text-muted);
  }

  .dice-roll__bonus {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .bonus-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-lg);
    color: var(--stat-attack);
  }

  .bonus-label {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
    margin-top: var(--space-1);
  }

  .dice-roll__total {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .total-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-2xl);
    font-weight: bold;
    color: var(--text-primary);
  }

  .total-label {
    font-size: var(--font-size-xs);
    color: var(--text-dim);
    margin-top: var(--space-1);
  }

  .dice-roll__target {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-4);
  }

  .target-breakdown {
    color: var(--text-dim);
    font-size: var(--font-size-xs);
  }

  .dice-roll__result {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: bold;
    font-size: var(--font-size-lg);
  }

  .dice-roll__result--hit {
    background: rgba(74, 222, 128, 0.15);
    color: var(--success);
  }

  .dice-roll__result--miss {
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
  }

  .result-icon {
    font-size: var(--font-size-xl);
  }

  /* Compact variant */
  .dice-roll--compact {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .dice-roll--compact--hit .compact-result {
    color: var(--success);
    font-weight: 600;
  }

  .dice-roll--compact--miss .compact-result {
    color: var(--danger);
    font-weight: 600;
  }

  @keyframes roll {
    0% {
      transform: rotate(0deg) scale(1);
    }
    25% {
      transform: rotate(10deg) scale(1.1);
    }
    50% {
      transform: rotate(-10deg) scale(1.1);
    }
    75% {
      transform: rotate(5deg) scale(1.05);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }

  .dice-roll--animate .dice-roll__result {
    animation: result-pop 0.3s ease-out 0.4s both;
  }

  @keyframes result-pop {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
