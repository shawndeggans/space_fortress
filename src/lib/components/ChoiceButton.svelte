<!--
  ChoiceButton - Presents a dilemma choice with consequence preview

  Variants:
  - full: Complete with all consequences (narrative screen)
  - compact: Abbreviated for mediation/post-battle

  Usage:
    <ChoiceButton choice={choiceData} onselect={handleSelect} />
    <ChoiceButton choice={choiceData} variant="compact" disabled disabledReason="Requires rep" />
-->
<script lang="ts">
  import type { ChoiceData, FactionId } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    choice: ChoiceData
    variant?: 'full' | 'compact'
    disabled?: boolean
    disabledReason?: string
    onselect?: () => void
  }

  let {
    choice,
    variant = 'full',
    disabled = false,
    disabledReason,
    onselect
  }: Props = $props()

  let consequences = $derived(choice.consequences)

  function formatDelta(delta: number): string {
    return delta > 0 ? `+${delta}` : `${delta}`
  }
</script>

<button
  class="choice-btn choice-btn--{variant}"
  class:choice-btn--disabled={disabled}
  data-testid="choice-{choice.id}"
  onclick={disabled ? undefined : onselect}
  {disabled}
  type="button"
>
  {#if variant === 'full'}
    <!-- Full variant -->
    <div class="choice-btn__header">
      <span class="choice-btn__label">{choice.label}</span>
      {#if choice.triggersBattle}
        <span class="choice-btn__tag tag--battle">⚔ Battle</span>
      {/if}
      {#if choice.triggersAlliance}
        <span class="choice-btn__tag tag--alliance">🤝 Alliance</span>
      {/if}
      {#if choice.triggersMediation}
        <span class="choice-btn__tag tag--mediation">⚖ Mediation</span>
      {/if}
    </div>

    {#if choice.description}
      <p class="choice-btn__description">{choice.description}</p>
    {/if}

    {#if consequences.reputation?.length || consequences.cards?.length || consequences.bounty || consequences.risk}
      <div class="choice-btn__consequences">
        {#if consequences.reputation?.length}
          {#each consequences.reputation as rep}
            <div class="consequence consequence--{rep.delta > 0 ? 'positive' : 'negative'}">
              <FactionBadge faction={rep.faction} size="small" />
              <span class="consequence__delta">{formatDelta(rep.delta)} rep</span>
            </div>
          {/each}
        {/if}

        {#if consequences.cards?.length}
          {#each consequences.cards as card}
            <div class="consequence consequence--{card.action === 'gain' ? 'positive' : 'negative'}">
              <span class="consequence__icon">{card.action === 'gain' ? '+' : '−'}</span>
              <span>{card.action === 'gain' ? 'Gain' : 'Lose'}: {card.cardName}</span>
              <FactionBadge faction={card.faction} size="small" />
            </div>
          {/each}
        {/if}

        {#if consequences.bounty}
          <div class="consequence consequence--{consequences.bounty.modifier > 0 ? 'positive' : 'neutral'}">
            <span class="consequence__icon">💰</span>
            <span>{consequences.bounty.modifier}% bounty: {consequences.bounty.reason}</span>
          </div>
        {/if}

        {#if consequences.risk}
          <div class="consequence consequence--risk">
            <span class="consequence__icon">⚠</span>
            <span>{Math.round(consequences.risk.probability * 100)}% risk: {consequences.risk.description}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if choice.nextStep}
      <div class="choice-btn__next">
        <span>→ {choice.nextStep}</span>
      </div>
    {/if}

  {:else}
    <!-- Compact variant -->
    <span class="choice-btn__label--compact">{choice.label}</span>

    {#if consequences.reputation?.length}
      <div class="choice-btn__rep-compact">
        {#each consequences.reputation as rep}
          <span class="rep-delta rep-delta--{rep.delta > 0 ? 'positive' : 'negative'}">
            <FactionBadge faction={rep.faction} size="small" />
            {formatDelta(rep.delta)}
          </span>
        {/each}
      </div>
    {/if}

    {#if consequences.bounty}
      <span class="bounty-compact">{consequences.bounty.modifier}% bounty</span>
    {/if}
  {/if}

  {#if disabled && disabledReason}
    <div class="choice-btn__disabled-overlay">
      <span>🔒 {disabledReason}</span>
    </div>
  {/if}
</button>

<style>
  .choice-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-lg);
    color: var(--text-primary);
    font-family: var(--font-family);
    cursor: pointer;
    transition: all var(--transition-normal);
  }

  .choice-btn:hover:not(:disabled) {
    border-color: var(--accent-primary);
    background: var(--bg-elevated);
    transform: translateX(4px);
  }

  .choice-btn--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Header */
  .choice-btn__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .choice-btn__label {
    font-weight: 600;
    font-size: var(--font-size-lg);
    color: var(--text-primary);
  }

  .choice-btn__tag {
    font-size: var(--font-size-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-weight: 600;
    text-transform: uppercase;
  }

  .tag--battle {
    background: var(--stat-attack-bg);
    color: var(--stat-attack);
  }

  .tag--alliance {
    background: var(--stat-armor-bg);
    color: var(--stat-armor);
  }

  .tag--mediation {
    background: var(--faction-meridian-bg);
    color: var(--faction-meridian);
  }

  /* Description */
  .choice-btn__description {
    margin: var(--space-2) 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  /* Consequences */
  .choice-btn__consequences {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-default);
  }

  .consequence {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .consequence--positive {
    color: var(--success);
  }

  .consequence--negative {
    color: var(--danger);
  }

  .consequence--neutral {
    color: var(--text-secondary);
  }

  .consequence--risk {
    color: var(--warning);
  }

  .consequence__icon {
    width: 1.5em;
    text-align: center;
  }

  .consequence__delta {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  /* Next step */
  .choice-btn__next {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-default);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    font-style: italic;
  }

  /* Compact variant */
  .choice-btn--compact {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .choice-btn__label--compact {
    font-weight: 600;
    font-size: var(--font-size-base);
    flex: 1;
  }

  .choice-btn__rep-compact {
    display: flex;
    gap: var(--space-2);
  }

  .rep-delta {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .rep-delta--positive {
    color: var(--success);
  }

  .rep-delta--negative {
    color: var(--danger);
  }

  .bounty-compact {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  /* Disabled overlay */
  .choice-btn__disabled-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }
</style>
