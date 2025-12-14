<script lang="ts">
  import { onMount } from 'svelte'
  import { gameState, saveGames, gameError, isLoading } from '../lib/stores/gameStore'
  import type { SaveGamePreview } from '../lib/game/types'

  let saveName = $state('quicksave')
  let showSaveMenu = $state(false)

  onMount(async () => {
    await gameState.initialize()
  })

  async function startGame() {
    await gameState.newGame()
    await gameState.handleCommand({
      type: 'START_GAME',
      data: { playerId: gameState.getPlayerId() }
    })
  }

  async function acceptQuest(questId: string) {
    await gameState.handleCommand({
      type: 'ACCEPT_QUEST',
      data: { questId }
    })
  }

  async function save() {
    await gameState.saveGame(saveName)
    showSaveMenu = false
  }

  async function load(saveToLoad: SaveGamePreview) {
    await gameState.loadGame(saveToLoad.save_name)
    showSaveMenu = false
  }

  async function deleteSave(saveToDelete: SaveGamePreview) {
    if (confirm(`Delete save "${saveToDelete.save_name}"?`)) {
      await gameState.deleteSave(saveToDelete.save_name)
    }
  }
</script>

<main class="game-container">
  <header class="game-header">
    <h1>Space Fortress</h1>
    <p class="subtitle">A Narrative Tactical Adventure</p>
  </header>

  {#if $isLoading}
    <div class="loading">
      <p>Loading...</p>
    </div>
  {:else if $gameState.gameStatus === 'not_started'}
    <div class="main-menu">
      <h2>Main Menu</h2>
      <div class="menu-buttons">
        <button class="primary" onclick={startGame}>New Game</button>
        <button onclick={() => showSaveMenu = !showSaveMenu}>
          {showSaveMenu ? 'Hide Saves' : 'Load Game'}
        </button>
      </div>

      {#if showSaveMenu && $saveGames.length > 0}
        <div class="save-list">
          <h3>Save Games</h3>
          {#each $saveGames as saveGame}
            <div class="save-item">
              <div class="save-info">
                <strong>{saveGame.save_name}</strong>
                <span class="save-details">
                  Phase: {saveGame.phase} | Bounty: {saveGame.bounty}
                </span>
                <span class="save-date">{new Date(saveGame.saved_at).toLocaleString()}</span>
              </div>
              <div class="save-actions">
                <button onclick={() => load(saveGame)}>Load</button>
                <button class="danger" onclick={() => deleteSave(saveGame)}>Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {:else if showSaveMenu}
        <p class="no-saves">No save games found</p>
      {/if}
    </div>
  {:else}
    <div class="game-screen">
      <div class="stats-bar">
        <span class="stat">Phase: {$gameState.currentPhase}</span>
        <span class="stat">Bounty: {$gameState.bounty}</span>
        <span class="stat">Cards: {$gameState.ownedCards.length}</span>
        <span class="stat">Quests: {$gameState.completedQuests.length}</span>
      </div>

      <div class="scene">
        {#if $gameState.currentPhase === 'quest_hub'}
          <div class="narration">
            <h2>Quest Hub</h2>
            <p>You drift through the void of space aboard your command vessel. The stars stretch endlessly before you.</p>
            <p class="emphasis">Three contracts await your consideration:</p>
          </div>

          <div class="quest-list">
            {#each $gameState.availableQuestIds as questId}
              <button class="quest-button" onclick={() => acceptQuest(questId)}>
                <strong>{questId.replace(/_/g, ' ').replace('quest ', '')}</strong>
                <span class="quest-faction">
                  {#if questId.includes('salvage')}Ironveil Syndicate{/if}
                  {#if questId.includes('sanctuary')}Ashfall Remnants{/if}
                  {#if questId.includes('broker')}Meridian Accord{/if}
                </span>
              </button>
            {/each}
          </div>
        {:else if $gameState.currentPhase === 'narrative'}
          <div class="narration">
            <h2>Dilemma</h2>
            <p>Your quest continues...</p>
            <p class="emphasis">Current dilemma: {$gameState.currentDilemmaId}</p>
            <p class="demo-note">(Narrative content coming soon)</p>
          </div>
        {:else}
          <div class="narration">
            <h2>Phase: {$gameState.currentPhase}</h2>
            <p class="demo-note">This phase is under development.</p>
          </div>
        {/if}

        {#if $gameState.activeQuest}
          <div class="active-quest-info">
            <strong>Active Quest:</strong> {$gameState.activeQuest.questId}
          </div>
        {/if}
      </div>

      <div class="faction-rep">
        <h3>Faction Reputation</h3>
        <div class="rep-bars">
          {#each Object.entries($gameState.reputation) as [faction, value]}
            <div class="rep-item">
              <span class="faction-name">{faction.replace(/_/g, ' ')}</span>
              <span class="rep-value" class:positive={value > 0} class:negative={value < 0}>
                {value > 0 ? '+' : ''}{value}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <div class="game-controls">
        <div class="save-controls">
          <input
            type="text"
            bind:value={saveName}
            placeholder="Save name..."
          />
          <button onclick={save}>Save Game</button>
        </div>
        <button class="secondary" onclick={() => showSaveMenu = !showSaveMenu}>
          {showSaveMenu ? 'Hide Menu' : 'Load/Menu'}
        </button>
      </div>

      {#if showSaveMenu}
        <div class="save-menu-overlay">
          <div class="save-menu">
            <h3>Game Menu</h3>
            <div class="menu-options">
              <button onclick={() => { gameState.newGame(); showSaveMenu = false; }}>
                Return to Main Menu
              </button>
            </div>
            {#if $saveGames.length > 0}
              <h4>Load Save</h4>
              <div class="save-list">
                {#each $saveGames as saveGame}
                  <div class="save-item">
                    <div class="save-info">
                      <strong>{saveGame.save_name}</strong>
                      <span class="save-details">
                        Phase: {saveGame.phase} | Quests: {saveGame.questsCompleted}
                      </span>
                    </div>
                    <button onclick={() => load(saveGame)}>Load</button>
                  </div>
                {/each}
              </div>
            {/if}
            <button class="close-menu" onclick={() => showSaveMenu = false}>Close</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if $gameError}
    <div class="error-toast">
      <p>{$gameError}</p>
      <button onclick={() => gameError.clear()}>Dismiss</button>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #0a0a0f;
    color: #e0e0e0;
    min-height: 100vh;
  }

  .game-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .game-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .game-header h1 {
    font-size: 2.5rem;
    margin: 0;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #888;
    margin-top: 0.5rem;
  }

  .loading {
    text-align: center;
    padding: 4rem;
  }

  .main-menu {
    text-align: center;
  }

  .main-menu h2 {
    color: #a0a0a0;
    margin-bottom: 2rem;
  }

  .menu-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 300px;
    margin: 0 auto;
  }

  button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #2a2a3a;
    color: #e0e0e0;
  }

  button:hover {
    background: #3a3a4a;
    transform: translateY(-2px);
  }

  button.primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
  }

  button.primary:hover {
    background: linear-gradient(135deg, #5558e3, #7c4fe8);
  }

  button.secondary {
    background: #1a1a2a;
    border: 1px solid #3a3a4a;
  }

  button.danger {
    background: #4a1a1a;
    color: #ff8080;
  }

  button.danger:hover {
    background: #5a2a2a;
  }

  .save-list {
    margin-top: 2rem;
    text-align: left;
  }

  .save-list h3 {
    color: #888;
    margin-bottom: 1rem;
  }

  .save-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #1a1a2a;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }

  .save-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .save-details {
    font-size: 0.85rem;
    color: #888;
  }

  .save-date {
    font-size: 0.75rem;
    color: #666;
  }

  .save-actions {
    display: flex;
    gap: 0.5rem;
  }

  .save-actions button {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .no-saves {
    color: #666;
    font-style: italic;
  }

  .game-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .stats-bar {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    background: #1a1a2a;
    border-radius: 8px;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat {
    font-size: 0.9rem;
    color: #a0a0a0;
  }

  .scene {
    flex: 1;
    padding: 2rem;
    background: #12121a;
    border-radius: 12px;
    border: 1px solid #2a2a3a;
    margin-bottom: 2rem;
  }

  .narration {
    line-height: 1.8;
    font-size: 1.1rem;
  }

  .narration h2 {
    color: #8b5cf6;
    margin-top: 0;
  }

  .narration p {
    margin-bottom: 1rem;
  }

  .narration .emphasis {
    font-style: italic;
    color: #8b5cf6;
    margin-top: 2rem;
    font-size: 1.2rem;
  }

  .quest-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2rem;
  }

  .quest-button {
    padding: 1.25rem 1.5rem;
    background: #1a1a2a;
    border: 2px solid #3a3a4a;
    text-align: left;
    font-size: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .quest-button:hover {
    border-color: #6366f1;
    background: #2a2a3a;
  }

  .quest-faction {
    font-size: 0.85rem;
    color: #888;
  }

  .active-quest-info {
    margin-top: 2rem;
    padding: 1rem;
    background: #1a1a2a;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .faction-rep {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #12121a;
    border-radius: 8px;
    border: 1px solid #2a2a3a;
  }

  .faction-rep h3 {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: #888;
  }

  .rep-bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.5rem;
  }

  .rep-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: #1a1a2a;
    border-radius: 4px;
  }

  .faction-name {
    font-size: 0.8rem;
    text-transform: capitalize;
  }

  .rep-value {
    font-weight: bold;
    font-size: 0.8rem;
  }

  .rep-value.positive {
    color: #4ade80;
  }

  .rep-value.negative {
    color: #f87171;
  }

  .demo-note {
    color: #666;
    font-size: 0.9rem;
    font-style: italic;
  }

  .game-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .save-controls {
    display: flex;
    gap: 0.5rem;
  }

  .save-controls input {
    padding: 0.75rem;
    border: 1px solid #3a3a4a;
    border-radius: 8px;
    background: #1a1a2a;
    color: #e0e0e0;
    font-size: 1rem;
    width: 150px;
  }

  .save-controls input:focus {
    outline: none;
    border-color: #6366f1;
  }

  .save-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .save-menu {
    background: #1a1a2a;
    padding: 2rem;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .save-menu h3 {
    margin-top: 0;
    color: #e0e0e0;
  }

  .save-menu h4 {
    color: #888;
    margin-top: 1.5rem;
  }

  .menu-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .close-menu {
    width: 100%;
    margin-top: 1.5rem;
  }

  .error-toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: #4a1a1a;
    color: #ff8080;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 1rem;
    z-index: 200;
  }

  .error-toast p {
    margin: 0;
  }

  .error-toast button {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }
</style>
