<!--
  BountyDisplay - Shows bounty calculation and shares

  Usage:
    <BountyDisplay
      base={1000}
      shares={[{ faction: 'void_wardens', percent: 30, amount: 300 }]}
      net={700}
    />
    <BountyDisplay
      base={1500}
      bonuses={[{ reason: 'Flawless Victory', amount: 200 }]}
      penalties={[{ reason: 'Alliance Fee', amount: 450 }]}
      shares={[{ faction: 'meridian', percent: 30, amount: 450 }]}
      net={1250}
    />
-->
<script lang="ts">
  import type { FactionId, BountyShare } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface BountyModifier {
    reason: string
    amount: number
  }

  interface Props {
    base: number
    shares?: BountyShare[]
    bonuses?: BountyModifier[]
    penalties?: BountyModifier[]
    net: number
    variant?: 'full' | 'compact'
  }

  let {
    base,
    shares = [],
    bonuses = [],
    penalties = [],
    net,
    variant = 'full'
  }: Props = $props()

  function formatCredits(value: number): string {
    return `${value.toLocaleString()} cr`
  }
</script>

{#if variant === 'full'}
  <div class="bounty-display bounty-display--full">
    <header class="bounty-display__header">
      <span class="header-icon">💰</span>
      <h3 class="header-title">Bounty Earned</h3>
    </header>

    <div class="bounty-display__body">
      <div class="bounty-row bounty-row--base">
        <span class="row-label">Base reward:</span>
        <span class="row-value">{formatCredits(base)}</span>
      </div>

      {#if bonuses.length > 0}
        <div class="bounty-section">
          {#each bonuses as bonus}
            <div class="bounty-row bounty-row--bonus">
              <span class="row-label">+ {bonus.reason}:</span>
              <span class="row-value row-value--bonus">+{formatCredits(bonus.amount)}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if penalties.length > 0}
        <div class="bounty-section">
          {#each penalties as penalty}
            <div class="bounty-row bounty-row--penalty">
              <span class="row-label">- {penalty.reason}:</span>
              <span class="row-value row-value--penalty">-{formatCredits(penalty.amount)}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if shares.length > 0}
        <div class="bounty-section bounty-section--shares">
          <div class="section-header">Shares:</div>
          {#each shares as share}
            <div class="bounty-row bounty-row--share">
              <span class="row-label share-label">
                <FactionBadge faction={share.faction} size="small" />
                <span>({share.percent}%)</span>
              </span>
              <span class="row-value row-value--penalty">-{formatCredits(share.amount)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="bounty-row bounty-row--net">
        <span class="row-label">Your take:</span>
        <span class="row-value row-value--net">{formatCredits(net)}</span>
      </div>
    </div>
  </div>

{:else}
  <!-- Compact variant -->
  <div class="bounty-display bounty-display--compact">
    <span class="compact-icon">💰</span>
    <span class="compact-label">Bounty:</span>
    <span class="compact-value">{formatCredits(net)}</span>
    {#if shares.length > 0}
      <span class="compact-shares">
        ({shares.map(s => `${s.percent}%`).join(', ')} shared)
      </span>
    {/if}
  </div>
{/if}

<style>
  .bounty-display--full {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .bounty-display__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-default);
  }

  .header-icon {
    font-size: var(--font-size-lg);
  }

  .header-title {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bounty-display__body {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .bounty-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-sm);
  }

  .row-label {
    color: var(--text-secondary);
  }

  .row-value {
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--text-primary);
  }

  .row-value--bonus {
    color: var(--success);
  }

  .row-value--penalty {
    color: var(--text-muted);
  }

  .bounty-section {
    padding-top: var(--space-2);
    border-top: 1px dashed var(--border-default);
  }

  .bounty-section--shares {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-header {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-bottom: var(--space-1);
  }

  .share-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .bounty-row--net {
    margin-top: var(--space-2);
    padding-top: var(--space-3);
    border-top: 2px solid var(--border-default);
  }

  .row-value--net {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--stat-agility);
  }

  /* Compact variant */
  .bounty-display--compact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .compact-icon {
    font-size: var(--font-size-base);
  }

  .compact-label {
    color: var(--text-muted);
  }

  .compact-value {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--stat-agility);
  }

  .compact-shares {
    color: var(--text-dim);
    font-size: var(--font-size-xs);
  }
</style>
