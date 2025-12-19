<!--
  Card - Ship card display with stats

  Variants:
  - full: Card pool, detail views (with ship silhouette area)
  - compact: Deployment, battle
  - mini: Lists, references

  States:
  - default: Unselected in card pool
  - selected: Chosen for battle
  - committed: Locked in deployment
  - revealed: Shown during battle
  - destroyed: Defeated in combat
  - locked: Unavailable due to reputation

  Usage:
    <Card card={cardData} />
    <Card card={cardData} state="selected" size="compact" />
    <Card card={cardData} state="locked" lockReason="Requires Friendly rep" />
-->
<script lang="ts">
  import type { CardDisplayData, CardState, CardSize, ExtendedFactionId } from './types'
  import StatPill from './StatPill.svelte'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    card: CardDisplayData
    state?: CardState
    size?: CardSize
    lockReason?: string
    onclick?: () => void
  }

  let {
    card,
    state = 'default',
    size = 'full',
    lockReason,
    onclick
  }: Props = $props()

  const factionColors: Record<string, string> = {
    ironveil: 'var(--faction-ironveil)',
    ashfall: 'var(--faction-ashfall)',
    meridian: 'var(--faction-meridian)',
    void_wardens: 'var(--faction-void-wardens)',
    sundered_oath: 'var(--faction-sundered-oath)',
    scavengers: 'var(--faction-scavengers)',
    pirates: 'var(--faction-pirates)'
  }

  let factionColor = $derived(factionColors[card.faction] || 'var(--text-muted)')
  let isInteractive = $derived(onclick && state !== 'locked' && state !== 'destroyed')
</script>

<button
  class="card card--{size} card--{state}"
  class:card--interactive={isInteractive}
  data-testid="card-{card.id}"
  style="--card-faction-color: {factionColor}"
  onclick={isInteractive ? onclick : undefined}
  disabled={state === 'locked' || state === 'destroyed'}
  type="button"
>
  {#if size === 'full'}
    <!-- Full card layout -->
    <div class="card__header">
      <FactionBadge faction={card.faction as ExtendedFactionId} showLabel size="small" />
    </div>

    <div class="card__artwork">
      <div class="card__silhouette">
        <span class="silhouette-icon">🚀</span>
      </div>
    </div>

    <div class="card__name">{card.name}</div>

    <div class="card__stats">
      <StatPill type="attack" value={card.attack} />
      <StatPill type="defense" value={card.defense} />
      <StatPill type="agility" value={card.agility} />
    </div>

  {:else if size === 'compact'}
    <!-- Compact card layout -->
    <div class="card__header-compact">
      <FactionBadge faction={card.faction as ExtendedFactionId} size="small" />
      <span class="card__name-compact">{truncateName(card.name, 12)}</span>
    </div>

    <div class="card__stats-compact">
      <StatPill type="attack" value={card.attack} size="small" />
      <StatPill type="defense" value={card.defense} size="small" />
      <StatPill type="agility" value={card.agility} size="small" />
    </div>

  {:else}
    <!-- Mini card layout -->
    <div class="card__mini-content">
      <FactionBadge faction={card.faction as ExtendedFactionId} size="small" />
      <span class="card__name-mini">{truncateName(card.name, 14)}</span>
      <span class="card__stats-mini">{card.attack}/{card.defense}/{card.agility}</span>
    </div>
  {/if}

  {#if state === 'locked' && lockReason}
    <div class="card__lock-overlay">
      <span class="lock-icon">🔒</span>
      <span class="lock-reason">{lockReason}</span>
    </div>
  {/if}

  {#if state === 'selected'}
    <div class="card__selection-indicator">✓</div>
  {/if}

  {#if state === 'destroyed'}
    <div class="card__destroyed-overlay">
      <span class="destroyed-icon">✗</span>
    </div>
  {/if}
</button>

<script module lang="ts">
  function truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 2) + '…'
  }
</script>

<style>
  .card {
    position: relative;
    background: var(--bg-tertiary);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    text-align: left;
    color: var(--text-primary);
    font-family: var(--font-family);
    cursor: default;
    transition: all var(--transition-normal);
    overflow: hidden;
  }

  .card--interactive {
    cursor: pointer;
  }

  .card--interactive:hover {
    border-color: var(--card-faction-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  /* Full size */
  .card--full {
    width: 180px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Compact size */
  .card--compact {
    width: 140px;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Mini size */
  .card--mini {
    width: auto;
    min-width: 200px;
    padding: var(--space-2) var(--space-3);
  }

  /* States */
  .card--selected {
    border-color: var(--border-selected);
    background: var(--bg-elevated);
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
  }

  .card--committed {
    border-color: var(--card-faction-color);
    opacity: 0.9;
  }

  .card--revealed {
    border-color: var(--card-faction-color);
    animation: reveal 0.3s ease-out;
  }

  .card--locked {
    opacity: 0.5;
    filter: grayscale(0.7);
    cursor: not-allowed;
  }

  .card--destroyed {
    opacity: 0.4;
    filter: grayscale(1);
    cursor: not-allowed;
  }

  /* Header */
  .card__header {
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-default);
  }

  .card__header-compact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* Artwork area */
  .card__artwork {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin: var(--space-2) 0;
  }

  .card__silhouette {
    font-size: 2.5rem;
    opacity: 0.6;
  }

  /* Name */
  .card__name {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    text-align: center;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--border-default);
    border-bottom: 1px solid var(--border-default);
  }

  .card__name-compact {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card__name-mini {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    flex: 1;
  }

  /* Stats */
  .card__stats {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
  }

  .card__stats-compact {
    display: flex;
    justify-content: space-between;
    gap: var(--space-1);
  }

  .card__stats-mini {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  /* Mini content */
  .card__mini-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* Overlays */
  .card__lock-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border-radius: var(--radius-lg);
  }

  .lock-icon {
    font-size: 1.5rem;
  }

  .lock-reason {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-align: center;
    padding: 0 var(--space-2);
  }

  .card__selection-indicator {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: 24px;
    height: 24px;
    background: var(--accent-secondary);
    color: white;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    font-weight: bold;
  }

  .card__destroyed-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
  }

  .destroyed-icon {
    font-size: 3rem;
    color: var(--danger);
    opacity: 0.8;
  }

  @keyframes reveal {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
