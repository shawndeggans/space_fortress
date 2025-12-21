<!--
  Card Pool Screen
  Select 5 cards for the upcoming battle.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectCardPoolView } from '$lib/game'
  import Card from '$lib/components/Card.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import type { CardDisplayData, ExtendedFactionId } from '$lib/components/types'
  import { goto } from '$app/navigation'

  const MIN_DECK_SIZE = 4
  const MAX_DECK_SIZE = 8

  // Derive views from game state
  let cardPoolView = $derived(projectCardPoolView([], undefined, $gameState))

  // Local selection state (tracks card IDs)
  let selectedCardIds = $state<Set<string>>(new Set())

  let selectedCount = $derived(selectedCardIds.size)
  let canCommit = $derived(selectedCount >= MIN_DECK_SIZE && selectedCount <= MAX_DECK_SIZE)

  function toggleCard(cardId: string) {
    const isLocked = cardPoolView?.allCards.find(c => c.id === cardId)?.isLocked
    if (isLocked) return

    if (selectedCardIds.has(cardId)) {
      const newSet = new Set(selectedCardIds)
      newSet.delete(cardId)
      selectedCardIds = newSet
    } else if (selectedCount < MAX_DECK_SIZE) {
      selectedCardIds = new Set([...selectedCardIds, cardId])
    }
  }

  async function startTacticalBattle() {
    if (!canCommit) return

    const result = await gameState.handleCommand({
      type: 'START_TACTICAL_BATTLE',
      data: {
        deckCardIds: Array.from(selectedCardIds)
      }
    })

    if (result.success) {
      goto('/tactical-battle')
    }
  }

  function getCardState(card: typeof cardPoolView.allCards[0]): 'default' | 'selected' | 'locked' {
    if (card.isLocked) return 'locked'
    if (selectedCardIds.has(card.id)) return 'selected'
    return 'default'
  }

  function toCardDisplayData(card: typeof cardPoolView.allCards[0]): CardDisplayData {
    return {
      id: card.id,
      name: card.name,
      faction: card.factionId,
      attack: card.attack,
      defense: card.defense,
      agility: card.agility,
      flavorText: card.flavorText
    }
  }

  // Group cards by faction for display
  let groupedCards = $derived(() => {
    if (!cardPoolView) return new Map()
    const groups = new Map<string, typeof cardPoolView.allCards>()
    for (const card of cardPoolView.allCards) {
      const faction = card.factionId
      if (!groups.has(faction)) {
        groups.set(faction, [])
      }
      groups.get(faction)!.push(card)
    }
    return groups
  })
</script>

<div class="card-pool-screen">
  <main class="card-pool-content">
    <header class="section-header">
      <h1>Build Your Battle Deck</h1>
      <p class="selection-count">
        <span class="count">{selectedCount}</span>
        <span class="separator">/</span>
        <span class="max">{MIN_DECK_SIZE}-{MAX_DECK_SIZE}</span>
        <span class="label">cards selected</span>
      </p>
    </header>

    <!-- Enemy Intel -->
    {#if cardPoolView?.enemyFleet}
      <section class="enemy-intel">
        <h2>Enemy Fleet (Partial Intel)</h2>
        <div class="intel-details">
          <span class="intel-faction">
            <FactionBadge faction={cardPoolView.enemyFleet.factionId as ExtendedFactionId} size="small" />
            {cardPoolView.enemyFleet.name}
          </span>
          <span class="intel-count">{cardPoolView.enemyFleet.shipCount} ships</span>
          <span class="intel-profile">{cardPoolView.enemyFleet.profile}</span>
        </div>
      </section>
    {/if}

    <!-- Card Grid -->
    <section class="cards-section">
      <h2>Your Cards</h2>
      <div class="card-grid">
        {#each cardPoolView?.allCards || [] as card}
          <Card
            card={toCardDisplayData(card)}
            size="full"
            state={getCardState(card)}
            onclick={() => toggleCard(card.id)}
          />
        {/each}
      </div>
    </section>

    <!-- Start Battle Button -->
    <footer class="commit-section">
      <button
        class="commit-btn"
        class:commit-btn--disabled={!canCommit}
        data-testid="btn-start-battle"
        disabled={!canCommit}
        onclick={startTacticalBattle}
      >
        {#if canCommit}
          Start Battle
        {:else if selectedCount < MIN_DECK_SIZE}
          Select {MIN_DECK_SIZE - selectedCount} more card{MIN_DECK_SIZE - selectedCount !== 1 ? 's' : ''}
        {:else}
          Too many cards selected
        {/if}
      </button>
    </footer>
  </main>
</div>

<style>
  .card-pool-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .card-pool-content {
    flex: 1;
    max-width: 1000px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
  }

  .section-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }

  .section-header h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .selection-count {
    font-size: var(--font-size-lg);
    margin: 0;
  }

  .selection-count .count {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent-primary);
    font-size: var(--font-size-xl);
  }

  .selection-count .separator {
    color: var(--text-dim);
    margin: 0 var(--space-1);
  }

  .selection-count .max {
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .selection-count .label {
    color: var(--text-muted);
    margin-left: var(--space-2);
  }

  .enemy-intel {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-6);
  }

  .enemy-intel h2 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-3) 0;
  }

  .intel-details {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .intel-faction {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-primary);
    font-weight: 500;
  }

  .intel-count,
  .intel-profile {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .cards-section {
    margin-bottom: var(--space-8);
  }

  .cards-section h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 var(--space-4) 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-4);
  }

  .commit-section {
    position: sticky;
    bottom: 0;
    padding: var(--space-4);
    background: linear-gradient(transparent, var(--bg-primary) 30%);
    display: flex;
    justify-content: center;
  }

  .commit-btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
    font-weight: 600;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    background: var(--accent-gradient);
    color: white;
    min-width: 250px;
  }

  .commit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .commit-btn--disabled {
    background: var(--bg-tertiary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
</style>
