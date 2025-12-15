// ============================================================================
// QUEST 1: THE SALVAGE CLAIM (Ironveil)
// ============================================================================
//
// A corporate escort mission turns complicated when you discover the "cargo"
// has a history - and survivors who remember it.
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
  options: Partial<Transition> = {}
): Transition {
  return {
    transitionId: id,
    targetNodeId,
    transitionType: 'choice',
    presentation: {
      choiceText,
      isHidden: false,
      isDisabled: false,
      ...options.presentation
    },
    effects,
    ...options
  }
}

// ----------------------------------------------------------------------------
// Nodes
// ----------------------------------------------------------------------------

const dilemma1_approach: NarrativeNode = {
  nodeId: 'dilemma_salvage_1_approach',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `Your convoy approaches the coordinates of the Stellaris Dawn. Long-range scans show the wreck is intact but dormant - and there are heat signatures nearby. Someone else is here. Your sensors identify at least three small vessels running silent near the debris field.`,
    voices: [
      {
        npcName: 'Director Chen',
        factionId: 'ironveil',
        dialogue: `"Scavengers. Drive them off - we have legal salvage rights here. Make it clear this wreck belongs to the Syndicate."`,
        position: 'Aggressive approach'
      },
      {
        npcName: 'First Mate Torres',
        factionId: 'crew',
        dialogue: `"Three ships, running silent... they're either scared or setting up an ambush. We could try hailing them first - might avoid a fight."`,
        position: 'Cautious approach'
      },
      {
        npcName: 'Chief Engineer Kai',
        factionId: 'crew',
        dialogue: `"I'm reading something strange from those ships. The power signatures are wrong for scavengers. Those are refugee vessels - probably Ashfall."`,
        position: 'Concerned observation'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_attack_immediately',
      'dilemma_salvage_2_discovery',
      'Attack immediately',
      [
        { effectType: 'increment', target: 'reputation_ironveil', value: 10 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 15 },
        { effectType: 'set_flag', target: 'salvage_attacked_first', value: true },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'scavengers', context: 'Defending the salvage claim', difficulty: 'easy' } }
      ],
      { presentation: { choiceText: 'Attack immediately', previewHint: 'Assert Syndicate authority with force.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_hail_first',
      'dilemma_salvage_2_discovery',
      'Hail the vessels',
      [
        { effectType: 'increment', target: 'reputation_meridian', value: 5 },
        { effectType: 'set_flag', target: 'salvage_hailed_first', value: true }
      ],
      { presentation: { choiceText: 'Hail the vessels', previewHint: 'Try to communicate before shooting.', consequenceLevel: 'minor', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_wait_observe',
      'dilemma_salvage_2_discovery',
      'Wait and observe',
      [
        { effectType: 'decrement', target: 'reputation_ironveil', value: 5 },
        { effectType: 'set_flag', target: 'salvage_waited', value: true }
      ],
      { presentation: { choiceText: 'Wait and observe', previewHint: 'Hold position and gather more intelligence.', consequenceLevel: 'minor', isHidden: false, isDisabled: false } }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma2_discovery: NarrativeNode = {
  nodeId: 'dilemma_salvage_2_discovery',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `The salvage team boards the Stellaris Dawn while your ships secure the perimeter. Thirty minutes in, they report a discovery: the ship's cargo hold contains cryopods. Occupied cryopods. Forty-seven colonists in suspended animation - alive, but their pods are failing. The Syndicate's salvage rights don't mention any survivors.`,
    voices: [
      {
        npcName: 'Director Chen',
        factionId: 'ironveil',
        dialogue: `"This changes nothing. Our claim covers the entire vessel and its contents. Those colonists are now Syndicate property until their families pay the salvage fees. Standard procedure."`,
        position: 'Corporate pragmatism'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        factionId: 'ashfall',
        dialogue: `"Those are OUR people! The Stellaris Dawn was a refugee ship that disappeared during the Collapse. The Syndicate CAUSED that disaster - now they want to profit from the survivors?"`,
        position: 'Furious accusation'
      },
      {
        npcName: 'First Mate Torres',
        factionId: 'crew',
        dialogue: `"Captain... those pods are failing. Whatever we decide, we need to decide fast. Maybe there's a way to satisfy everyone here."`,
        position: 'Urgent mediation'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_syndicate_claim',
      'dilemma_salvage_3_confrontation',
      'Honor the Syndicate claim',
      [
        { effectType: 'increment', target: 'reputation_ironveil', value: 15 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 20 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'increment', target: 'bounty', value: 200 },
        { effectType: 'set_flag', target: 'salvage_sided_ironveil', value: true }
      ],
      { presentation: { choiceText: 'Honor the Syndicate claim', previewHint: 'The survivors belong to Ironveil by salvage law.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_release_survivors',
      'dilemma_salvage_3_confrontation',
      'Release the survivors',
      [
        { effectType: 'decrement', target: 'reputation_ironveil', value: 20 },
        { effectType: 'increment', target: 'reputation_ashfall', value: 20 },
        { effectType: 'increment', target: 'reputation_void_wardens', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 200 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'ashfall_ember', source: 'choice' } },
        { effectType: 'set_flag', target: 'salvage_sided_ashfall', value: true }
      ],
      { presentation: { choiceText: 'Release the survivors', previewHint: 'Let the Ashfall take their people.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_negotiate_split',
      'dilemma_salvage_3_confrontation',
      'Propose a split',
      [
        { effectType: 'decrement', target: 'reputation_ironveil', value: 5 },
        { effectType: 'increment', target: 'reputation_ashfall', value: 5 },
        { effectType: 'increment', target: 'reputation_meridian', value: 10 },
        { effectType: 'set_flag', target: 'salvage_negotiated', value: true },
        { effectType: 'set_flag', target: 'triggers_alliance', value: true }
      ],
      { presentation: { choiceText: 'Propose a split', previewHint: 'Survivors to Ashfall, cargo to Syndicate.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const dilemma3_confrontation: NarrativeNode = {
  nodeId: 'dilemma_salvage_3_confrontation',
  nodeType: 'choice',
  content: {
    contentType: 'inline',
    text: `Your decision has consequences. More ships are arriving - called by whoever didn't get what they wanted. The situation is deteriorating into a standoff. Someone is going to shoot first, and when they do, you'll be right in the middle of it.`,
    voices: [
      {
        npcName: 'Kira Voss',
        factionId: 'ironveil',
        dialogue: `"The Syndicate appreciates loyalty. Stand with us now and there will be more contracts - better contracts. Walk away and we'll remember that too."`,
        position: 'Offer of alliance'
      },
      {
        npcName: 'Elder Nomi',
        factionId: 'ashfall',
        dialogue: `"I was aboard the Stellaris Dawn when it launched. My daughter is in one of those pods. Please... don't let them take her again."`,
        position: 'Emotional appeal'
      },
      {
        npcName: 'Captain Thresh',
        factionId: 'void_wardens',
        dialogue: `"This is Void Warden space. Both factions are violating the neutral zone protocols. I can offer escort out of the area - but only to those who stand down first."`,
        position: 'Third option'
      }
    ]
  },
  transitions: [
    createTransition(
      'choice_fight_for_ironveil',
      'quest_salvage_claim_ending',
      'Fight alongside Ironveil',
      [
        { effectType: 'increment', target: 'reputation_ironveil', value: 15 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 25 },
        { effectType: 'decrement', target: 'reputation_void_wardens', value: 10 },
        { effectType: 'increment', target: 'bounty', value: 300 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'ironveil_creditor', source: 'choice' } },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'ashfall_raiders', context: 'Defending the Syndicate claim', difficulty: 'medium' } },
        { effectType: 'set_flag', target: 'salvage_final_ironveil', value: true }
      ],
      { presentation: { choiceText: 'Fight alongside Ironveil', previewHint: 'Honor your contract to the end.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_switch_to_ashfall',
      'quest_salvage_claim_ending',
      'Switch sides to Ashfall',
      [
        { effectType: 'decrement', target: 'reputation_ironveil', value: 30 },
        { effectType: 'increment', target: 'reputation_ashfall', value: 25 },
        { effectType: 'increment', target: 'reputation_sundered_oath', value: 5 },
        { effectType: 'decrement', target: 'bounty', value: 100 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'ashfall_phoenix', source: 'choice' } },
        { effectType: 'trigger_event', target: 'CARD_LOST', value: { cardId: 'ironveil_ironclad', reason: 'choice' } },
        { effectType: 'trigger_event', target: 'BATTLE_TRIGGERED', value: { opponentType: 'ironveil_enforcers', context: 'Defending the refugees', difficulty: 'medium' } },
        { effectType: 'set_flag', target: 'salvage_final_ashfall', value: true },
        { effectType: 'set_flag', target: 'broke_ironveil_contract', value: true }
      ],
      { presentation: { choiceText: 'Switch sides to Ashfall', previewHint: 'Break your contract for the refugees.', consequenceLevel: 'irreversible', isHidden: false, isDisabled: false } }
    ),
    createTransition(
      'choice_accept_warden_escort',
      'quest_salvage_claim_ending',
      'Accept Warden escort',
      [
        { effectType: 'decrement', target: 'reputation_ironveil', value: 10 },
        { effectType: 'decrement', target: 'reputation_ashfall', value: 5 },
        { effectType: 'increment', target: 'reputation_void_wardens', value: 15 },
        { effectType: 'decrement', target: 'bounty', value: 150 },
        { effectType: 'trigger_event', target: 'CARD_GAINED', value: { cardId: 'void_beacon_keeper', source: 'choice' } },
        { effectType: 'set_flag', target: 'salvage_final_neutral', value: true }
      ],
      { presentation: { choiceText: 'Accept Warden escort', previewHint: 'Leave the conflict to the other factions.', consequenceLevel: 'major', isHidden: false, isDisabled: false } }
    )
  ],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: []
  }
}

const ending: NarrativeNode = {
  nodeId: 'quest_salvage_claim_ending',
  nodeType: 'ending',
  content: {
    contentType: 'inline',
    text: `The dust settles over the Stellaris Dawn. Whatever choices you made here will echo through the sector - the Syndicate never forgets a debt, and neither do the Ashfall. The survivors will remember who saved them... or who abandoned them.`
  },
  transitions: [],
  metadata: {
    isRevisitable: false,
    requiresFlags: [],
    setsFlags: ['quest_salvage_claim_completed']
  }
}

// ----------------------------------------------------------------------------
// Graph Export
// ----------------------------------------------------------------------------

export const questSalvageClaimGraph: NarrativeGraph = {
  graphId: 'quest_salvage_claim',
  version: '1.0.0',
  metadata: {
    title: 'The Salvage Claim',
    author: 'Space Fortress Team',
    totalNodeCount: 4,
    estimatedPlaythroughMinutes: 15,
    tags: ['ironveil', 'quest', 'refugees', 'moral-choice']
  },
  entryPoints: [
    {
      entryPointId: 'quest_salvage_claim_start',
      startingNodeId: 'dilemma_salvage_1_approach',
      description: 'Escort a Syndicate salvage team to a contested wreck.'
    }
  ],
  nodes: new Map([
    ['dilemma_salvage_1_approach', dilemma1_approach],
    ['dilemma_salvage_2_discovery', dilemma2_discovery],
    ['dilemma_salvage_3_confrontation', dilemma3_confrontation],
    ['quest_salvage_claim_ending', ending]
  ]),
  globalConditions: new Map()
}
