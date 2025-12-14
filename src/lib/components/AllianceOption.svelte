<!--
  AllianceOption - Displays a potential ally for selection

  Usage:
    <AllianceOption
      faction="void_wardens"
      available={true}
      terms={{ cardProfile: 'Tank', cardCount: 2, bountyShare: 30 }}
      reputation={{ value: 42, status: 'friendly' }}
      on:viewTerms={handleViewTerms}
    />
    <AllianceOption
      faction="ashfall"
      available={false}
      unavailableReason="We don't work with your kind."
      reputation={{ value: -52, status: 'unfriendly' }}
    />
-->
<script lang="ts">
  import type { FactionId, ReputationStatus } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface AllianceTerms {
    cardProfile: string
    cardCount: number
    bountyShare: number
  }

  interface ReputationInfo {
    value: number
    status: ReputationStatus
  }

  interface Props {
    faction: FactionId
    available?: boolean
    unavailableReason?: string
    terms?: AllianceTerms | null
    reputation: ReputationInfo
    selected?: boolean
    onviewterms?: () => void
    onselect?: () => void
  }

  let {
    faction,
    available = true,
    unavailableReason,
    terms = null,
    reputation,
    selected = false,
    onviewterms,
    onselect
  }: Props = $props()

  const statusColors: Record<ReputationStatus, string> = {
    devoted: 'var(--rep-devoted)',
    friendly: 'var(--rep-friendly)',
    neutral: 'var(--rep-neutral)',
    unfriendly: 'var(--rep-unfriendly)',
    hostile: 'var(--rep-hostile)'
  }

  function formatRepValue(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`
  }

  function formatStatus(status: ReputationStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }
</script>

{#if available}
  <div
    class="alliance-option alliance-option--available"
    class:alliance-option--selected={selected}
    data-testid="alliance-{faction}"
  >
    <header class="alliance-option__header">
      <FactionBadge {faction} showLabel size="medium" />
    </header>

    <div class="alliance-option__body">
      {#if terms}
        <div class="alliance-option__terms">
          <p class="term-item">
            <span class="term-label">Cards:</span>
            <span class="term-value">{terms.cardCount}× {terms.cardProfile} profile</span>
          </p>
          <p class="term-item">
            <span class="term-label">Share:</span>
            <span class="term-value">{terms.bountyShare}% bounty</span>
          </p>
        </div>
      {/if}

      <p class="alliance-option__rep" style="color: {statusColors[reputation.status]}">
        <span class="rep-label">Your rep:</span>
        <span class="rep-value">{formatRepValue(reputation.value)}</span>
        <span class="rep-status">({formatStatus(reputation.status)})</span>
      </p>
    </div>

    <footer class="alliance-option__footer">
      {#if onviewterms}
        <button class="btn btn--secondary" onclick={onviewterms}>
          View Terms
        </button>
      {/if}
      {#if onselect}
        <button
          class="btn btn--primary"
          class:btn--selected={selected}
          onclick={onselect}
        >
          {selected ? '✓ Selected' : 'Select'}
        </button>
      {/if}
    </footer>
  </div>

{:else}
  <div class="alliance-option alliance-option--unavailable" data-testid="alliance-{faction}">
    <header class="alliance-option__header alliance-option__header--unavailable">
      <FactionBadge {faction} showLabel size="medium" />
    </header>

    <div class="alliance-option__body">
      <p class="alliance-option__rep" style="color: {statusColors[reputation.status]}">
        <span class="rep-label">Your rep:</span>
        <span class="rep-value">{formatRepValue(reputation.value)}</span>
        <span class="rep-status">({formatStatus(reputation.status)})</span>
      </p>

      {#if unavailableReason}
        <p class="alliance-option__reason">"{unavailableReason}"</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .alliance-option {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .alliance-option--available {
    transition: all var(--transition-fast);
  }

  .alliance-option--available:hover {
    border-color: var(--border-hover);
  }

  .alliance-option--selected {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 1px var(--accent-primary);
  }

  .alliance-option__header {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-default);
  }

  .alliance-option__header--unavailable {
    opacity: 0.5;
    background: repeating-linear-gradient(
      45deg,
      var(--bg-tertiary),
      var(--bg-tertiary) 10px,
      var(--bg-secondary) 10px,
      var(--bg-secondary) 20px
    );
  }

  .alliance-option__body {
    padding: var(--space-4);
    flex: 1;
  }

  .alliance-option__terms {
    margin-bottom: var(--space-3);
  }

  .term-item {
    margin: 0 0 var(--space-1) 0;
    font-size: var(--font-size-sm);
    display: flex;
    gap: var(--space-2);
  }

  .term-label {
    color: var(--text-muted);
  }

  .term-value {
    color: var(--text-primary);
  }

  .alliance-option__rep {
    margin: 0;
    font-size: var(--font-size-sm);
    display: flex;
    gap: var(--space-2);
  }

  .rep-label {
    color: var(--text-muted);
  }

  .rep-value {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .rep-status {
    opacity: 0.8;
  }

  .alliance-option__reason {
    margin: var(--space-3) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    font-style: italic;
  }

  .alliance-option__footer {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-default);
    justify-content: center;
  }

  /* Unavailable state */
  .alliance-option--unavailable {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .alliance-option--unavailable .alliance-option__body {
    padding: var(--space-3);
  }

  /* Buttons */
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
  }

  .btn--secondary {
    background: var(--bg-elevated);
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  .btn--secondary:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
  }

  .btn--selected {
    background: var(--success);
  }
</style>
