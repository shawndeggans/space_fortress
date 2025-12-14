<!--
  BattleSlot - Position for a card in deployment or battle

  States:
  - Empty: Dashed border, waiting for card
  - Filled: Card assigned, showing compact view
  - With result: Post-battle with won/lost/draw indicator

  Usage:
    <BattleSlot position={1} />
    <BattleSlot position={2} card={cardData} />
    <BattleSlot position={3} card={cardData} result="won" />
-->
<script lang="ts">
  import type { CardDisplayData, SlotResult, ExtendedFactionId } from './types'
  import StatPill from './StatPill.svelte'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    position: 1 | 2 | 3 | 4 | 5
    card?: CardDisplayData
    result?: SlotResult
    isDropTarget?: boolean
    ondrop?: (cardId: string) => void
    onclick?: () => void
  }

  let {
    position,
    card,
    result = null,
    isDropTarget = false,
    ondrop,
    onclick
  }: Props = $props()

  const resultIcons: Record<string, { icon: string; label: string; color: string }> = {
    won: { icon: '✓', label: 'WON', color: 'var(--success)' },
    lost: { icon: '✗', label: 'LOST', color: 'var(--danger)' },
    draw: { icon: '─', label: 'DRAW', color: 'var(--text-muted)' }
  }

  let isEmpty = $derived(!card)
  let resultData = $derived(result ? resultIcons[result] : null)

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    const cardId = event.dataTransfer?.getData('text/plain')
    if (cardId && ondrop) {
      ondrop(cardId)
    }
  }

  function handleDragOver(event: DragEvent) {
    if (isDropTarget) {
      event.preventDefault()
    }
  }
</script>

<div
  class="battle-slot"
  class:battle-slot--empty={isEmpty}
  class:battle-slot--filled={!isEmpty}
  class:battle-slot--drop-target={isDropTarget}
  class:battle-slot--clickable={onclick}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
  ondrop={handleDrop}
  ondragover={handleDragOver}
>
  {#if isEmpty}
    <div class="battle-slot__empty-content">
      <span class="slot-number">slot {position}</span>
    </div>
  {:else if card}
    <div class="battle-slot__card-content">
      <div class="battle-slot__header">
        <FactionBadge faction={card.faction as ExtendedFactionId} size="small" />
        <span class="battle-slot__name">{truncateName(card.name, 12)}</span>
      </div>

      <div class="battle-slot__stats">
        <StatPill type="attack" value={card.attack} size="small" />
        <StatPill type="armor" value={card.armor} size="small" />
        <StatPill type="agility" value={card.agility} size="small" />
      </div>

      {#if result && resultData}
        <div class="battle-slot__result" style="--result-color: {resultData.color}">
          <span class="result-icon">{resultData.icon}</span>
          <span class="result-label">{resultData.label}</span>
        </div>
      {:else}
        <div class="battle-slot__position">
          position {position}
        </div>
      {/if}
    </div>
  {/if}
</div>

<script context="module" lang="ts">
  function truncateName(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 2) + '…'
  }
</script>

<style>
  .battle-slot {
    width: 140px;
    min-height: 120px;
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
  }

  .battle-slot--empty {
    border: 2px dashed var(--border-default);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .battle-slot--filled {
    border: 2px solid var(--border-default);
    background: var(--bg-tertiary);
  }

  .battle-slot--drop-target {
    border-color: var(--accent-primary);
    background: var(--bg-elevated);
  }

  .battle-slot--drop-target.battle-slot--empty {
    border-style: solid;
  }

  .battle-slot--clickable {
    cursor: pointer;
  }

  .battle-slot--clickable:hover {
    border-color: var(--accent-primary);
    transform: translateY(-2px);
  }

  .battle-slot__empty-content {
    padding: var(--space-4);
    text-align: center;
  }

  .slot-number {
    font-size: var(--font-size-sm);
    color: var(--text-dim);
    text-transform: lowercase;
  }

  .battle-slot__card-content {
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .battle-slot__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .battle-slot__name {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .battle-slot__stats {
    display: flex;
    justify-content: space-between;
    gap: var(--space-1);
  }

  .battle-slot__position {
    text-align: center;
    font-size: var(--font-size-xs);
    color: var(--text-dim);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-default);
  }

  .battle-slot__result {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-top: 1px solid var(--border-default);
    color: var(--result-color);
    font-weight: 600;
  }

  .result-icon {
    font-size: var(--font-size-lg);
  }

  .result-label {
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
