<!--
  Tactical Battle Screen
  Turn-based tactical combat with energy management and ship deployment.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { goto } from '$app/navigation'
  import Card from '$lib/components/Card.svelte'
  import FactionBadge from '$lib/components/FactionBadge.svelte'
  import StatPill from '$lib/components/StatPill.svelte'
  import type { CardDisplayData } from '$lib/components/types'
  import { getCardById } from '$lib/game/content/cards'
  import type { ShipState, TacticalBattleState } from '$lib/game/types'

  // Derive tactical battle state
  let battle = $derived($gameState.currentTacticalBattle)
  let isPlayerTurn = $derived(battle?.activePlayer === 'player' && battle?.phase === 'playing')

  // Selection state for click-to-select interaction
  let selectedHandCard = $state<string | null>(null)
  let selectedShip = $state<string | null>(null)
  let actionMode = $state<'deploy' | 'attack' | 'move' | null>(null)

  // Combat log
  let combatLog = $state<string[]>([])

  // Clear selection
  function clearSelection() {
    selectedHandCard = null
    selectedShip = null
    actionMode = null
  }

  // Handle clicking a card in hand
  function selectHandCard(cardId: string) {
    if (!isPlayerTurn) return

    if (selectedHandCard === cardId) {
      clearSelection()
    } else {
      selectedHandCard = cardId
      selectedShip = null
      actionMode = 'deploy'
    }
  }

  // Handle clicking an empty battlefield slot (for deployment)
  async function deployToSlot(position: number) {
    if (!isPlayerTurn || !selectedHandCard || actionMode !== 'deploy') return
    if (!battle) return

    const card = getCardById(selectedHandCard)
    if (!card) return

    // Check energy
    if (battle.player.energy.current < card.energyCost) {
      addToLog(`Not enough energy to deploy ${card.name}`)
      return
    }

    const result = await gameState.handleCommand({
      type: 'DEPLOY_SHIP',
      data: {
        cardId: selectedHandCard,
        position
      }
    })

    if (result.success) {
      addToLog(`Deployed ${card.name} to position ${position}`)
      clearSelection()
    }
  }

  // Handle clicking a ship on the battlefield
  function selectShip(ship: ShipState, isPlayer: boolean) {
    if (!isPlayerTurn) return

    if (isPlayer) {
      // Selecting own ship - prepare for attack or move
      if (selectedShip === ship.cardId) {
        clearSelection()
      } else {
        selectedShip = ship.cardId
        selectedHandCard = null
        actionMode = ship.isExhausted ? 'move' : 'attack'
      }
    } else {
      // Selecting enemy ship - attack if we have a ship selected
      if (selectedShip && actionMode === 'attack') {
        attackTarget(ship.position)
      }
    }
  }

  // Attack a target position
  async function attackTarget(targetPosition?: number) {
    if (!isPlayerTurn || !selectedShip) return

    const result = await gameState.handleCommand({
      type: 'ATTACK_WITH_SHIP',
      data: {
        attackerCardId: selectedShip,
        targetPosition
      }
    })

    if (result.success) {
      const ship = battle?.player.battlefield.find(s => s?.cardId === selectedShip)
      addToLog(`${ship?.card.name || 'Ship'} attacks position ${targetPosition || 'flagship'}!`)
      clearSelection()
    }
  }

  // Attack the enemy flagship directly
  async function attackFlagship() {
    if (!isPlayerTurn || !selectedShip) return
    await attackTarget(undefined)
  }

  // End turn
  async function endTurn() {
    if (!isPlayerTurn) return

    const result = await gameState.handleCommand({
      type: 'END_TURN',
      data: {}
    })

    if (result.success) {
      addToLog('Turn ended')
      clearSelection()
    }
  }

  // Draw extra card (costs 2 energy)
  async function drawExtraCard() {
    if (!isPlayerTurn || !battle) return
    if (battle.player.energy.current < 2) {
      addToLog('Not enough energy to draw (need 2)')
      return
    }
    if (battle.player.hand.length >= 5) {
      addToLog('Hand is full')
      return
    }

    const result = await gameState.handleCommand({
      type: 'DRAW_EXTRA_CARD',
      data: {}
    })

    if (result.success) {
      addToLog('Drew an extra card (-2 energy)')
    }
  }

  // Mulligan handling
  let mulliganSelection = $state<Set<string>>(new Set())

  function toggleMulligan(cardId: string) {
    const newSet = new Set(mulliganSelection)
    if (newSet.has(cardId)) {
      newSet.delete(cardId)
    } else {
      newSet.add(cardId)
    }
    mulliganSelection = newSet
  }

  async function confirmMulligan() {
    if (!battle) return

    const result = await gameState.handleCommand({
      type: 'MULLIGAN_CARDS',
      data: {
        cardIdsToRedraw: Array.from(mulliganSelection)
      }
    })

    if (result.success) {
      mulliganSelection = new Set()
    }
  }

  async function skipMulligan() {
    const result = await gameState.handleCommand({
      type: 'SKIP_MULLIGAN',
      data: {}
    })
  }

  // Continue to consequences after battle
  function viewConsequences() {
    goto('/consequence')
  }

  // Add to combat log
  function addToLog(message: string) {
    combatLog = [...combatLog.slice(-19), message]
  }

  // Helper to convert card ID to display data
  function cardToDisplay(cardId: string): CardDisplayData | null {
    const card = getCardById(cardId)
    if (!card) return null
    return {
      id: card.id,
      name: card.name,
      faction: card.faction,
      attack: card.attack,
      defense: card.defense,
      agility: card.agility
    }
  }

  // Helper to get card from ship state
  function shipToDisplay(ship: ShipState): CardDisplayData {
    return {
      id: ship.card.id,
      name: ship.card.name,
      faction: ship.card.faction,
      attack: ship.card.attack,
      defense: ship.card.defense,
      agility: ship.card.agility
    }
  }
