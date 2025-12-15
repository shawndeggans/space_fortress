// ============================================================================
// QUEST 3: THE BROKER'S GAMBIT (Meridian)
// ============================================================================
//
// A complex mediation contract where everyone has secrets, and loyalty is
// for sale to the highest bidder.
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

const dilemma1_opening: NarrativeNode = {
  nodeId: 'dilemma_broker_1_opening',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The negotiation takes place aboard a neutral station in the contested zone. Captain Thresh represents the Void Wardens; Razor speaks for the Sundered Oath. Before the official talks begin, both approach you privately with offers.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        factionId: 'void_wardens',
        dialogue: `"Mediator, a word in private. The Sundered are not negotiating in good faith. They're after something specific in that debris field - something dangerous. Lean our way in the talks, and I'll share what we know."`,
        position: 'Secret alliance offer'
      },
      {
        npcName: 'Razor',
        factionId: 'sundered_oath',
        dialogue: `"The Wardens talk about honor, but they're sitting on a fortune in salvage. Help me get access to the field, and I'll cut you in. Twenty percent of everything we find."`,
        position: 'Bribery attempt'
      },
      {
        npcName: 'Soren Vale',
        factionId: 'meridian',
        dialogue: `"[Via private channel] Interesting offers, aren't they? The Accord takes no official position, but... whoever's secret proves more valuable might find the Accord remembers such things."`,
        position: 'Encouraging duplicity'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_accept_warden_offer',
      'dilemma_broker_2_revelation',
      "Accept Thresh's offer",
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 10 },
        { effectType: 'set_flag', target: 'broker_allied_wardens', value: true },
        { effectType: 'set_flag', target: 'secret_alliance_active', value: true }
      ],
      { previewHint: 'Form a secret alliance with the Wardens.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_accept_razor_offer',
      'dilemma_broker_2_revelation',
      "Accept Razor's offer",
      [
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 10 },
        { effectType: 'increment', target: 'bounty', value: 200 },
        { effectType: 'set_flag', target: 'broker_allied_sundered', value: true },
        { effectType: 'set_flag', target: 'secret_alliance_active', value: true }
      ],
      { previewHint: 'Form a secret alliance with the Sundered.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_remain_neutral',
      'dilemma_broker_2_revelation',
      'Remain strictly neutral',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 15 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'decrement', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'set_flag', target: 'broker_stayed_neutral', value: true }
      ],
      { previewHint: 'Refuse both offers.', consequenceLevel: 'minor' }
    ),
    createTransition(
      'choice_play_both_sides',
      'dilemma_broker_2_revelation',
      'Accept both offers secretly',
      [
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'increment', target: 'bounty', value: 200 },
        { effectType: 'set_flag', target: 'broker_allied_wardens', value: true },
        { effectType: 'set_flag', target: 'broker_allied_sundered', value: true },
        { effectType: 'set_flag', target: 'double_agent', value: true }
      ],
      { previewHint: 'Promise loyalty to each side. High risk of exposure.', consequenceLevel: 'irreversible' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma2_revelation: NarrativeNode = {
  nodeId: 'dilemma_broker_2_revelation',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The negotiations have stalled. In a break, you access the station's archives and discover the truth: the Graveyard isn't just ancient debris. It contains the wreck of the Oathkeeper - the ship that carried the founders of BOTH the Void Wardens AND the Sundered Oath. They were once the same faction, split by a betrayal no one alive remembers clearly.`,
    voices: [
      {
        npcName: 'ARIA',
        factionId: 'other',
        dialogue: `"Records indicate the Oathkeeper carried pre-Collapse technology. Both factions seek it - the Wardens to destroy it, the Sundered to sell it. Neither admits this is the true prize."`,
        position: 'Information dump'
      },
      {
        npcName: 'Keeper Ash',
        factionId: 'void_wardens',
        dialogue: `"You've found the truth. The technology aboard that ship could restart the wars that nearly destroyed humanity. It must be contained. Help us, and we will remember."`,
        position: 'Appeal to duty'
      },
      {
        npcName: 'Ghost',
        factionId: 'sundered_oath',
        dialogue: `"Pre-Collapse tech? That's worth more than this entire station. The Wardens want to bury it because they're afraid. Fear is weakness. Strength is taking what you can sell."`,
        position: 'Appeal to greed'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_support_wardens',
      'dilemma_broker_3_choice',
      'Support Warden containment',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 20 },
        { effectType: 'decrement', target: 'reputation_sundered_oath', value: 20 },
        { effectType: 'decrement', target: 'reputation_meridian', value: 10 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'void_warden_prime', source: 'choice' } },
        { effectType: 'set_flag', target: 'broker_chose_containment', value: true }
      ],
      { previewHint: 'Help destroy the dangerous technology.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_support_sundered',
      'dilemma_broker_3_choice',
      'Help the Sundered retrieve it',
      [
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 25 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 20 },
        { effectType: 'increment', target: 'reputation_ironveil', value: 5 },
        { effectType: 'increment', target: 'bounty', value: 400 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'sundered_oathbreaker', source: 'choice' } },
        { effectType: 'set_flag', target: 'broker_chose_profit', value: true }
      ],
      { previewHint: 'Profit from dangerous technology.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_reveal_truth',
      'dilemma_broker_3_choice',
      'Reveal everything publicly',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 20 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 10 },
        { effectType: 'decrement', target: 'reputation_sundered_oath', value: 10 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'meridian_broker', source: 'choice' } },
        { effectType: 'set_flag', target: 'broker_revealed_truth', value: true }
      ],
      { previewHint: 'Let both factions know the full truth.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_sell_information',
      'dilemma_broker_3_choice',
      'Sell the information',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 5 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 10 },
        { effectType: 'increment', target: 'bounty', value: 300 },
        { effectType: 'set_flag', target: 'broker_sold_secrets', value: true }
      ],
      { previewHint: 'This knowledge is worth credits.', consequenceLevel: 'major' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma3_choice: NarrativeNode = {
  nodeId: 'dilemma_broker_3_choice',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The situation has exploded. Both factions now know about the Oathkeeper's true cargo. Ships are mobilizing. If you don't act now, this will become a battle that could spread far beyond the Graveyard. You have one chance to shape how this ends.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        factionId: 'void_wardens',
        dialogue: `"The Sundered will not negotiate - they never do. Stand with us and we end this threat. The old codes demand it. Will you honor them?"`,
        position: 'Military alliance'
      },
      {
        npcName: 'Razor',
        factionId: 'sundered_oath',
        dialogue: `"The Wardens are fossils clinging to dead traditions. Help me secure that technology and we'll have the power to write our own future. No more running. No more hiding."`,
        position: 'Revolutionary alliance'
      },
      {
        npcName: 'Magistrate Yun',
        factionId: 'meridian',
        dialogue: `"There may yet be a way to satisfy everyone. The technology could be studied jointly, under Accord supervision. A compromise that serves all... though perhaps satisfies none."`,
        position: 'Diplomatic solution'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_fight_with_wardens',
      'dilemma_broker_4_resolution',
      'Fight alongside the Wardens',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 25 },
        { effectType: 'decrement', target: 'reputation_sundered_oath', value: 30 },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'sundered_raiders', context: 'Battle for the Oathkeeper', difficulty: 'hard' } },
        { effectType: 'set_flag', target: 'broker_battle_wardens', value: true }
      ],
      { previewHint: 'Contain the threat by force.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_fight_with_sundered',
      'dilemma_broker_4_resolution',
      'Fight alongside the Sundered',
      [
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 25 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 30 },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'void_warden_fleet', context: 'Battle for the Oathkeeper', difficulty: 'hard' } },
        { effectType: 'set_flag', target: 'broker_battle_sundered', value: true }
      ],
      { previewHint: 'Seize the future by force.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_broker_compromise',
      'dilemma_broker_4_resolution',
      'Push for compromise',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 30 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'decrement', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'meridian_negotiator', source: 'choice' } },
        { effectType: 'set_flag', target: 'broker_forced_compromise', value: true }
      ],
      { previewHint: 'Force both sides to the table.', consequenceLevel: 'major' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma4_resolution: NarrativeNode = {
  nodeId: 'dilemma_broker_4_resolution',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The dust settles. The Oathkeeper's fate has been decided - by battle or negotiation. Now comes the question of what to do with the aftermath. Both factions are wounded, and the balance of power in the sector has shifted. Where do you stand when the credits are counted?`,
    voices: [
      {
        npcName: 'Soren Vale',
        factionId: 'meridian',
        dialogue: `"Well played, Captain. Whatever happens, the Accord will remember this day. The question is: how do you want to be remembered? As a peacemaker... or an opportunist?"`,
        position: 'Final reflection'
      },
      {
        npcName: 'First Mate Torres',
        factionId: 'crew',
        dialogue: `"We've made enemies today, Captain. And maybe friends. But we're still flying, and that's what matters. Let's collect our pay and get out before someone changes their mind."`,
        position: 'Pragmatic advice'
      },
      {
        npcName: 'ARIA',
        factionId: 'other',
        dialogue: `"Historical note: the Oathkeeper's crew believed their mission would bring lasting peace. They were wrong. Perhaps you will be different. Perhaps not. Recording complete."`,
        position: 'Ominous conclusion'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_take_payment_leave',
      'quest_brokers_gambit_ending',
      'Take your payment and leave',
      [
        { effectType: 'increment', target: 'bounty', value: 200 },
        { effectType: 'set_flag', target: 'broker_clean_exit', value: true }
      ],
      { previewHint: 'The job is done. Time to move on.', consequenceLevel: 'minor' }
    ),
    createTransition(
      'choice_pledge_to_winner',
      'quest_brokers_gambit_ending',
      'Pledge allegiance to the victor',
      [
        { effectType: 'increment', target: 'reputation_void_wardens', value: 15 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 15 },
        { effectType: 'set_flag', target: 'broker_joined_victor', value: true }
      ],
      { previewHint: 'Throw in your lot with whoever came out on top.', consequenceLevel: 'major' }
    ),
    createTransition(
      'choice_disappear',
      'quest_brokers_gambit_ending',
      'Disappear into the black',
      [
        { effectType: 'decrement', target: 'reputation_meridian', value: 10 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 100 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'sundered_exile', source: 'choice' } },
        { effectType: 'set_flag', target: 'broker_disappeared', value: true }
      ],
      { previewHint: 'Too many people know your face now.', consequenceLevel: 'major' }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const ending: NarrativeNode = {
  nodeId: 'quest_brokers_gambit_ending',
  nodeType: 'ending',
  content: {
    contentType: 'inline',
    text: `The Graveyard holds its secrets a little longer - or perhaps gives them up forever. The Oathkeeper's legacy, like the factions it spawned, remains divided. And you? You've learned that in the game of information, everyone is both buyer and seller. The question is what price you're willing to pay.`
  },
  transitions: [],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: ['quest_brokers_gambit_completed']
  }
}

// ----------------------------------------------------------------------------
// Graph Export
// ----------------------------------------------------------------------------

export const questBrokersGambitGraph: NarrativeGraph = {
  graphId: 'quest_brokers_gambit',
  version: '1.0.0',
  metadata: {
    title: "The Broker's Gambit",
    author: 'Space Fortress Team',
    totalNodeCount: 5,
    estimatedPlaythroughMinutes: 20,
    tags: ['meridian', 'quest', 'intrigue', 'secrets', 'moral-choice']
  },
  entryPoints: [
    {
      entryPointId: 'quest_brokers_gambit_start',
      startingNodeId: 'dilemma_broker_1_opening',
      description: 'Mediate a territorial dispute with hidden agendas.'
    }
  ],
  nodes: new Map([
    ['dilemma_broker_1_opening', dilemma1_opening],
    ['dilemma_broker_2_revelation', dilemma2_revelation],
    ['dilemma_broker_3_choice', dilemma3_choice],
    ['dilemma_broker_4_resolution', dilemma4_resolution],
    ['quest_brokers_gambit_ending', ending]
  ]),
  globalConditions: new Map()
}
