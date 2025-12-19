<!--
  StatPill - Individual stat display with icon and value

  Usage:
    <StatPill type="attack" value={5} />
    <StatPill type="armor" value={3} size="large" />
-->
<script lang="ts">
  import type { StatType } from './types'

  interface Props {
    type: StatType
    value: number
    size?: 'small' | 'medium' | 'large'
  }

  let { type, value, size = 'medium' }: Props = $props()

  const icons: Record<StatType, string> = {
    attack: '⚔',
    defense: '🛡',
    agility: '⚡'
  }

  const labels: Record<StatType, string> = {
    attack: 'Attack',
    defense: 'Defense',
    agility: 'Agility'
  }
</script>

<div class="stat-pill stat-pill--{type} stat-pill--{size}" title={labels[type]}>
  <span class="icon">{icons[type]}</span>
  <span class="value">{value}</span>
</div>

<style>
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-weight: 600;
  }

  /* Sizes */
  .stat-pill--small {
    font-size: var(--font-size-xs);
    padding: 2px var(--space-1);
  }

  .stat-pill--medium {
    font-size: var(--font-size-sm);
  }

  .stat-pill--large {
    font-size: var(--font-size-base);
    padding: var(--space-2) var(--space-3);
  }

  /* Types */
  .stat-pill--attack {
    background: var(--stat-attack-bg);
    color: var(--stat-attack);
  }

  .stat-pill--defense {
    background: var(--stat-armor-bg);
    color: var(--stat-armor);
  }

  .stat-pill--agility {
    background: var(--stat-agility-bg);
    color: var(--stat-agility);
  }

  .icon {
    font-size: 0.9em;
  }

  .value {
    min-width: 1ch;
    text-align: center;
  }
</style>
