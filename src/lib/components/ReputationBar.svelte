<!--
  ReputationBar - Displays standing with a faction

  Variants:
  - full: Complete bar with label and status
  - compact: Smaller bar for header/lists
  - mini: Just badge + value

  Usage:
    <ReputationBar faction="ironveil" value={35} />
    <ReputationBar faction="ashfall" value={-50} variant="compact" showTrend trend="falling" />
-->
<script lang="ts">
  import type { FactionId, ReputationStatus } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    faction: FactionId
    value: number  // -100 to +100
    variant?: 'full' | 'compact' | 'mini'
    showTrend?: boolean
    trend?: 'rising' | 'falling' | 'stable'
  }

  let {
    faction,
    value,
    variant = 'full',
    showTrend = false,
    trend = 'stable'
  }: Props = $props()

  const factionNames: Record<FactionId, string> = {
    ironveil: 'Ironveil Syndicate',
    ashfall: 'Ashfall Remnants',
    meridian: 'Meridian Accord',
    void_wardens: 'Void Wardens',
    sundered_oath: 'Sundered Oath'
  }

  function getStatus(val: number): ReputationStatus {
    if (val >= 75) return 'devoted'
    if (val >= 25) return 'friendly'
    if (val >= -24) return 'neutral'
    if (val >= -74) return 'unfriendly'
    return 'hostile'
  }

  function getStatusLabel(status: ReputationStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function getStatusColor(status: ReputationStatus): string {
    const colors: Record<ReputationStatus, string> = {
      devoted: 'var(--rep-devoted)',
      friendly: 'var(--rep-friendly)',
      neutral: 'var(--rep-neutral)',
      unfriendly: 'var(--rep-unfriendly)',
      hostile: 'var(--rep-hostile)'
    }
    return colors[status]
  }

  const trendIcons: Record<string, string> = {
    rising: '↑',
    falling: '↓',
    stable: '→'
  }

  let status = $derived(getStatus(value))
  let statusColor = $derived(getStatusColor(status))
  // Map -100..+100 to 0..100 for bar width
  let barPercent = $derived(((value + 100) / 200) * 100)
  let displayValue = $derived(value >= 0 ? `+${value}` : `${value}`)
</script>

{#if variant === 'full'}
  <div class="rep-bar rep-bar--full">
    <div class="rep-bar__header">
      <FactionBadge {faction} showLabel size="small" />
      {#if showTrend}
        <span class="trend trend--{trend}">{trendIcons[trend]}</span>
      {/if}
    </div>

    <div class="rep-bar__track">
      <div class="rep-bar__markers">
        <span class="marker marker--hostile" style="left: 0%"></span>
        <span class="marker marker--unfriendly" style="left: 13%"></span>
        <span class="marker marker--neutral" style="left: 38%"></span>
        <span class="marker marker--friendly" style="left: 63%"></span>
        <span class="marker marker--devoted" style="left: 88%"></span>
      </div>
      <div
        class="rep-bar__fill"
        style="width: {barPercent}%; background: {statusColor}"
      ></div>
      <div
        class="rep-bar__indicator"
        style="left: {barPercent}%; border-color: {statusColor}"
      ></div>
    </div>

    <div class="rep-bar__footer" style="color: {statusColor}">
      <span class="rep-value">{displayValue}</span>
      <span class="rep-status">{getStatusLabel(status)}</span>
    </div>
  </div>

{:else if variant === 'compact'}
  <div class="rep-bar rep-bar--compact">
    <FactionBadge {faction} size="small" />
    <div class="rep-bar__track rep-bar__track--compact">
      <div
        class="rep-bar__fill"
        style="width: {barPercent}%; background: {statusColor}"
      ></div>
    </div>
    <span class="rep-value rep-value--compact" style="color: {statusColor}">
      {displayValue}
    </span>
    {#if showTrend}
      <span class="trend trend--{trend} trend--compact">{trendIcons[trend]}</span>
    {/if}
  </div>

{:else}
  <!-- Mini variant -->
  <span class="rep-bar rep-bar--mini" style="color: {statusColor}">
    <FactionBadge {faction} size="small" />
    <span class="rep-value--mini">{displayValue}</span>
  </span>
{/if}

<style>
  .rep-bar--full {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-default);
  }

  .rep-bar__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rep-bar__track {
    position: relative;
    height: 8px;
    background: var(--bg-secondary);
    border-radius: var(--radius-full);
    overflow: visible;
  }

  .rep-bar__track--compact {
    flex: 1;
    height: 6px;
    min-width: 80px;
  }

  .rep-bar__markers {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .marker {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 12px;
    background: var(--bg-elevated);
    opacity: 0.5;
  }

  .rep-bar__fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width var(--transition-slow);
  }

  .rep-bar__indicator {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    background: var(--bg-primary);
    border: 3px solid;
    border-radius: var(--radius-full);
    transition: left var(--transition-slow);
  }

  .rep-bar__footer {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    font-weight: 600;
  }

  .rep-value {
    font-family: var(--font-mono);
  }

  .rep-value--compact {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
    min-width: 3ch;
    text-align: right;
  }

  .rep-value--mini {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .rep-status {
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Compact variant */
  .rep-bar--compact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  /* Mini variant */
  .rep-bar--mini {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  /* Trend indicators */
  .trend {
    font-weight: bold;
    font-size: var(--font-size-sm);
  }

  .trend--rising {
    color: var(--rep-friendly);
  }

  .trend--falling {
    color: var(--rep-hostile);
  }

  .trend--stable {
    color: var(--text-muted);
  }

  .trend--compact {
    font-size: var(--font-size-xs);
  }
</style>
