<!--
  Deployment Screen
  Arrange the play order of your 5 selected cards (positions 1-5).
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectDeploymentView } from '$lib/game'
  import BattleSlot from '$lib/components/BattleSlot.svelte'
  import Card from '$lib/components/Card.svelte'
  import type { CardDisplayData } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let deploymentView = $derived(projectDeploymentView([], undefined, $gameState))

  // Local state for card positions (initialized from projection on first render)
  let positions = $state<(string | null)[]>([null, null, null, null, null])

  // Initialize positions from projection if not already set
  $effect(() => {
    if (deploymentView && positions.every(p => p === null)) {
      // Try to load existing positions from projection slots
      const projectedPositions = deploymentView.slots.map(slot => slot.card?.id || null)
      if (projectedPositions.some(p => p !== null)) {
        positions = projectedPositions
      }
    }
  })

  // Get all committed cards from projection (cards in slots + unassigned cards)
  let allCommittedCards = $derived(() => {
    if (!deploymentView) return []
    const slotCards = deploymentView.slots.filter(s => s.card !== null).map(s => s.card!)
    return [...slotCards, ...deploymentView.unassignedCards]
  })

  // Get unassigned cards (committed cards not yet in a position)
  let unassignedCards = $derived(() => {
    const assignedIds = new Set(positions.filter(Boolean))
    return allCommittedCards().filter(c => !assignedIds.has(c.id))
  })

  let allPositionsFilled = $derived(positions.every(p => p !== null))

  function assignCardToPosition(cardId: string, position: number) {
    // Remove card from any existing position
    const newPositions = positions.map(p => p === cardId ? null : p)
    // Assign to new position
    newPositions[position] = cardId
    positions = newPositions
  }

  function removeFromPosition(position: number) {
    const newPositions = [...positions]
    newPositions[position] = null
    positions = newPositions
  }

  function handleDrop(cardId: string, position: number) {
    assignCardToPosition(cardId, position)
  }

  function handleCardClick(cardId: string) {
    // Find first empty position and assign
    const emptyIndex = positions.findIndex(p => p === null)
    if (emptyIndex !== -1) {
      assignCardToPosition(cardId, emptyIndex)
    }
  }

  async function lockOrders() {
    if (!allPositionsFilled) return

    const result = await gameState.handleCommand({
      type: 'LOCK_ORDERS',
      data: {
        positions: positions as string[]
      }
    })

    if (result.success) {
      goto('/battle')
    }
  }

  function getCardById(cardId: string | null) {
    if (!cardId) return null
    return allCommittedCards().find(c => c.id === cardId) || null
  }

  function toCardDisplayData(card: NonNullable<ReturnType<typeof getCardById>>): CardDisplayData {
    return {
      id: card.id,
      name: card.name,
      faction: card.factionId,
      attack: card.attack,
      defense: card.defense,
      agility: card.agility
    }
  }
</script>

<div class="deployment-screen">
  <main class="deployment-content">
    <header class="section-header">
      <h1>Arrange Play Order</h1>
      <p class="section-subtitle">Drag cards to set the order they'll face the enemy</p>
    </header>

    <!-- Position Slots -->
    <section class="positions-section">
      <div class="positions-row">
        {#each [1, 2, 3, 4, 5] as pos}
          {@const i = pos - 1}
          {@const cardId = positions[i]}
          {@const card = getCardById(cardId)}
          <BattleSlot
            position={pos as 1 | 2 | 3 | 4 | 5}
            card={card ? toCardDisplayData(card) : undefined}
            isDropTarget={true}
            ondrop={(droppedCardId) => handleDrop(droppedCardId, i)}
            onclick={card ? () => removeFromPosition(i) : undefined}
          />
        {/each}
      </div>
    </section>

    <!-- Unassigned Cards -->
    {#if unassignedCards().length > 0}
      <section class="unassigned-section">
        <h2>Unassigned Cards</h2>
        <div class="unassigned-cards">
          {#each unassignedCards() as card}
            <div
              class="draggable-card"
              role="button"
              tabindex="0"
              draggable="true"
              ondragstart={(e) => e.dataTransfer?.setData('text/plain', card.id)}
              onkeydown={(e) => e.key === 'Enter' && handleCardClick(card.id)}
            >
              <Card
                card={toCardDisplayData(card)}
                size="compact"
                state="default"
                onclick={() => handleCardClick(card.id)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Tip Box -->
    <aside class="tip-box">
      <p>
        <strong>Tip:</strong> High agility cards strike first. Consider leading
        with tanks to absorb enemy alpha strikes.
      </p>
    </aside>

    <!-- Lock Orders Button -->
    <footer class="lock-section">
      <button
        class="lock-btn"
        class:lock-btn--disabled={!allPositionsFilled}
        data-testid="btn-lock-orders"
        disabled={!allPositionsFilled}
        onclick={lockOrders}
      >
        {#if allPositionsFilled}
          Lock Orders
        {:else}
          Assign {positions.filter(p => p === null).length} more card{positions.filter(p => p === null).length !== 1 ? 's' : ''}
        {/if}
      </button>
    </footer>
  </main>
</div>

<style>
  .deployment-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .deployment-content {
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

  .section-subtitle {
    color: var(--text-muted);
    margin: 0;
  }

  .positions-section {
    margin-bottom: var(--space-8);
  }

  .positions-row {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .unassigned-section {
    margin-bottom: var(--space-6);
    padding-top: var(--space-6);
    border-top: 1px solid var(--border-default);
  }

  .unassigned-section h2 {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-4) 0;
    text-align: center;
  }

  .unassigned-cards {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .draggable-card {
    cursor: grab;
    transition: transform var(--transition-fast);
  }

  .draggable-card:active {
    cursor: grabbing;
  }

  .draggable-card:hover {
    transform: translateY(-4px);
  }

  .tip-box {
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-6);
  }

  .tip-box p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    text-align: center;
  }

  .tip-box strong {
    color: var(--accent-primary);
  }

  .lock-section {
    display: flex;
    justify-content: center;
    padding: var(--space-4);
  }

  .lock-btn {
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

  .lock-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .lock-btn--disabled {
    background: var(--bg-tertiary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
</style>
