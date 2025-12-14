<!--
  GameMenu - Dropdown menu for game actions (save, load, settings, main menu)

  Usage:
    <GameMenu
      canSave={true}
      onSave={handleSave}
      onLoad={handleLoad}
      onMainMenu={handleMainMenu}
    />
-->
<script lang="ts">
  interface Props {
    canSave?: boolean
    onSave?: () => void
    onLoad?: () => void
    onSettings?: () => void
    onMainMenu?: () => void
  }

  let {
    canSave = true,
    onSave,
    onLoad,
    onSettings,
    onMainMenu
  }: Props = $props()

  let isOpen = $state(false)
  let showConfirmDialog = $state(false)
  let confirmAction = $state<'main_menu' | 'load' | null>(null)

  function toggleMenu() {
    isOpen = !isOpen
  }

  function closeMenu() {
    isOpen = false
  }

  function handleSave() {
    closeMenu()
    onSave?.()
  }

  function handleLoad() {
    // Show confirmation since loading will lose current progress
    confirmAction = 'load'
    showConfirmDialog = true
    closeMenu()
  }

  function handleSettings() {
    closeMenu()
    onSettings?.()
  }

  function handleMainMenu() {
    // Show confirmation since returning will lose current progress
    confirmAction = 'main_menu'
    showConfirmDialog = true
    closeMenu()
  }

  function confirmDialogAction() {
    showConfirmDialog = false
    if (confirmAction === 'main_menu') {
      onMainMenu?.()
    } else if (confirmAction === 'load') {
      onLoad?.()
    }
    confirmAction = null
  }

  function cancelDialog() {
    showConfirmDialog = false
    confirmAction = null
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showConfirmDialog) {
        cancelDialog()
      } else if (isOpen) {
        closeMenu()
      }
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('menu-backdrop')) {
      closeMenu()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="game-menu">
  <button
    class="menu-button"
    onclick={toggleMenu}
    aria-expanded={isOpen}
    aria-haspopup="true"
    data-testid="btn-menu"
  >
    <span class="menu-icon">{isOpen ? '×' : '☰'}</span>
    <span class="menu-label">Menu</span>
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="menu-backdrop" onclick={handleBackdropClick}></div>
    <div class="menu-dropdown" data-testid="menu-dropdown" role="menu">
      <button
        class="menu-item"
        onclick={handleSave}
        disabled={!canSave}
        role="menuitem"
        data-testid="btn-save-game"
      >
        <span class="item-icon">💾</span>
        <span class="item-label">Save Game</span>
      </button>

      <button
        class="menu-item"
        onclick={handleLoad}
        role="menuitem"
        data-testid="btn-load-game"
      >
        <span class="item-icon">📂</span>
        <span class="item-label">Load Game</span>
      </button>

      <div class="menu-divider"></div>

      <button
        class="menu-item"
        onclick={handleSettings}
        role="menuitem"
        data-testid="btn-settings"
      >
        <span class="item-icon">⚙️</span>
        <span class="item-label">Settings</span>
      </button>

      <div class="menu-divider"></div>

      <button
        class="menu-item menu-item--danger"
        onclick={handleMainMenu}
        role="menuitem"
        data-testid="btn-main-menu"
      >
        <span class="item-icon">🏠</span>
        <span class="item-label">Main Menu</span>
      </button>
    </div>
  {/if}
</div>

{#if showConfirmDialog}
  <div class="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="confirm-dialog">
      <h3 id="confirm-title" class="confirm-title">
        {confirmAction === 'main_menu' ? 'Return to Main Menu?' : 'Load Game?'}
      </h3>
      <p class="confirm-message">
        {confirmAction === 'main_menu'
          ? 'Any unsaved progress will be lost.'
          : 'Loading a game will replace your current progress. Make sure to save first!'}
      </p>
      <div class="confirm-actions">
        <button class="confirm-btn confirm-btn--cancel" onclick={cancelDialog}>
          Cancel
        </button>
        <button class="confirm-btn confirm-btn--confirm" onclick={confirmDialogAction}>
          {confirmAction === 'main_menu' ? 'Return to Menu' : 'Load Game'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .game-menu {
    position: relative;
  }

  .menu-button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .menu-button:hover {
    background: var(--bg-elevated);
    border-color: var(--border-active);
  }

  .menu-icon {
    font-size: var(--font-size-base);
    width: 1.25em;
    text-align: center;
  }

  .menu-label {
    /* Hide on mobile */
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-dropdown) - 1);
  }

  .menu-dropdown {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    min-width: 180px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-2);
    z-index: var(--z-dropdown);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    animation: dropdown-in 0.15s ease-out;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .menu-item:hover:not(:disabled) {
    background: var(--bg-elevated);
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item--danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    color: var(--error);
  }

  .item-icon {
    font-size: var(--font-size-base);
    width: 1.5em;
    text-align: center;
  }

  .item-label {
    flex: 1;
  }

  .menu-divider {
    height: 1px;
    background: var(--border-default);
    margin: var(--space-2) 0;
  }

  /* Confirmation Dialog */
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    z-index: var(--z-modal-backdrop);
    animation: fade-in 0.2s ease-out;
  }

  .confirm-dialog {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    max-width: 400px;
    width: 100%;
    z-index: var(--z-modal);
    animation: slide-up 0.2s ease-out;
  }

  .confirm-title {
    margin: 0 0 var(--space-3);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .confirm-message {
    margin: 0 0 var(--space-6);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }

  .confirm-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .confirm-btn--cancel {
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .confirm-btn--cancel:hover {
    background: var(--bg-hover);
  }

  .confirm-btn--confirm {
    background: var(--accent-gradient);
    border: none;
    color: white;
  }

  .confirm-btn--confirm:hover {
    opacity: 0.9;
  }

  @keyframes dropdown-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .menu-label {
      display: none;
    }

    .menu-button {
      padding: var(--space-2);
    }
  }
</style>