</script>

<div class="tactical-battle-screen">
  {#if !battle}
    <div class="no-battle">
      <p>No tactical battle in progress.</p>
      <button class="btn btn--primary" onclick={() => goto('/quest-hub')}>
        Return to Quest Hub
      </button>
    </div>
  {:else if battle.phase === 'mulligan'}
    <!-- Mulligan Phase -->
    <div class="mulligan-phase">
      <header class="phase-header">
        <h1>Mulligan Phase</h1>
        <p>Select cards to redraw, then confirm or keep your hand.</p>
      </header>

      <section class="hand-display mulligan-hand">
        {#each battle.player.hand as cardId}
          {@const card = cardToDisplay(cardId)}
          {#if card}
            <button
              class="hand-card"
              class:selected={mulliganSelection.has(cardId)}
              onclick={() => toggleMulligan(cardId)}
            >
              <Card {card} size="compact" state={mulliganSelection.has(cardId) ? 'selected' : 'default'} />
            </button>
          {/if}
        {/each}
      </section>

      <footer class="mulligan-actions">
        <button class="btn btn--secondary" onclick={skipMulligan}>
          Keep Hand
        </button>
        <button class="btn btn--primary" onclick={confirmMulligan} disabled={mulliganSelection.size === 0}>
          Mulligan {mulliganSelection.size} card{mulliganSelection.size !== 1 ? 's' : ''}
        </button>
      </footer>
    </div>
  {:else if battle.phase === 'resolved'}
    <!-- Battle Resolved -->
    <div class="battle-resolved">
      <header class="result-header">
        <div
          class="result-banner"
          class:result-banner--victory={battle.winner === 'player'}
          class:result-banner--defeat={battle.winner === 'opponent'}
        >
          {#if battle.winner === 'player'}
            <h1>Victory</h1>
          {:else if battle.winner === 'opponent'}
            <h1>Defeat</h1>
          {:else}
            <h1>Draw</h1>
          {/if}
        </div>
        <p class="result-summary">
          Battle ended by {battle.victoryCondition === 'flagship_destroyed' ? 'flagship destruction' :
            battle.victoryCondition === 'fleet_eliminated' ? 'fleet elimination' : 'timeout'}
        </p>
      </header>

      <section class="final-stats">
        <div class="stat-row">
          <span class="stat-label">Your Flagship:</span>
          <span class="stat-value">{battle.player.flagship.currentHull} / {battle.player.flagship.maxHull} HP</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Enemy Flagship:</span>
          <span class="stat-value">{battle.opponent.flagship.currentHull} / {battle.opponent.flagship.maxHull} HP</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Turns Played:</span>
          <span class="stat-value">{battle.turnNumber}</span>
        </div>
      </section>

      <footer class="battle-footer">
        <button class="btn btn--primary" onclick={viewConsequences}>
          View Consequences
        </button>
      </footer>
    </div>
  {:else}
    <!-- Playing Phase - Main Tactical UI -->
    <header class="battle-header">
      <div class="header-left">
        <h1>{battle.context || 'Tactical Battle'}</h1>
        <span class="opponent-info">vs {battle.opponentName}</span>
      </div>
      <div class="header-right">
        <div class="turn-indicator" class:active={isPlayerTurn}>
          Turn {battle.turnNumber} - {battle.activePlayer === 'player' ? 'Your Turn' : "Opponent's Turn"}
        </div>
      </div>
    </header>

    <main class="battle-arena">
      <!-- Opponent Side -->
      <section class="combatant-area opponent-area">
        <div class="flagship-display">
          <span class="flagship-label">Enemy Flagship</span>
          <div class="flagship-hull">
            <div
              class="hull-bar"
              style="width: {(battle.opponent.flagship.currentHull / battle.opponent.flagship.maxHull) * 100}%"
            ></div>
          </div>
          <span class="hull-text">{battle.opponent.flagship.currentHull} / {battle.opponent.flagship.maxHull}</span>
          {#if selectedShip && actionMode === 'attack' && battle.opponent.battlefield.every(s => s === null)}
            <button class="flagship-attack-btn" onclick={attackFlagship}>
              Attack Flagship
            </button>
          {/if}
        </div>

        <div class="battlefield">
          {#each [1, 2, 3, 4, 5] as position}
            {@const ship = battle.opponent.battlefield[position - 1]}
            <div
              class="battlefield-slot"
              class:has-ship={ship !== null}
              class:targetable={selectedShip && actionMode === 'attack'}
              role="button"
              tabindex={ship ? 0 : -1}
              onclick={() => ship && selectShip(ship, false)}
              onkeydown={(e) => e.key === 'Enter' && ship && selectShip(ship, false)}
            >
              {#if ship}
                <div class="ship-card">
                  <div class="ship-header">
                    <FactionBadge faction={ship.card.faction} size="small" />
                    <span class="ship-name">{ship.card.name}</span>
                  </div>
                  <div class="ship-hull">
                    <div
                      class="hull-bar"
                      style="width: {(ship.currentHull / ship.maxHull) * 100}%"
                    ></div>
                    <span class="hull-text">{ship.currentHull}/{ship.maxHull}</span>
                  </div>
                  <div class="ship-stats">
                    <StatPill type="attack" value={ship.card.attack} size="small" />
                    <StatPill type="defense" value={ship.card.defense} size="small" />
                  </div>
                </div>
              {:else}
                <div class="empty-slot">
                  <span class="slot-number">{position}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="combatant-info">
          <span class="energy-display">
            Energy: {battle.opponent.energy.current}/{battle.opponent.energy.maximum}
          </span>
          <span class="deck-count">Deck: {battle.opponent.deck.length}</span>
        </div>
      </section>

      <!-- Divider -->
      <div class="arena-divider">
        <span>VS</span>
      </div>

      <!-- Player Side -->
      <section class="combatant-area player-area">
        <div class="combatant-info">
          <span class="energy-display player-energy">
            Energy: {battle.player.energy.current}/{battle.player.energy.maximum}
          </span>
          <span class="deck-count">Deck: {battle.player.deck.length}</span>
        </div>

        <div class="battlefield player-battlefield">
          {#each [1, 2, 3, 4, 5] as position}
            {@const ship = battle.player.battlefield[position - 1]}
            <div
              class="battlefield-slot"
              class:has-ship={ship !== null}
              class:selectable={ship !== null && isPlayerTurn}
              class:selected={ship?.cardId === selectedShip}
              class:drop-target={selectedHandCard && actionMode === 'deploy' && ship === null}
              role="button"
              tabindex={0}
              onclick={() => ship ? selectShip(ship, true) : deployToSlot(position)}
              onkeydown={(e) => e.key === 'Enter' && (ship ? selectShip(ship, true) : deployToSlot(position))}
            >
              {#if ship}
                <div class="ship-card" class:exhausted={ship.isExhausted}>
                  <div class="ship-header">
                    <FactionBadge faction={ship.card.faction} size="small" />
                    <span class="ship-name">{ship.card.name}</span>
                  </div>
                  <div class="ship-hull">
                    <div
                      class="hull-bar player-hull"
                      style="width: {(ship.currentHull / ship.maxHull) * 100}%"
                    ></div>
                    <span class="hull-text">{ship.currentHull}/{ship.maxHull}</span>
                  </div>
                  <div class="ship-stats">
                    <StatPill type="attack" value={ship.card.attack} size="small" />
                    <StatPill type="defense" value={ship.card.defense} size="small" />
                  </div>
                  {#if ship.isExhausted}
                    <div class="exhausted-badge">Exhausted</div>
                  {/if}
                </div>
              {:else}
                <div class="empty-slot" class:highlighted={selectedHandCard && actionMode === 'deploy'}>
                  <span class="slot-number">{position}</span>
                  {#if selectedHandCard && actionMode === 'deploy'}
                    <span class="deploy-hint">Deploy Here</span>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="flagship-display player-flagship">
          <span class="flagship-label">Your Flagship</span>
          <div class="flagship-hull">
            <div
              class="hull-bar player-hull"
              style="width: {(battle.player.flagship.currentHull / battle.player.flagship.maxHull) * 100}%"
            ></div>
          </div>
          <span class="hull-text">{battle.player.flagship.currentHull} / {battle.player.flagship.maxHull}</span>
        </div>
      </section>
    </main>

    <!-- Hand Display -->
    <section class="hand-section">
      <h3>Your Hand ({battle.player.hand.length}/5)</h3>
      <div class="hand-cards">
        {#each battle.player.hand as cardId}
          {@const card = getCardById(cardId)}
          {#if card}
            {@const canAfford = battle.player.energy.current >= card.energyCost}
            <button
              class="hand-card"
              class:selected={selectedHandCard === cardId}
              class:unaffordable={!canAfford}
              disabled={!isPlayerTurn || !canAfford}
              onclick={() => selectHandCard(cardId)}
            >
              <div class="card-content">
                <div class="card-header">
                  <FactionBadge faction={card.faction} size="small" />
                  <span class="card-name">{card.name}</span>
                </div>
                <div class="card-cost">
                  <span class="cost-value">{card.energyCost}</span>
                  <span class="cost-label">energy</span>
                </div>
                <div class="card-stats">
                  <StatPill type="attack" value={card.attack} size="small" />
                  <StatPill type="defense" value={card.defense} size="small" />
                  <span class="hull-stat">Hull: {card.hull}</span>
                </div>
              </div>
            </button>
          {/if}
        {/each}
      </div>
    </section>

    <!-- Action Bar -->
    <footer class="action-bar">
      <div class="action-info">
        {#if selectedHandCard}
          {@const card = getCardById(selectedHandCard)}
          <span class="action-hint">Click an empty slot to deploy {card?.name}</span>
        {:else if selectedShip && actionMode === 'attack'}
          <span class="action-hint">Click an enemy ship or flagship to attack</span>
        {:else if !isPlayerTurn}
          <span class="action-hint">Waiting for opponent...</span>
        {:else}
          <span class="action-hint">Select a card to deploy or a ship to attack</span>
        {/if}
      </div>
      <div class="action-buttons">
        <button
          class="btn btn--secondary"
          disabled={!isPlayerTurn || battle.player.energy.current < 2 || battle.player.hand.length >= 5}
          onclick={drawExtraCard}
        >
          Draw Card (2)
        </button>
        <button
          class="btn btn--primary"
          disabled={!isPlayerTurn}
          onclick={endTurn}
        >
          End Turn
        </button>
      </div>
    </footer>

    <!-- Combat Log -->
    {#if combatLog.length > 0}
      <aside class="combat-log">
        <h4>Combat Log</h4>
        <div class="log-entries">
          {#each combatLog as entry}
            <p class="log-entry">{entry}</p>
          {/each}
        </div>
      </aside>
    {/if}
  {/if}
</div>

<style>
  .tactical-battle-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  /* No Battle State */
  .no-battle {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }

  /* Header */
  .battle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-secondary);
  }

  .header-left h1 {
    font-size: var(--font-size-lg);
    margin: 0;
  }

  .opponent-info {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .turn-indicator {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    font-size: var(--font-size-sm);
  }

  .turn-indicator.active {
    background: var(--accent-primary);
    color: white;
  }

  /* Battle Arena */
  .battle-arena {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-2);
  }

  .combatant-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .opponent-area {
    align-items: flex-start;
  }

  .player-area {
    align-items: flex-end;
  }

  /* Battlefield */
  .battlefield {
    display: flex;
    gap: var(--space-2);
    width: 100%;
    justify-content: center;
  }

  .battlefield-slot {
    width: 140px;
    min-height: 120px;
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    cursor: pointer;
  }

  .battlefield-slot.has-ship {
    border-style: solid;
    border-color: var(--border-subtle);
    background: var(--bg-secondary);
  }

  .battlefield-slot.selectable:hover {
    border-color: var(--accent-primary);
  }

  .battlefield-slot.selected {
    border-color: var(--accent-primary);
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
  }

  .battlefield-slot.drop-target {
    border-color: var(--success);
    background: color-mix(in srgb, var(--success) 10%, var(--bg-primary));
  }

  .battlefield-slot.targetable:hover {
    border-color: var(--error);
    background: color-mix(in srgb, var(--error) 10%, var(--bg-primary));
  }

  .empty-slot {
    text-align: center;
    color: var(--text-dim);
  }

  .empty-slot.highlighted {
    color: var(--success);
  }

  .slot-number {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .deploy-hint {
    display: block;
    font-size: var(--font-size-xs);
    margin-top: var(--space-1);
  }

  /* Ship Card (on battlefield) */
  .ship-card {
    width: 100%;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .ship-card.exhausted {
    opacity: 0.6;
  }

  .ship-header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .ship-name {
    font-size: var(--font-size-xs);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ship-hull {
    position: relative;
    height: 16px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .hull-bar {
    height: 100%;
    background: var(--error);
    transition: width var(--transition-normal);
  }

  .hull-bar.player-hull {
    background: var(--success);
  }

  .hull-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .ship-stats {
    display: flex;
    gap: var(--space-1);
    justify-content: center;
  }

  .exhausted-badge {
    font-size: var(--font-size-xs);
    color: var(--warning);
    text-align: center;
    font-style: italic;
  }

  /* Flagship */
  .flagship-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    min-width: 200px;
  }

  .flagship-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
  }

  .flagship-hull {
    width: 100%;
    height: 24px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
  }

  .flagship-attack-btn {
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-3);
    background: var(--error);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .flagship-attack-btn:hover {
    opacity: 0.9;
  }

  /* Combatant Info */
  .combatant-info {
    display: flex;
    gap: var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .energy-display {
    font-family: var(--font-mono);
  }

  .player-energy {
    color: var(--accent-primary);
    font-weight: 600;
  }

  /* Arena Divider */
  .arena-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2);
  }

  .arena-divider span {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--text-dim);
  }

  /* Hand Section */
  .hand-section {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--border-default);
    background: var(--bg-secondary);
  }

  .hand-section h3 {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: 0 0 var(--space-3) 0;
  }

  .hand-cards {
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }

  .hand-card {
    flex-shrink: 0;
    width: 140px;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .hand-card:hover:not(:disabled) {
    border-color: var(--accent-primary);
    transform: translateY(-4px);
  }

  .hand-card.selected {
    border-color: var(--accent-primary);
    box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
  }

  .hand-card.unaffordable {
    opacity: 0.5;
  }

  .hand-card:disabled {
    cursor: not-allowed;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .card-name {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .card-cost {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .cost-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--accent-primary);
    font-family: var(--font-mono);
  }

  .cost-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .card-stats {
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }

  .hull-stat {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  /* Action Bar */
  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--border-default);
    background: var(--bg-primary);
  }

  .action-hint {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .action-buttons {
    display: flex;
    gap: var(--space-3);
  }

  /* Combat Log */
  .combat-log {
    position: fixed;
    bottom: 80px;
    right: var(--space-4);
    width: 280px;
    max-height: 200px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    overflow: hidden;
  }

  .combat-log h4 {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin: 0 0 var(--space-2) 0;
  }

  .log-entries {
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .log-entry {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin: 0;
    padding: var(--space-1);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  /* Mulligan Phase */
  .mulligan-phase {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    gap: var(--space-6);
  }

  .phase-header {
    text-align: center;
  }

  .phase-header h1 {
    margin: 0 0 var(--space-2) 0;
  }

  .phase-header p {
    color: var(--text-muted);
  }

  .mulligan-hand {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
    justify-content: center;
  }

  .mulligan-actions {
    display: flex;
    gap: var(--space-4);
  }

  /* Battle Resolved */
  .battle-resolved {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    gap: var(--space-6);
  }

  .result-header {
    text-align: center;
  }

  .result-banner {
    padding: var(--space-6) var(--space-12);
    border-radius: var(--radius-xl);
    background: var(--bg-secondary);
  }

  .result-banner h1 {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .result-banner--victory {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1));
    border: 2px solid var(--success);
  }

  .result-banner--victory h1 {
    color: var(--success);
  }

  .result-banner--defeat {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
    border: 2px solid var(--error);
  }

  .result-banner--defeat h1 {
    color: var(--error);
  }

  .result-summary {
    margin-top: var(--space-3);
    color: var(--text-secondary);
  }

  .final-stats {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    min-width: 300px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2);
  }

  .stat-row:not(:last-child) {
    border-bottom: 1px solid var(--border-default);
  }

  .stat-label {
    color: var(--text-muted);
  }

  .stat-value {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  /* Buttons */
  .btn {
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-base);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .btn--secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
  }

  .btn--secondary:hover:not(:disabled) {
    background: var(--bg-elevated);
  }

  .battle-footer {
    display: flex;
    justify-content: center;
  }
</style>
