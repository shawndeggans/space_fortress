<!--
  FactionBadge - Identifies faction affiliation with icon and optional label

  Usage:
    <FactionBadge faction="ironveil" />
    <FactionBadge faction="ashfall" showLabel />
-->
<script lang="ts">
  import type { ExtendedFactionId } from './types'

  interface Props {
    faction: ExtendedFactionId
    showLabel?: boolean
    size?: 'small' | 'medium'
  }

  let { faction, showLabel = false, size = 'medium' }: Props = $props()

  const factionData: Record<ExtendedFactionId, { icon: string; name: string; color: string }> = {
    ironveil: { icon: '▣', name: 'Ironveil', color: 'var(--faction-ironveil)' },
    ashfall: { icon: '◈', name: 'Ashfall', color: 'var(--faction-ashfall)' },
    meridian: { icon: '⬡', name: 'Meridian', color: 'var(--faction-meridian)' },
    void_wardens: { icon: '⛊', name: 'Void Wardens', color: 'var(--faction-void-wardens)' },
    sundered_oath: { icon: '✕', name: 'Sundered Oath', color: 'var(--faction-sundered-oath)' },
    scavengers: { icon: '☠', name: 'Scavengers', color: 'var(--faction-scavengers)' },
    pirates: { icon: '⚔', name: 'Pirates', color: 'var(--faction-pirates)' },
    crew: { icon: '○', name: 'Crew', color: 'var(--text-muted)' },
    other: { icon: '○', name: 'Unknown', color: 'var(--text-muted)' }
  }

  let data = $derived(factionData[faction] || factionData.other)
</script>

<div
  class="faction-badge faction-badge--{size}"
  style="--faction-color: {data.color}"
  title={data.name}
>
  <span class="icon">{data.icon}</span>
  {#if showLabel}
    <span class="label">{data.name}</span>
  {/if}
</div>

<style>
  .faction-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--faction-color);
    font-weight: 600;
  }

  .faction-badge--small {
    font-size: var(--font-size-sm);
    gap: var(--space-1);
  }

  .faction-badge--medium {
    font-size: var(--font-size-base);
  }

  .icon {
    font-size: 1.1em;
  }

  .label {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.85em;
  }
</style>
