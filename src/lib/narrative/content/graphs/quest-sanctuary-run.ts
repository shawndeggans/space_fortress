// ============================================================================
// QUEST 2: THE SANCTUARY RUN (Ashfall)
// ============================================================================
//
// Help refugees escape through a Void Warden blockade. Not everyone agrees
// they should be allowed through.
//
// ============================================================================

import type { NarrativeGraph, NarrativeNode, Transition } from '../../types'

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function createTransition(
  id: string,
  targetNodeId: string,
  choiceText: string,
  effects: Transition['effects'] = [],
  options: Partial<Transition['presentation']> = {}
): Transition {
  return {
    transitionId: id,
    targetNodeId,
    transitionType: 'choice',
    presentation: {
      choiceText,
      isHidden: false,
      isDisabled: false,
      ...options
    },
    effects
  }
}

// ----------------------------------------------------------------------------
// Nodes
// ----------------------------------------------------------------------------

const dilemma1_approach: NarrativeNode = {
  nodeId: 'dilemma_sanctuary_1_approach',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `You rendezvous with the refugee convoy at the edge of the restricted zone. The ships are in poor condition - patched together, running on fumes. Redhawk's route through the Warden patrols is risky but possible. However, your sensors have picked up something else: a Meridian trade convoy is passing nearby. They have legitimate transit codes.`,
    voices: [
      {
        npcName: 'Jax "Redhawk" Mora',
        factionId: 'ashfall',
        dialogue: `"Stick to the plan. My route works - we've done it before. The Wardens are predictable. We slip through during their patrol gap and we're clear before they know we were there."`,
        position: 'Original plan'
      },
      {
        npcName: 'First Mate Torres',
        factionId: 'crew',
        dialogue: `"That Meridian convoy... if we could convince them to add our ships to their manifest, we'd have legitimate passage. It's a long shot, but it would avoid any confrontation."`,
        position: 'Diplomatic alternative'
      },
      {
        npcName: 'Soren Vale',
        factionId: 'meridian',
        dialogue: `"[Over comms] I noticed your interesting formation out there. Looking to cross the line? I might be able to help - for the right price. Information is my trade, after all."`,
        position: 'Mercenary offer'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_use_redhawk_route',
      'dilemma_sanctuary_2_blockade',
      "Use Redhawk's route",
      [
        { effectType: 'increment', target: 'reputation_ashfall', value: 10 },
        { effectType: 'set_flag', target: 'sanctuary_stealth_route', value: true }
      ],
      { previewHint: 'Trust the Ashfall expert.', consequenceLevel: 'minor' }
    ),
    createTransition(
      'choice_negotiate_meridian',
      'dilemma_sanctuary_2_blockade',
      'Negotiate with Meridian',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 10 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 100 },
        { effectType: 'set_flag', target: 'sanctuary_diplomatic_route', value: true }
      ],
      { previewHint: 'Try for legitimate passage.', consequenceLevel: 'minor' }
    ),
    createTransition(
      'choice_direct_approach',
      'dilemma_sanctuary_2_blockade',
      'Approach directly',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 10 },
        { effectType: 'set_flag', target: 'sanctuary_direct_route', value: true },
        { effectType: 'set_flag', target: 'triggers_mediation', value: true }
      ],
      { previewHint: 'Request passage from the Wardens openly.', consequenceLevel: 'major' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma2_blockade: NarrativeNode = {
  nodeId: 'dilemma_sanctuary_2_blockade',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `You've reached the blockade. Three Warden patrol ships hold the passage, their weapons armed but not targeting. A voice crackles over the comm - it's Captain Thresh, demanding identification. How you proceed now will determine whether this ends peacefully or in fire.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        factionId: 'void_wardens',
        dialogue: `"Unknown vessels, you are entering a restricted corridor. Transmit identification codes and cargo manifests immediately. Non-compliance will be treated as hostile intent."`,
        position: 'Official warning'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        factionId: 'ashfall',
        dialogue: `"Now or never, Captain. Gun the engines and we can slip past before they get targeting solutions. These refugees can't survive another week out here - we have to try."`,
        position: 'Urging action'
      },
      {
        npcName: 'Elder Nomi',
        factionId: 'ashfall',
        dialogue: `"I... I recognize that voice. Thresh and I served together, decades ago. Before the Collapse. Let me speak to him. Perhaps old bonds mean something still."`,
        position: 'Personal connection'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_run_blockade',
      'dilemma_sanctuary_3_destination',
      'Run the blockade',
      [
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 20 },
        { effectType: 'increment', target: 'reputation_ashfall', value: 15 },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'void_warden_patrol', context: 'Running the Warden blockade', difficulty: 'medium' } },
        { effectType: 'set_flag', target: 'sanctuary_ran_blockade', value: true }
      ],
      { previewHint: 'Full speed ahead - trust in Ashfall pilots.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_let_nomi_speak',
      'dilemma_sanctuary_3_destination',
      'Let Elder Nomi speak',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 10 },
        { effectType: 'increment', target: 'reputation_ashfall', value: 5 },
        { effectType: 'set_flag', target: 'sanctuary_nomi_negotiated', value: true }
      ],
      { previewHint: 'Trust in the old connection.', consequenceLevel: 'minor' }
    ),
    createTransition(
      'choice_offer_cargo',
      'dilemma_sanctuary_3_destination',
      'Offer cargo as passage fee',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 15 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 150 },
        { effectType: 'set_flag', target: 'sanctuary_bribed_wardens', value: true }
      ],
      { previewHint: 'Bribe the Wardens with refugee supplies.', consequenceLevel: 'major' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma3_destination: NarrativeNode = {
  nodeId: 'dilemma_sanctuary_3_destination',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The convoy reaches Sanctuary Station, a neutral port in unclaimed space. But there's a problem: the station is already overcrowded, and the administrator is demanding payment for docking rights. The refugees have nothing left. Without docking, they're dead in the void.`,
    voices: [
      {
        npcName: 'Station Administrator',
        factionId: 'meridian',
        dialogue: `"Look, I sympathize, but I've got a station to run. Every berth they take is a berth I can't sell to paying customers. Someone has to cover the cost - 500 credits per ship, non-negotiable."`,
        position: 'Business reality'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        factionId: 'ashfall',
        dialogue: `"The Ashfall don't forget who helps us. Pay their docking fees from the mission bounty and we'll make it up to you tenfold. Or we could always... convince the administrator to reconsider."`,
        position: 'Loyalty or threats'
      },
      {
        npcName: 'Ghost',
        factionId: 'sundered_oath',
        dialogue: `"[Appearing from nowhere] Interesting situation. I happen to know the administrator has... flexible ethics. For a small fee, I could provide evidence of certain irregularities that might change their math."`,
        position: 'Blackmail option'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_pay_from_bounty',
      'quest_sanctuary_run_ending',
      'Pay from your bounty',
      [
        { effectType: 'increment', target: 'reputation_ashfall', value: 20 },
        { effectType: 'increment', target: 'reputation_meridian', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 300 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'ashfall_desperado', source: 'choice' } },
        { effectType: 'set_flag', target: 'sanctuary_paid_fees', value: true }
      ],
      { previewHint: 'Cover the refugee docking fees yourself.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_threaten_administrator',
      'quest_sanctuary_run_ending',
      'Threaten the administrator',
      [
        { effectType: 'increment', target: 'reputation_ashfall', value: 10 },
        { effectType: 'decrement', target: 'reputation_meridian', value: 15 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 10 },
        { effectType: 'set_flag', target: 'sanctuary_threatened', value: true }
      ],
      { previewHint: 'Make it clear refusal has consequences.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_use_blackmail',
      'quest_sanctuary_run_ending',
      "Use Ghost's information",
      [
        { effectType: 'increment', target: 'reputation_ashfall', value: 5 },
        { effectType: 'decrement', target: 'reputation_meridian', value: 10 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 15 },
        { effectType: 'decrement', target: 'bounty', value: 50 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'sundered_ghost_ship', source: 'choice' } },
        { effectType: 'set_flag', target: 'sanctuary_blackmailed', value: true },
        { effectType: 'set_flag', target: 'owes_ghost_favor', value: true }
      ],
      { previewHint: 'Blackmail the administrator into compliance.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_leave_refugees',
      'quest_sanctuary_run_ending',
      'Leave the refugees here',
      [
        { effectType: 'decrement', target: 'reputation_ashfall', value: 25 },
        { effectType: 'increment', target: 'reputation_ironveil', value: 10 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'trigger_event', target: 'CARD_LOST', value: { cardId: 'ashfall_redhawk', reason: 'choice' } },
        { effectType: 'set_flag', target: 'sanctuary_abandoned_refugees', value: true }
      ],
      { previewHint: 'Your job was escort, not charity.', consequenceLevel: 'irreversible' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const ending: NarrativeNode = {
  nodeId: 'quest_sanctuary_run_ending',
  nodeType: 'ending',
  content: {
    contentType: 'inline',
    text: `The refugee convoy has reached its destination - for better or worse. The Ashfall remember those who helped them in their darkest hour, and those who turned away. In the refugee camps and the scattered ships, your name is spoken - as savior or betrayer.`
  },
  transitions: [],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: ['quest_sanctuary_run_completed']
  }
}

// ----------------------------------------------------------------------------
// Graph Export
// ----------------------------------------------------------------------------

export const questSanctuaryRunGraph: NarrativeGraph = {
  graphId: 'quest_sanctuary_run',
  version: '1.0.0',
  metadata: {
    title: 'The Sanctuary Run',
    author: 'Space Fortress Team',
    totalNodeCount: 4,
    estimatedPlaythroughMinutes: 15,
    tags: ['ashfall', 'quest', 'refugees', 'blockade', 'moral-choice']
  },
  entryPoints: [
    {
      entryPointId: 'quest_sanctuary_run_start',
      startingNodeId: 'dilemma_sanctuary_1_approach',
      description: 'Guide refugee ships through a military blockade.'
    }
  ],
  nodes: new Map([
    ['dilemma_sanctuary_1_approach', dilemma1_approach],
    ['dilemma_sanctuary_2_blockade', dilemma2_blockade],
    ['dilemma_sanctuary_3_destination', dilemma3_destination],
    ['quest_sanctuary_run_ending', ending]
  ]),
  globalConditions: new Map()
}
