<!--
  ConsequenceItem - Single consequence in a list

  Types:
  - card_gained: + Gained card
  - card_lost: - Lost card
  - rep_up: ↑ Reputation increased
  - rep_down: ↓ Reputation decreased
  - bounty: 💰 Bounty change
  - risk: ! Risk warning
  - flag: 🚩 Story flag set

  Usage:
    <ConsequenceItem type="card_gained" content="Mining Barge Retrofit" details="Ironveil" />
    <ConsequenceItem type="rep_down" content="Ashfall -20" details="Now Unfriendly" />
    <ConsequenceItem type="risk" content="30% chance Ironveil discovers deception" />
-->
<script lang="ts">
  import type { ConsequenceType, FactionId } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    type: ConsequenceType
    content: string
    details?: string
    faction?: FactionId
  }

  let {
    type,
    content,
    details,
    faction
  }: Props = $props()

  const typeConfig: Record<ConsequenceType, { icon: string; prefix: string; colorClass: string }> = {
    card_gained: { icon: '+', prefix: 'Gained:', colorClass: 'consequence--positive' },
    card_lost: { icon: '−', prefix: 'Lost:', colorClass: 'consequence--negative' },
    rep_up: { icon: '↑', prefix: 'Reputation:', colorClass: 'consequence--positive' },
    rep_down: { icon: '↓', prefix: 'Reputation:', colorClass: 'consequence--negative' },
    bounty: { icon: '💰', prefix: 'Bounty:', colorClass: 'consequence--neutral' },
    risk: { icon: '!', prefix: 'Risk:', colorClass: 'consequence--warning' },
    flag: { icon: '🚩', prefix: 'Event:', colorClass: 'consequence--neutral' }
  }

  let config = $derived(typeConfig[type])
</script>

<div class="consequence-item {config.colorClass}">
  <span class="consequence-icon">{config.icon}</span>
  <span class="consequence-prefix">{config.prefix}</span>
  <span class="consequence-content">
    {content}
    {#if faction}
      <span class="consequence-faction">
        (<FactionBadge {faction} size="small" />)
      </span>
    {/if}
  </span>
  {#if details}
    <span class="consequence-details">→ {details}</span>
  {/if}
</div>

<style>
  .consequence-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
  }

  .consequence-icon {
    font-weight: 700;
    font-size: var(--font-size-base);
    width: 1.5em;
    text-align: center;
    flex-shrink: 0;
  }

  .consequence-prefix {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .consequence-content {
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .consequence-faction {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .consequence-details {
    color: var(--text-secondary);
    margin-left: auto;
    flex-shrink: 0;
  }

  /* Type-specific colors */
  .consequence--positive {
    border-left: 3px solid var(--success);
  }

  .consequence--positive .consequence-icon {
    color: var(--success);
  }

  .consequence--negative {
    border-left: 3px solid var(--error);
  }

  .consequence--negative .consequence-icon {
    color: var(--error);
  }

  .consequence--warning {
    border-left: 3px solid var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, var(--bg-tertiary));
  }

  .consequence--warning .consequence-icon {
    color: var(--warning);
  }

  .consequence--neutral {
    border-left: 3px solid var(--text-muted);
  }

  .consequence--neutral .consequence-icon {
    color: var(--text-muted);
  }
</style>
