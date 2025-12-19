<script lang="ts">
  import '../lib/styles/tokens.css'
  import { onMount } from 'svelte'
  import { goto, beforeNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { gameState, isLoading, gameError } from '$lib/stores/gameStore'
  import { projectNavigationView } from '$lib/game/projections/navigationView'
  import { GameHeader, DebugPanel } from '$lib/components'
  import { getRouteForPhase, isRouteValidForPhase } from '$lib/navigation/router'

  interface Props {
    children: import('svelte').Snippet
  }

  let { children }: Props = $props()

  // Project navigation view from current game state
  let navigationView = $derived(projectNavigationView($gameState))

  // Determine if we should show the header (not on main menu)
  let showHeader = $derived(
    navigationView.showHeader &&
    $page.url.pathname !== '/'
  )

  onMount(async () => {
    await gameState.initialize()
  })

  // Navigation guard: prevent navigation to routes invalid for current game phase
  beforeNavigate((navigation) => {
    // Skip guards while loading or if no destination
    if ($isLoading || !navigation.to) return

    const targetPath = navigation.to.url.pathname
    const currentPhase = $gameState.currentPhase

    // Allow navigation to main menu always
    if (targetPath === '/') return

    // Check if the target route is valid for the current phase
    if (!isRouteValidForPhase(targetPath, currentPhase)) {
      console.warn(`[Navigation Guard] Blocked navigation to ${targetPath} - invalid for phase ${currentPhase}`)
      navigation.cancel()

      // Redirect to the correct route for current phase
      const expectedRoute = getRouteForPhase(currentPhase)
      if (expectedRoute && expectedRoute !== $page.url.pathname) {
        goto(expectedRoute, { replaceState: true })
      }
    }
  })

  // Sync URL when game state changes (phase transitions)
  $effect(() => {
    // Skip during loading or if on main menu
    if ($isLoading) return

    const currentPhase = $gameState.currentPhase
    const currentPath = $page.url.pathname
    const expectedRoute = getRouteForPhase(currentPhase)

    // Navigate to correct route if URL doesn't match expected phase
    if (expectedRoute && currentPath !== expectedRoute) {
      // Don't navigate away from main menu unless game is started
      if (currentPath === '/' && currentPhase === 'not_started') return

      goto(expectedRoute, { replaceState: true })
    }
  })

  // Menu action handlers
  async function handleSave() {
    const saveName = `autosave-${Date.now()}`
    const result = await gameState.saveGame(saveName)
    if (result.success) {
      // Could show a toast notification here
      console.log('Game saved:', saveName)
    }
  }

  function handleLoad() {
    // Navigate to main menu to access load game
    goto('/')
  }

  function handleSettings() {
    // TODO: Implement settings modal
    console.log('Settings not yet implemented')
  }

  function handleMainMenu() {
    goto('/')
  }
</script>

<div class="app-container">
  {#if $isLoading}
    <div class="loading-screen">
      <div class="loading-content">
        <h1 class="loading-title">Space Fortress</h1>
        <p class="loading-text">Loading...</p>
      </div>
    </div>
  {:else}
    {#if showHeader}
      <GameHeader
        {navigationView}
        onSave={handleSave}
        onLoad={handleLoad}
        onSettings={handleSettings}
        onMainMenu={handleMainMenu}
      />
    {/if}
    {@render children()}
  {/if}

  {#if $gameError}
    <div class="error-toast" data-testid="error-toast" role="alert">
      <p data-testid="error-message">{$gameError}</p>
      <button onclick={() => gameError.clear()} data-testid="btn-dismiss-error">Dismiss</button>
    </div>
  {/if}

  <DebugPanel />
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.5;
  }

  :global(button) {
    font-family: inherit;
  }

  :global(input) {
    font-family: inherit;
  }

  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
  }

  .loading-content {
    text-align: center;
  }

  .loading-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 var(--space-4) 0;
  }

  .loading-text {
    color: var(--text-muted);
    font-size: var(--font-size-lg);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .error-toast {
    position: fixed;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-secondary);
    border: 1px solid var(--error);
    color: var(--error);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    z-index: var(--z-toast);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .error-toast p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .error-toast button {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    background: var(--bg-tertiary);
    border: 1px solid var(--error);
    color: var(--error);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .error-toast button:hover {
    background: var(--bg-elevated);
  }
</style>
