<!--
  Narrative Screen
  Presents dilemmas with NPC voices and player choices.
-->
<script lang="ts">
  import { gameState } from '$lib/stores/gameStore'
  import { projectDilemmaView } from '$lib/game'
  import NpcVoiceBox from '$lib/components/NpcVoiceBox.svelte'
  import ChoiceButton from '$lib/components/ChoiceButton.svelte'
  import type { ChoiceData, ExtendedFactionId } from '$lib/components/types'
  import type { ChoiceData as ProjectionChoiceData } from '$lib/game/projections/dilemmaView'
  import { goto } from '$app/navigation'

  // Derive views from game state
  let dilemmaView = $derived(projectDilemmaView([], undefined, $gameState))

  async function handleChoice(choiceId: string) {
    if (!dilemmaView) return

    const result = await gameState.handleCommand({
      type: 'MAKE_CHOICE',
      data: {
        dilemmaId: dilemmaView.dilemmaId,
        choiceId
      }
    })

    if (result.success) {
      // Navigate based on what the choice triggers
      const choice = dilemmaView.choices.find(c => c.choiceId === choiceId)
      if (choice?.triggersAlliance) {
        goto('/alliance')
      } else if (choice?.triggersBattle) {
        goto('/card-pool')
      } else if (choice?.triggersMediation) {
        goto('/mediation')
      } else {
        // Stay on narrative for next dilemma or navigate based on phase
        const newPhase = $gameState.currentPhase
        if (newPhase === 'consequence') {
          goto('/consequence')
        }
        // Otherwise stay on narrative for next dilemma
      }
    }
  }

  // Transform projection ChoiceData to component ChoiceData
  function transformChoice(choice: ProjectionChoiceData): ChoiceData {
    return {
      id: choice.choiceId,
      label: choice.label,
      description: choice.description,
      consequences: {
        reputation: choice.reputationPreviews.map(rp => ({
          faction: rp.factionId,
          delta: rp.delta
        })),
        cards: [
          ...choice.cardsGained.map(c => ({ action: 'gain' as const, cardName: c, faction: 'meridian' as const })),
          ...choice.cardsLost.map(c => ({ action: 'lose' as const, cardName: c, faction: 'meridian' as const }))
        ],
        bounty: choice.bountyModifier ? { modifier: choice.bountyModifier, reason: 'choice' } : undefined,
        risk: choice.riskDescription ? { description: choice.riskDescription, probability: choice.riskProbability || 0 } : undefined
      },
      triggersBattle: choice.triggersBattle,
      triggersAlliance: choice.triggersAlliance,
      triggersMediation: choice.triggersMediation
    }
  }
</script>

<div class="narrative-screen">
  <main class="narrative-content">
    {#if dilemmaView}
      <!-- Situation Text -->
      <section class="situation-box">
        <p>{dilemmaView.situation}</p>
      </section>

      <!-- NPC Voices -->
      <section class="voices-section">
        {#each dilemmaView.voices as voice}
          <NpcVoiceBox
            npc={{
              name: voice.npcName,
              faction: voice.factionId as ExtendedFactionId
            }}
            dialogue={voice.dialogue}
            variant="full"
          />
        {/each}
      </section>

      <!-- Choices -->
      <section class="choices-section">
        {#each dilemmaView.choices as choice, i}
          <ChoiceButton
            choice={transformChoice(choice)}
            variant="full"
            onselect={() => handleChoice(choice.choiceId)}
          />
        {/each}
      </section>
    {:else}
      <div class="no-dilemma">
        <p>No active dilemma.</p>
        <button class="btn btn--primary" onclick={() => goto('/quest-hub')}>
          Return to Quest Hub
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  .narrative-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .narrative-content {
    flex: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .situation-box {
    padding: var(--space-6);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
  }

  .situation-box p {
    margin: 0;
    font-size: var(--font-size-lg);
    line-height: 1.8;
    color: var(--text-primary);
  }

  .voices-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .choices-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding-top: var(--space-6);
    border-top: 1px solid var(--border-default);
  }

  .no-dilemma {
    text-align: center;
    padding: var(--space-12);
  }

  .no-dilemma p {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }

  .btn {
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
  }

  .btn--primary {
    background: var(--accent-gradient);
    color: white;
  }

  .btn--primary:hover {
    opacity: 0.9;
  }
</style>
