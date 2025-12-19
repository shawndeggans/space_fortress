<!--
  Battle Screen
  Shows round-by-round automated combat with dice rolls.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectBattleView, projectBattleResultView } from '$lib/game'
  import Card from '$lib/components/Card.svelte'
  import DiceRoll from '$lib/components/DiceRoll.svelte'
  import type { CardDisplayData } from '$lib/components/types'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let battleView = $derived(projectBattleView([], undefined, $gameState))
  let battleResult = $derived(projectBattleResultView([], undefined, $gameState))

  // Check if battle is complete
  let isComplete = $derived(battleView?.phase === 'complete')

  function viewConsequences() {
    goto('/consequence')
  }

  function toCardDisplayData(card: { id: string; name: string; factionId: string; attack: number; defense: number; agility: number }): CardDisplayData {
    return {
      id: card.id,
      name: card.name,
      faction: card.factionId as CardDisplayData['faction'],
      attack: card.attack,
      defense: card.defense,
      agility: card.agility
    }
  }
</script>

<div class="battle-screen">
  <main class="battle-content">
    {#if isComplete && battleResult}
      <!-- Battle Complete Summary -->
      <div class="battle-complete">
        <header class="result-header">
          <div class="result-banner" class:result-banner--victory={battleResult.outcome === 'victory'} class:result-banner--defeat={battleResult.outcome === 'defeat'}>
            {#if battleResult.outcome === 'victory'}
              <h1>Victory</h1>
            {:else if battleResult.outcome === 'defeat'}
              <h1>Defeat</h1>
            {:else}
              <h1>Draw</h1>
            {/if}
          </div>
          <p class="result-summary">{battleResult.summaryText}</p>
        </header>

        <section class="round-summary">
          <h2>Round Summary</h2>
          <div class="rounds-list">
            {#each battleResult.rounds as round, i}
              <div class="round-row">
                <span class="round-number">R{i + 1}</span>
                <div class="round-cards">
                  <div class="mini-card player">
                    <span class="card-faction">{round.playerCard.factionId.charAt(0).toUpperCase()}</span>
                    <span class="card-name">{round.playerCard.name}</span>
                  </div>
                  <span class="vs">vs</span>
                  <div class="mini-card opponent">
                    <span class="card-faction">{round.opponentCard.factionId.charAt(0).toUpperCase()}</span>
                    <span class="card-name">{round.opponentCard.name}</span>
                  </div>
                </div>
                <span class="round-result" class:won={round.outcome === 'player_won'} class:lost={round.outcome === 'opponent_won'}>
                  {#if round.outcome === 'player_won'}
                    Won
                  {:else if round.outcome === 'opponent_won'}
                    Lost
                  {:else}
                    Draw
                  {/if}
                </span>
              </div>
            {/each}
          </div>

          <div class="final-score">
            <span class="score-label">Final:</span>
            <span class="score-value">{battleResult.playerWins} wins, {battleResult.opponentWins} losses, {battleResult.draws} draws</span>
          </div>
        </section>

        <footer class="battle-footer">
          <button class="btn btn--primary" data-testid="btn-view-consequences" onclick={viewConsequences}>
            View Consequences
          </button>
        </footer>
      </div>
    {:else if battleView}
      <!-- Active Battle Round -->
      <header class="battle-header">
        <h1>{battleView.battleContext || 'Battle'}</h1>
        <div class="round-indicator">
          <span class="round-label">Round {battleView.currentRound} of {battleView.totalRounds}</span>
          <div class="round-dots">
            {#each Array(battleView.totalRounds) as _, i}
              <span
                class="dot"
                class:dot--current={i + 1 === battleView.currentRound}
                class:dot--complete={i + 1 < battleView.currentRound}
              ></span>
            {/each}
          </div>
          <span class="score">You: {battleView.playerWins} | Enemy: {battleView.opponentWins}</span>
        </div>
      </header>

      <!-- Combat Display -->
      {#if battleView.currentRoundView}
        <section class="combat-arena">
          <div class="combatant player-side">
            <h3>Your Card</h3>
            <Card
              card={toCardDisplayData(battleView.currentRoundView.playerCard)}
              size="full"
              state="revealed"
            />
          </div>

          <div class="vs-divider">
            <span>VS</span>
          </div>

          <div class="combatant opponent-side">
            <h3>Enemy Card</h3>
            <Card
              card={toCardDisplayData(battleView.currentRoundView.opponentCard)}
              size="full"
              state="revealed"
            />
          </div>
        </section>
      {/if}

      <!-- Combat Log -->
      {#if battleView.combatLog.length > 0}
        <section class="combat-log">
          <div class="log-entries">
            {#each battleView.combatLog as entry}
              <div class="log-entry" class:highlight={entry.type === 'outcome'}>
                <p>{entry.text}</p>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Completed Rounds Summary -->
      {#if battleView.completedRounds.length > 0}
        <section class="completed-rounds">
          <h3>Completed Rounds</h3>
          <div class="rounds-mini">
            {#each battleView.completedRounds as round}
              <div class="round-mini" class:won={round.outcome === 'player_won'} class:lost={round.outcome === 'opponent_won'}>
                R{round.roundNumber}: {round.outcome === 'player_won' ? 'W' : round.outcome === 'opponent_won' ? 'L' : 'D'}
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {:else}
      <div class="no-battle">
        <p>No active battle.</p>
        <button class="btn btn--primary" onclick={() => goto('/quest-hub')}>
          Return to Quest Hub
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .battle-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .battle-content {
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
  }

  /* Battle Header */
  .battle-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }

  .battle-header h1 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-3) 0;
  }

  .round-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .round-label {
    font-size: var(--font-size-lg);
    color: var(--text-secondary);
  }

  .round-dots {
    display: flex;
    gap: var(--space-2);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 2px solid var(--border-default);
  }

  .dot--current {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .dot--complete {
    background: var(--success);
    border-color: var(--success);
  }

  .score {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  /* Combat Arena */
  .combat-arena {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }

  .combatant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .combatant h3 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .vs-divider {
    display: flex;
    align-items: center;
    padding-top: var(--space-8);
  }

  .vs-divider span {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-dim);
  }

  /* Combat Log */
  .combat-log {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .log-entries {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .log-entry {
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }

  .log-entry.highlight {
    background: var(--bg-tertiary);
    font-weight: 500;
  }

  .log-entry p {
    margin: 0;
    color: var(--text-secondary);
  }

  /* Completed Rounds */
  .completed-rounds {
    margin-bottom: var(--space-4);
  }

  .completed-rounds h3 {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: 0 0 var(--space-2) 0;
  }

  .rounds-mini {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .round-mini {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .round-mini.won {
    background: color-mix(in srgb, var(--success) 20%, var(--bg-tertiary));
    color: var(--success);
  }

  .round-mini.lost {
    background: color-mix(in srgb, var(--error) 20%, var(--bg-tertiary));
    color: var(--error);
  }

  /* Battle Complete */
  .battle-complete {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .result-header {
    text-align: center;
  }

  .result-banner {
    padding: var(--space-6);
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

  .result-summary {
    margin-top: var(--space-3);
    color: var(--text-secondary);
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

  .round-summary {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .round-summary h2 {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-4) 0;
    text-align: center;
  }

  .rounds-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .round-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .round-row .round-number {
    font-weight: 600;
    color: var(--text-muted);
    width: 30px;
  }

  .round-cards {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .mini-card {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
  }

  .card-faction {
    font-weight: 600;
    color: var(--accent-primary);
  }

  .card-name {
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }

  .round-cards .vs {
    color: var(--text-dim);
    font-size: var(--font-size-xs);
  }

  .round-result {
    font-weight: 600;
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .round-result.won {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 15%, transparent);
  }

  .round-result.lost {
    color: var(--error);
    background: color-mix(in srgb, var(--error) 15%, transparent);
  }

  .final-score {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
    text-align: center;
  }

  .score-label {
    color: var(--text-muted);
    margin-right: var(--space-2);
  }

  .score-value {
    color: var(--text-primary);
    font-weight: 600;
  }

  /* Footer */
  .battle-footer {
    display: flex;
    justify-content: center;
    padding: var(--space-4);
  }

  .btn {
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-base);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .no-battle {
    text-align: center;
    padding: var(--space-12);
  }

  .no-battle p {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }
</style>
