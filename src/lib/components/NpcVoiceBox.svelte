<!--
  NpcVoiceBox - Presents NPC dialogue and position in a dilemma

  Variants:
  - full: Complete box with portrait, name, faction, and dialogue
  - compact: Inline version for choice previews

  Usage:
    <NpcVoiceBox npc={npcData} dialogue="Your dialogue here" />
    <NpcVoiceBox npc={npcData} dialogue="Short quote" variant="compact" />
-->
<script lang="ts">
  import type { NpcData, ExtendedFactionId } from './types'
  import FactionBadge from './FactionBadge.svelte'

  interface Props {
    npc: NpcData
    dialogue: string
    position?: string  // Their stance on the issue
    variant?: 'full' | 'compact'
  }

  let {
    npc,
    dialogue,
    position,
    variant = 'full'
  }: Props = $props()

  const factionColors: Record<ExtendedFactionId, string> = {
    ironveil: 'var(--faction-ironveil)',
    ashfall: 'var(--faction-ashfall)',
    meridian: 'var(--faction-meridian)',
    void_wardens: 'var(--faction-void-wardens)',
    sundered_oath: 'var(--faction-sundered-oath)',
    scavengers: 'var(--faction-scavengers)',
    pirates: 'var(--faction-pirates)',
    crew: 'var(--text-muted)',
    other: 'var(--text-muted)'
  }

  let factionColor = $derived(factionColors[npc.faction] || factionColors.other)
</script>

{#if variant === 'full'}
  <div class="voice-box" style="--npc-color: {factionColor}">
    <div class="voice-box__header">
      <div class="voice-box__portrait">
        {#if npc.portrait}
          <img src={npc.portrait} alt={npc.name} />
        {:else}
          <span class="portrait-placeholder">○</span>
        {/if}
      </div>
      <div class="voice-box__identity">
        <span class="voice-box__name">{npc.name}</span>
        <FactionBadge faction={npc.faction} showLabel size="small" />
      </div>
    </div>

    <div class="voice-box__content">
      <p class="voice-box__dialogue">"{dialogue}"</p>
      {#if position}
        <p class="voice-box__position">{position}</p>
      {/if}
    </div>
  </div>

{:else}
  <!-- Compact variant -->
  <div class="voice-box voice-box--compact" style="--npc-color: {factionColor}">
    <span class="voice-box__portrait--compact">
      {#if npc.portrait}
        <img src={npc.portrait} alt={npc.name} />
      {:else}
        <span class="portrait-placeholder--compact">○</span>
      {/if}
    </span>
    <span class="voice-box__name--compact">{npc.name}:</span>
    <span class="voice-box__dialogue--compact">"{truncateDialogue(dialogue, 50)}"</span>
  </div>
{/if}

<script context="module" lang="ts">
  function truncateDialogue(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
  }
</script>

<style>
  .voice-box {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-left: 3px solid var(--npc-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .voice-box__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-secondary);
  }

  .voice-box__portrait {
    width: 48px;
    height: 48px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--npc-color);
    overflow: hidden;
  }

  .voice-box__portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .portrait-placeholder {
    font-size: 1.5rem;
    color: var(--npc-color);
  }

  .voice-box__identity {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .voice-box__name {
    font-weight: 600;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }

  .voice-box__content {
    padding: var(--space-4);
  }

  .voice-box__dialogue {
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
    color: var(--text-primary);
    font-style: italic;
    margin: 0;
  }

  .voice-box__position {
    margin-top: var(--space-3);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-style: normal;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-default);
  }

  /* Compact variant */
  .voice-box--compact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-left-width: 2px;
  }

  .voice-box__portrait--compact {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait-placeholder--compact {
    color: var(--npc-color);
  }

  .voice-box__name--compact {
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--npc-color);
  }

  .voice-box__dialogue--compact {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-style: italic;
  }
</style>
