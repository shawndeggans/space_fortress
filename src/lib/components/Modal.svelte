<!--
  Modal - Container for detail views and confirmations

  Usage:
    <Modal title="Card Details" onclose={handleClose}>
      <p>Modal content here</p>
    </Modal>

    <Modal title="Confirm Action" onclose={handleClose}>
      <p>Are you sure?</p>
      {#snippet actions()}
        <button onclick={handleCancel}>Cancel</button>
        <button onclick={handleConfirm}>Confirm</button>
      {/snippet}
    </Modal>
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    onclose: () => void
    children: Snippet
    actions?: Snippet
    size?: 'small' | 'medium' | 'large'
  }

  let {
    title,
    onclose,
    children,
    actions,
    size = 'medium'
  }: Props = $props()

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose()
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
  <div class="modal modal--{size}">
    <header class="modal__header">
      <h2 id="modal-title" class="modal__title">{title}</h2>
      <button class="modal__close" onclick={onclose} aria-label="Close modal">×</button>
    </header>

    <div class="modal__content">
      {@render children()}
    </div>

    {#if actions}
      <footer class="modal__actions">
        {@render actions()}
      </footer>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
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

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-xl);
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: var(--z-modal);
    animation: slide-up 0.2s ease-out;
  }

  .modal--small {
    width: 100%;
    max-width: 400px;
  }

  .modal--medium {
    width: 100%;
    max-width: 600px;
  }

  .modal--large {
    width: 100%;
    max-width: 800px;
  }

  .modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-tertiary);
  }

  .modal__title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal__close {
    background: none;
    border: none;
    font-size: var(--font-size-2xl);
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    line-height: 1;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .modal__close:hover {
    color: var(--text-primary);
    background: var(--bg-elevated);
  }

  .modal__content {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
  }

  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4);
    border-top: 1px solid var(--border-default);
    background: var(--bg-tertiary);
  }

  .modal__actions :global(button) {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .modal__actions :global(button:first-child) {
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  .modal__actions :global(button:first-child:hover) {
    background: var(--bg-hover);
  }

  .modal__actions :global(button:last-child) {
    background: var(--accent-gradient);
    border: none;
    color: white;
  }

  .modal__actions :global(button:last-child:hover) {
    opacity: 0.9;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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
</style>
