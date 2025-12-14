// ============================================================================
// SPACE FORTRESS - Quest Content
// ============================================================================

import type {
  Quest,
  Dilemma,
  Choice,
  Voice,
  ChoiceConsequences,
  FactionId
} from '../types'

// ============================================================================
// QUEST 1: THE SALVAGE CLAIM (Ironveil)
// A corporate escort mission turns complicated when you discover the "cargo"
// has a history - and survivors who remember it.
// ============================================================================

export const quest1: Quest = {
  id: 'quest_salvage_claim',
  faction: 'ironveil',
  title: 'The Salvage Claim',
  briefDescription: 'Escort a Syndicate salvage team to a contested wreck.',
  fullDescription: `The Ironveil Syndicate has filed a salvage claim on the wreck of the
Stellaris Dawn, a colony ship that went dark in the outer reaches three years ago.
They need an independent contractor to escort their team through contested space.
The Ashfall Remnants have been seen in the area - and some say they have their own
claims on the wreck.`,
  questGiverName: 'Director Chen',
  questGiverDialogue: `"The Stellaris Dawn carried mining equipment worth millions. Our
salvage teams have been driven off twice by raiders. I need someone who can handle
trouble - and who won't ask too many questions about what we find there."`,
  reputationRequired: -25,  // Available even slightly unfriendly with Ironveil
  initialBounty: 500,
  initialCards: ['ironveil_ironclad'],  // Heavy escort ship
  dilemmaIds: [
    'dilemma_salvage_1_approach',
    'dilemma_salvage_2_discovery',
    'dilemma_salvage_3_confrontation'
  ],
  warningText: 'This mission may damage your relationship with the Ashfall Remnants.'
}

// Quest 1 Dilemmas
export const quest1Dilemmas: Dilemma[] = [
  // DILEMMA 1: How to approach the wreck
  {
    id: 'dilemma_salvage_1_approach',
    questId: 'quest_salvage_claim',
    situation: `Your convoy approaches the coordinates of the Stellaris Dawn. Long-range
scans show the wreck is intact but dormant - and there are heat signatures nearby.
Someone else is here. Your sensors identify at least three small vessels running
silent near the debris field.`,
    voices: [
      {
        npcName: 'Director Chen',
        faction: 'ironveil',
        dialogue: `"Scavengers. Drive them off - we have legal salvage rights here.
Make it clear this wreck belongs to the Syndicate."`,
        position: 'Aggressive approach'
      },
      {
        npcName: 'First Mate Torres',
        faction: 'crew',
        dialogue: `"Three ships, running silent... they're either scared or setting up
an ambush. We could try hailing them first - might avoid a fight."`,
        position: 'Cautious approach'
      },
      {
        npcName: 'Chief Engineer Kai',
        faction: 'crew',
        dialogue: `"I'm reading something strange from those ships. The power signatures
are wrong for scavengers. Those are refugee vessels - probably Ashfall."`,
        position: 'Concerned observation'
      }
    ],
    choices: [
      {
        id: 'choice_attack_immediately',
        label: 'Attack immediately',
        description: 'Assert Syndicate authority with force.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: 10 },
            { faction: 'ashfall', delta: -15 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersBattle: {
            opponentType: 'scavengers',
            context: 'Defending the salvage claim',
            difficulty: 'easy'
          },
          nextDilemmaId: 'dilemma_salvage_2_discovery',
          flags: { 'salvage_attacked_first': true }
        }
      },
      {
        id: 'choice_hail_first',
        label: 'Hail the vessels',
        description: 'Try to communicate before shooting.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 5 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_salvage_2_discovery',
          flags: { 'salvage_hailed_first': true }
        }
      },
      {
        id: 'choice_wait_observe',
        label: 'Wait and observe',
        description: 'Hold position and gather more intelligence.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: -5 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_salvage_2_discovery',
          flags: { 'salvage_waited': true }
        }
      }
    ]
  },

  // DILEMMA 2: Discovery aboard the wreck
  {
    id: 'dilemma_salvage_2_discovery',
    questId: 'quest_salvage_claim',
    situation: `The salvage team boards the Stellaris Dawn while your ships secure the
perimeter. Thirty minutes in, they report a discovery: the ship's cargo hold
contains cryopods. Occupied cryopods. Forty-seven colonists in suspended
animation - alive, but their pods are failing. The Syndicate's salvage rights
don't mention any survivors.`,
    voices: [
      {
        npcName: 'Director Chen',
        faction: 'ironveil',
        dialogue: `"This changes nothing. Our claim covers the entire vessel and its
contents. Those colonists are now Syndicate property until their families
pay the salvage fees. Standard procedure."`,
        position: 'Corporate pragmatism'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        faction: 'ashfall',
        dialogue: `"Those are OUR people! The Stellaris Dawn was a refugee ship that
disappeared during the Collapse. The Syndicate CAUSED that disaster - now
they want to profit from the survivors?"`,
        position: 'Furious accusation'
      },
      {
        npcName: 'First Mate Torres',
        faction: 'crew',
        dialogue: `"Captain... those pods are failing. Whatever we decide, we need to
decide fast. Maybe there's a way to satisfy everyone here."`,
        position: 'Urgent mediation'
      }
    ],
    choices: [
      {
        id: 'choice_syndicate_claim',
        label: 'Honor the Syndicate claim',
        description: 'The survivors belong to Ironveil by salvage law.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: 15 },
            { faction: 'ashfall', delta: -20 },
            { faction: 'void_wardens', delta: -5 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: 200,
          nextDilemmaId: 'dilemma_salvage_3_confrontation',
          flags: { 'salvage_sided_ironveil': true }
        }
      },
      {
        id: 'choice_release_survivors',
        label: 'Release the survivors',
        description: 'Let the Ashfall take their people.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: -20 },
            { faction: 'ashfall', delta: 20 },
            { faction: 'void_wardens', delta: 5 }
          ],
          cardsGained: ['ashfall_ember'],
          cardsLost: [],
          bountyModifier: -200,
          nextDilemmaId: 'dilemma_salvage_3_confrontation',
          flags: { 'salvage_sided_ashfall': true }
        }
      },
      {
        id: 'choice_negotiate_split',
        label: 'Propose a split',
        description: 'Survivors to Ashfall, cargo to Syndicate.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: -5 },
            { faction: 'ashfall', delta: 5 },
            { faction: 'meridian', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersAlliance: true,
          flags: { 'salvage_negotiated': true }
        }
      }
    ]
  },

  // DILEMMA 3: Final confrontation
  {
    id: 'dilemma_salvage_3_confrontation',
    questId: 'quest_salvage_claim',
    situation: `Your decision has consequences. More ships are arriving - called by
whoever didn't get what they wanted. The situation is deteriorating into
a standoff. Someone is going to shoot first, and when they do, you'll be
right in the middle of it.`,
    voices: [
      {
        npcName: 'Kira Voss',
        faction: 'ironveil',
        dialogue: `"The Syndicate appreciates loyalty. Stand with us now and there
will be more contracts - better contracts. Walk away and we'll remember
that too."`,
        position: 'Offer of alliance'
      },
      {
        npcName: 'Elder Nomi',
        faction: 'ashfall',
        dialogue: `"I was aboard the Stellaris Dawn when it launched. My daughter is
in one of those pods. Please... don't let them take her again."`,
        position: 'Emotional appeal'
      },
      {
        npcName: 'Captain Thresh',
        faction: 'void_wardens',
        dialogue: `"This is Void Warden space. Both factions are violating the neutral
zone protocols. I can offer escort out of the area - but only to those who
stand down first."`,
        position: 'Third option'
      }
    ],
    choices: [
      {
        id: 'choice_fight_for_ironveil',
        label: 'Fight alongside Ironveil',
        description: 'Honor your contract to the end.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: 15 },
            { faction: 'ashfall', delta: -25 },
            { faction: 'void_wardens', delta: -10 }
          ],
          cardsGained: ['ironveil_creditor'],
          cardsLost: [],
          bountyModifier: 300,
          triggersBattle: {
            opponentType: 'ashfall_raiders',
            context: 'Defending the Syndicate claim',
            difficulty: 'medium'
          },
          flags: { 'salvage_final_ironveil': true }
        }
      },
      {
        id: 'choice_switch_to_ashfall',
        label: 'Switch sides to Ashfall',
        description: 'Break your contract for the refugees.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: -30 },
            { faction: 'ashfall', delta: 25 },
            { faction: 'sundered_oath', delta: 5 }
          ],
          cardsGained: ['ashfall_phoenix'],
          cardsLost: ['ironveil_ironclad'],
          bountyModifier: -100,
          triggersBattle: {
            opponentType: 'ironveil_enforcers',
            context: 'Defending the refugees',
            difficulty: 'medium'
          },
          flags: { 'salvage_final_ashfall': true, 'broke_ironveil_contract': true }
        }
      },
      {
        id: 'choice_accept_warden_escort',
        label: 'Accept Warden escort',
        description: 'Leave the conflict to the other factions.',
        consequences: {
          reputationChanges: [
            { faction: 'ironveil', delta: -10 },
            { faction: 'ashfall', delta: -5 },
            { faction: 'void_wardens', delta: 15 }
          ],
          cardsGained: ['void_beacon_keeper'],
          cardsLost: [],
          bountyModifier: -150,
          flags: { 'salvage_final_neutral': true }
        }
      }
    ]
  }
]

// ============================================================================
// QUEST 2: THE SANCTUARY RUN (Ashfall)
// Help refugees escape through a Void Warden blockade. Not everyone agrees
// they should be allowed through.
// ============================================================================

export const quest2: Quest = {
  id: 'quest_sanctuary_run',
  faction: 'ashfall',
  title: 'The Sanctuary Run',
  briefDescription: 'Guide refugee ships through a military blockade.',
  fullDescription: `A convoy of refugee vessels is stranded at the edge of Void Warden
territory. They're running out of supplies and the Wardens won't let them through
without proper documentation - documentation that was destroyed when their stations
fell. The Ashfall need someone who can find a way through, around, or over the
blockade before the refugees starve.`,
  questGiverName: 'Jax "Redhawk" Mora',
  questGiverDialogue: `"Three hundred souls on those ships, waiting to die while the
Wardens quote regulations at them. I've got a route through their patrol patterns,
but I need someone with a clean record to fly point. The Wardens won't fire on
an unknown - they'll hail first. That's our window."`,
  reputationRequired: -25,
  initialBounty: 400,
  initialCards: ['ashfall_redhawk'],
  dilemmaIds: [
    'dilemma_sanctuary_1_approach',
    'dilemma_sanctuary_2_blockade',
    'dilemma_sanctuary_3_destination'
  ],
  warningText: 'Running the blockade will anger the Void Wardens.'
}

export const quest2Dilemmas: Dilemma[] = [
  // DILEMMA 1: Planning the approach
  {
    id: 'dilemma_sanctuary_1_approach',
    questId: 'quest_sanctuary_run',
    situation: `You rendezvous with the refugee convoy at the edge of the restricted zone.
The ships are in poor condition - patched together, running on fumes. Redhawk's
route through the Warden patrols is risky but possible. However, your sensors
have picked up something else: a Meridian trade convoy is passing nearby.
They have legitimate transit codes.`,
    voices: [
      {
        npcName: 'Jax "Redhawk" Mora',
        faction: 'ashfall',
        dialogue: `"Stick to the plan. My route works - we've done it before. The
Wardens are predictable. We slip through during their patrol gap and we're
clear before they know we were there."`,
        position: 'Original plan'
      },
      {
        npcName: 'First Mate Torres',
        faction: 'crew',
        dialogue: `"That Meridian convoy... if we could convince them to add our ships
to their manifest, we'd have legitimate passage. It's a long shot, but it
would avoid any confrontation."`,
        position: 'Diplomatic alternative'
      },
      {
        npcName: 'Soren Vale',
        faction: 'meridian',
        dialogue: `"[Over comms] I noticed your interesting formation out there. Looking
to cross the line? I might be able to help - for the right price. Information
is my trade, after all."`,
        position: 'Mercenary offer'
      }
    ],
    choices: [
      {
        id: 'choice_use_redhawk_route',
        label: 'Use Redhawk\'s route',
        description: 'Trust the Ashfall expert.',
        consequences: {
          reputationChanges: [
            { faction: 'ashfall', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_sanctuary_2_blockade',
          flags: { 'sanctuary_stealth_route': true }
        }
      },
      {
        id: 'choice_negotiate_meridian',
        label: 'Negotiate with Meridian',
        description: 'Try for legitimate passage.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 10 },
            { faction: 'ashfall', delta: -5 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: -100,  // Broker's fee
          nextDilemmaId: 'dilemma_sanctuary_2_blockade',
          flags: { 'sanctuary_diplomatic_route': true }
        }
      },
      {
        id: 'choice_direct_approach',
        label: 'Approach directly',
        description: 'Request passage from the Wardens openly.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 5 },
            { faction: 'ashfall', delta: -10 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersMediation: true,
          flags: { 'sanctuary_direct_route': true }
        }
      }
    ]
  },

  // DILEMMA 2: At the blockade
  {
    id: 'dilemma_sanctuary_2_blockade',
    questId: 'quest_sanctuary_run',
    situation: `You've reached the blockade. Three Warden patrol ships hold the passage,
their weapons armed but not targeting. A voice crackles over the comm - it's
Captain Thresh, demanding identification. How you proceed now will determine
whether this ends peacefully or in fire.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        faction: 'void_wardens',
        dialogue: `"Unknown vessels, you are entering a restricted corridor. Transmit
identification codes and cargo manifests immediately. Non-compliance will
be treated as hostile intent."`,
        position: 'Official warning'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        faction: 'ashfall',
        dialogue: `"Now or never, Captain. Gun the engines and we can slip past before
they get targeting solutions. These refugees can't survive another week out
here - we have to try."`,
        position: 'Urging action'
      },
      {
        npcName: 'Elder Nomi',
        faction: 'ashfall',
        dialogue: `"I... I recognize that voice. Thresh and I served together, decades
ago. Before the Collapse. Let me speak to him. Perhaps old bonds mean
something still."`,
        position: 'Personal connection'
      }
    ],
    choices: [
      {
        id: 'choice_run_blockade',
        label: 'Run the blockade',
        description: 'Full speed ahead - trust in Ashfall pilots.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: -20 },
            { faction: 'ashfall', delta: 15 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersBattle: {
            opponentType: 'void_warden_patrol',
            context: 'Running the Warden blockade',
            difficulty: 'medium'
          },
          nextDilemmaId: 'dilemma_sanctuary_3_destination',
          flags: { 'sanctuary_ran_blockade': true }
        }
      },
      {
        id: 'choice_let_nomi_speak',
        label: 'Let Elder Nomi speak',
        description: 'Trust in the old connection.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 10 },
            { faction: 'ashfall', delta: 5 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_sanctuary_3_destination',
          flags: { 'sanctuary_nomi_negotiated': true }
        }
      },
      {
        id: 'choice_offer_cargo',
        label: 'Offer cargo as passage fee',
        description: 'Bribe the Wardens with refugee supplies.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 5 },
            { faction: 'ashfall', delta: -15 },
            { faction: 'sundered_oath', delta: 5 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: -150,
          nextDilemmaId: 'dilemma_sanctuary_3_destination',
          flags: { 'sanctuary_bribed_wardens': true }
        }
      }
    ]
  },

  // DILEMMA 3: At the destination
  {
    id: 'dilemma_sanctuary_3_destination',
    questId: 'quest_sanctuary_run',
    situation: `The convoy reaches Sanctuary Station, a neutral port in unclaimed space.
But there's a problem: the station is already overcrowded, and the administrator
is demanding payment for docking rights. The refugees have nothing left.
Without docking, they're dead in the void.`,
    voices: [
      {
        npcName: 'Station Administrator',
        faction: 'meridian',
        dialogue: `"Look, I sympathize, but I've got a station to run. Every berth they
take is a berth I can't sell to paying customers. Someone has to cover the
cost - 500 credits per ship, non-negotiable."`,
        position: 'Business reality'
      },
      {
        npcName: 'Jax "Redhawk" Mora',
        faction: 'ashfall',
        dialogue: `"The Ashfall don't forget who helps us. Pay their docking fees from
the mission bounty and we'll make it up to you tenfold. Or we could always...
convince the administrator to reconsider."`,
        position: 'Loyalty or threats'
      },
      {
        npcName: 'Ghost',
        faction: 'sundered_oath',
        dialogue: `"[Appearing from nowhere] Interesting situation. I happen to know the
administrator has... flexible ethics. For a small fee, I could provide
evidence of certain irregularities that might change their math."`,
        position: 'Blackmail option'
      }
    ],
    choices: [
      {
        id: 'choice_pay_from_bounty',
        label: 'Pay from your bounty',
        description: 'Cover the refugee docking fees yourself.',
        consequences: {
          reputationChanges: [
            { faction: 'ashfall', delta: 20 },
            { faction: 'meridian', delta: 5 }
          ],
          cardsGained: ['ashfall_desperado'],
          cardsLost: [],
          bountyModifier: -300,
          flags: { 'sanctuary_paid_fees': true }
        }
      },
      {
        id: 'choice_threaten_administrator',
        label: 'Threaten the administrator',
        description: 'Make it clear refusal has consequences.',
        consequences: {
          reputationChanges: [
            { faction: 'ashfall', delta: 10 },
            { faction: 'meridian', delta: -15 },
            { faction: 'sundered_oath', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          risk: {
            description: 'Station security may intervene',
            probability: 0.3,
            consequence: 'Forced to flee the station'
          },
          flags: { 'sanctuary_threatened': true }
        }
      },
      {
        id: 'choice_use_blackmail',
        label: 'Use Ghost\'s information',
        description: 'Blackmail the administrator into compliance.',
        consequences: {
          reputationChanges: [
            { faction: 'ashfall', delta: 5 },
            { faction: 'meridian', delta: -10 },
            { faction: 'sundered_oath', delta: 15 }
          ],
          cardsGained: ['sundered_ghost_ship'],
          cardsLost: [],
          bountyModifier: -50,  // Ghost's fee
          flags: { 'sanctuary_blackmailed': true, 'owes_ghost_favor': true }
        }
      },
      {
        id: 'choice_leave_refugees',
        label: 'Leave the refugees here',
        description: 'Your job was escort, not charity.',
        consequences: {
          reputationChanges: [
            { faction: 'ashfall', delta: -25 },
            { faction: 'ironveil', delta: 10 },
            { faction: 'sundered_oath', delta: 5 }
          ],
          cardsGained: [],
          cardsLost: ['ashfall_redhawk'],
          bountyModifier: 0,
          flags: { 'sanctuary_abandoned_refugees': true }
        }
      }
    ]
  }
]

// ============================================================================
// QUEST 3: THE BROKER'S GAMBIT (Meridian)
// A complex mediation contract where everyone has secrets, and loyalty is
// for sale to the highest bidder.
// ============================================================================

export const quest3: Quest = {
  id: 'quest_brokers_gambit',
  faction: 'meridian',
  title: 'The Broker\'s Gambit',
  briefDescription: 'Mediate a territorial dispute with hidden agendas.',
  fullDescription: `The Void Wardens and Sundered Oath are on the brink of open war over
salvage rights in the Graveyard - a debris field from an ancient battle. The
Meridian Accord needs an outsider to mediate, someone without known allegiances.
But Soren Vale has warned you: both sides are hiding something, and the truth
might be worth more than peace.`,
  questGiverName: 'Soren Vale',
  questGiverDialogue: `"Both factions have requested neutral mediation. The Wardens want
to enforce the old treaties. The Sundered want... well, that's the question,
isn't it? Your job is to find a compromise. But keep your eyes open - information
that surfaces during negotiation can be quite valuable to the right buyer."`,
  reputationRequired: 0,  // Meridian quests require true neutrality
  initialBounty: 600,
  initialCards: ['meridian_arbiter'],
  dilemmaIds: [
    'dilemma_broker_1_opening',
    'dilemma_broker_2_revelation',
    'dilemma_broker_3_choice',
    'dilemma_broker_4_resolution'
  ],
  warningText: 'This quest involves deception. Your choices may have unexpected consequences.'
}

export const quest3Dilemmas: Dilemma[] = [
  // DILEMMA 1: Opening negotiations
  {
    id: 'dilemma_broker_1_opening',
    questId: 'quest_brokers_gambit',
    situation: `The negotiation takes place aboard a neutral station in the contested zone.
Captain Thresh represents the Void Wardens; Razor speaks for the Sundered Oath.
Before the official talks begin, both approach you privately with offers.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        faction: 'void_wardens',
        dialogue: `"Mediator, a word in private. The Sundered are not negotiating in good
faith. They're after something specific in that debris field - something
dangerous. Lean our way in the talks, and I'll share what we know."`,
        position: 'Secret alliance offer'
      },
      {
        npcName: 'Razor',
        faction: 'sundered_oath',
        dialogue: `"The Wardens talk about honor, but they're sitting on a fortune in
salvage. Help me get access to the field, and I'll cut you in. Twenty
percent of everything we find."`,
        position: 'Bribery attempt'
      },
      {
        npcName: 'Soren Vale',
        faction: 'meridian',
        dialogue: `"[Via private channel] Interesting offers, aren't they? The Accord
takes no official position, but... whoever's secret proves more valuable
might find the Accord remembers such things."`,
        position: 'Encouraging duplicity'
      }
    ],
    choices: [
      {
        id: 'choice_accept_warden_offer',
        label: 'Accept Thresh\'s offer',
        description: 'Form a secret alliance with the Wardens.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_broker_2_revelation',
          flags: { 'broker_allied_wardens': true, 'secret_alliance_active': true }
        }
      },
      {
        id: 'choice_accept_razor_offer',
        label: 'Accept Razor\'s offer',
        description: 'Form a secret alliance with the Sundered.',
        consequences: {
          reputationChanges: [
            { faction: 'sundered_oath', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: 200,  // Cut of salvage
          nextDilemmaId: 'dilemma_broker_2_revelation',
          flags: { 'broker_allied_sundered': true, 'secret_alliance_active': true }
        }
      },
      {
        id: 'choice_remain_neutral',
        label: 'Remain strictly neutral',
        description: 'Refuse both offers.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 15 },
            { faction: 'void_wardens', delta: -5 },
            { faction: 'sundered_oath', delta: -5 }
          ],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_broker_2_revelation',
          flags: { 'broker_stayed_neutral': true }
        }
      },
      {
        id: 'choice_play_both_sides',
        label: 'Accept both offers secretly',
        description: 'Promise loyalty to each side.',
        consequences: {
          reputationChanges: [
            { faction: 'sundered_oath', delta: 5 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: 200,
          nextDilemmaId: 'dilemma_broker_2_revelation',
          flags: {
            'broker_allied_wardens': true,
            'broker_allied_sundered': true,
            'double_agent': true
          },
          risk: {
            description: 'High risk of exposure',
            probability: 0.5,
            consequence: 'Both factions become hostile'
          }
        }
      }
    ]
  },

  // DILEMMA 2: The revelation
  {
    id: 'dilemma_broker_2_revelation',
    questId: 'quest_brokers_gambit',
    situation: `The negotiations have stalled. In a break, you access the station's archives
and discover the truth: the Graveyard isn't just ancient debris. It contains
the wreck of the Oathkeeper - the ship that carried the founders of BOTH the
Void Wardens AND the Sundered Oath. They were once the same faction, split by
a betrayal no one alive remembers clearly.`,
    voices: [
      {
        npcName: 'ARIA',
        faction: 'other',
        dialogue: `"Records indicate the Oathkeeper carried pre-Collapse technology.
Both factions seek it - the Wardens to destroy it, the Sundered to sell
it. Neither admits this is the true prize."`,
        position: 'Information dump'
      },
      {
        npcName: 'Keeper Ash',
        faction: 'void_wardens',
        dialogue: `"You've found the truth. The technology aboard that ship could restart
the wars that nearly destroyed humanity. It must be contained. Help us,
and we will remember."`,
        position: 'Appeal to duty'
      },
      {
        npcName: 'Ghost',
        faction: 'sundered_oath',
        dialogue: `"Pre-Collapse tech? That's worth more than this entire station. The
Wardens want to bury it because they're afraid. Fear is weakness. Strength
is taking what you can sell."`,
        position: 'Appeal to greed'
      }
    ],
    choices: [
      {
        id: 'choice_support_wardens',
        label: 'Support Warden containment',
        description: 'Help destroy the dangerous technology.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 20 },
            { faction: 'sundered_oath', delta: -20 },
            { faction: 'meridian', delta: -10 }
          ],
          cardsGained: ['void_warden_prime'],
          cardsLost: [],
          nextDilemmaId: 'dilemma_broker_3_choice',
          flags: { 'broker_chose_containment': true }
        }
      },
      {
        id: 'choice_support_sundered',
        label: 'Help the Sundered retrieve it',
        description: 'Profit from dangerous technology.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: -25 },
            { faction: 'sundered_oath', delta: 20 },
            { faction: 'ironveil', delta: 5 }
          ],
          cardsGained: ['sundered_oathbreaker'],
          cardsLost: [],
          bountyModifier: 400,
          nextDilemmaId: 'dilemma_broker_3_choice',
          flags: { 'broker_chose_profit': true }
        }
      },
      {
        id: 'choice_reveal_truth',
        label: 'Reveal everything publicly',
        description: 'Let both factions know the full truth.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 20 },
            { faction: 'void_wardens', delta: -10 },
            { faction: 'sundered_oath', delta: -10 }
          ],
          cardsGained: ['meridian_broker'],
          cardsLost: [],
          nextDilemmaId: 'dilemma_broker_3_choice',
          flags: { 'broker_revealed_truth': true }
        }
      },
      {
        id: 'choice_sell_information',
        label: 'Sell the information',
        description: 'This knowledge is worth credits.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 5 },
            { faction: 'sundered_oath', delta: 10 }
          ],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: 300,
          nextDilemmaId: 'dilemma_broker_3_choice',
          flags: { 'broker_sold_secrets': true }
        }
      }
    ]
  },

  // DILEMMA 3: The critical choice
  {
    id: 'dilemma_broker_3_choice',
    questId: 'quest_brokers_gambit',
    situation: `The situation has exploded. Both factions now know about the Oathkeeper's
true cargo. Ships are mobilizing. If you don't act now, this will become a
battle that could spread far beyond the Graveyard. You have one chance to
shape how this ends.`,
    voices: [
      {
        npcName: 'Captain Thresh',
        faction: 'void_wardens',
        dialogue: `"The Sundered will not negotiate - they never do. Stand with us and
we end this threat. The old codes demand it. Will you honor them?"`,
        position: 'Military alliance'
      },
      {
        npcName: 'Razor',
        faction: 'sundered_oath',
        dialogue: `"The Wardens are fossils clinging to dead traditions. Help me secure
that technology and we'll have the power to write our own future. No more
running. No more hiding."`,
        position: 'Revolutionary alliance'
      },
      {
        npcName: 'Magistrate Yun',
        faction: 'meridian',
        dialogue: `"There may yet be a way to satisfy everyone. The technology could be
studied jointly, under Accord supervision. A compromise that serves all...
though perhaps satisfies none."`,
        position: 'Diplomatic solution'
      }
    ],
    choices: [
      {
        id: 'choice_fight_with_wardens',
        label: 'Fight alongside the Wardens',
        description: 'Contain the threat by force.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 25 },
            { faction: 'sundered_oath', delta: -30 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersBattle: {
            opponentType: 'sundered_raiders',
            context: 'Battle for the Oathkeeper',
            difficulty: 'hard'
          },
          nextDilemmaId: 'dilemma_broker_4_resolution',
          flags: { 'broker_battle_wardens': true }
        }
      },
      {
        id: 'choice_fight_with_sundered',
        label: 'Fight alongside the Sundered',
        description: 'Seize the future by force.',
        consequences: {
          reputationChanges: [
            { faction: 'sundered_oath', delta: 25 },
            { faction: 'void_wardens', delta: -30 }
          ],
          cardsGained: [],
          cardsLost: [],
          triggersBattle: {
            opponentType: 'void_warden_fleet',
            context: 'Battle for the Oathkeeper',
            difficulty: 'hard'
          },
          nextDilemmaId: 'dilemma_broker_4_resolution',
          flags: { 'broker_battle_sundered': true }
        }
      },
      {
        id: 'choice_broker_compromise',
        label: 'Push for compromise',
        description: 'Force both sides to the table.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: 30 },
            { faction: 'void_wardens', delta: -5 },
            { faction: 'sundered_oath', delta: -5 }
          ],
          cardsGained: ['meridian_negotiator'],
          cardsLost: [],
          nextDilemmaId: 'dilemma_broker_4_resolution',
          flags: { 'broker_forced_compromise': true }
        }
      }
    ]
  },

  // DILEMMA 4: Resolution
  {
    id: 'dilemma_broker_4_resolution',
    questId: 'quest_brokers_gambit',
    situation: `The dust settles. The Oathkeeper's fate has been decided - by battle or
negotiation. Now comes the question of what to do with the aftermath. Both
factions are wounded, and the balance of power in the sector has shifted.
Where do you stand when the credits are counted?`,
    voices: [
      {
        npcName: 'Soren Vale',
        faction: 'meridian',
        dialogue: `"Well played, Captain. Whatever happens, the Accord will remember
this day. The question is: how do you want to be remembered? As a
peacemaker... or an opportunist?"`,
        position: 'Final reflection'
      },
      {
        npcName: 'First Mate Torres',
        faction: 'crew',
        dialogue: `"We've made enemies today, Captain. And maybe friends. But we're
still flying, and that's what matters. Let's collect our pay and get
out before someone changes their mind."`,
        position: 'Pragmatic advice'
      },
      {
        npcName: 'ARIA',
        faction: 'other',
        dialogue: `"Historical note: the Oathkeeper's crew believed their mission would
bring lasting peace. They were wrong. Perhaps you will be different.
Perhaps not. Recording complete."`,
        position: 'Ominous conclusion'
      }
    ],
    choices: [
      {
        id: 'choice_take_payment_leave',
        label: 'Take your payment and leave',
        description: 'The job is done. Time to move on.',
        consequences: {
          reputationChanges: [],
          cardsGained: [],
          cardsLost: [],
          bountyModifier: 200,
          flags: { 'broker_clean_exit': true }
        }
      },
      {
        id: 'choice_pledge_to_winner',
        label: 'Pledge allegiance to the victor',
        description: 'Throw in your lot with whoever came out on top.',
        consequences: {
          reputationChanges: [
            { faction: 'void_wardens', delta: 15 },
            { faction: 'sundered_oath', delta: 15 }
          ],
          cardsGained: [],
          cardsLost: [],
          flags: { 'broker_joined_victor': true }
        }
      },
      {
        id: 'choice_disappear',
        label: 'Disappear into the black',
        description: 'Too many people know your face now.',
        consequences: {
          reputationChanges: [
            { faction: 'meridian', delta: -10 },
            { faction: 'sundered_oath', delta: 5 }
          ],
          cardsGained: ['sundered_exile'],
          cardsLost: [],
          bountyModifier: -100,  // Cost of running
          flags: { 'broker_disappeared': true }
        }
      }
    ]
  }
]

// ============================================================================
// Combined Quest Data
// ============================================================================

export const allQuests: Quest[] = [quest1, quest2, quest3]

export const allDilemmas: Dilemma[] = [
  ...quest1Dilemmas,
  ...quest2Dilemmas,
  ...quest3Dilemmas
]

// ============================================================================
// Quest Lookup Helpers
// ============================================================================

/**
 * Get a quest by ID
 */
export function getQuestById(questId: string): Quest | undefined {
  return allQuests.find(q => q.id === questId)
}

/**
 * Get a dilemma by ID
 */
export function getDilemmaById(dilemmaId: string): Dilemma | undefined {
  return allDilemmas.find(d => d.id === dilemmaId)
}

/**
 * Get all dilemmas for a quest
 */
export function getQuestDilemmas(questId: string): Dilemma[] {
  return allDilemmas.filter(d => d.questId === questId)
}

/**
 * Get the first dilemma of a quest
 */
export function getQuestFirstDilemma(questId: string): Dilemma | undefined {
  const quest = getQuestById(questId)
  if (!quest || quest.dilemmaIds.length === 0) return undefined
  return getDilemmaById(quest.dilemmaIds[0])
}

/**
 * Get the next dilemma in a quest sequence
 */
export function getNextDilemma(questId: string, currentDilemmaId: string): Dilemma | undefined {
  const quest = getQuestById(questId)
  if (!quest) return undefined

  const currentIndex = quest.dilemmaIds.indexOf(currentDilemmaId)
  if (currentIndex === -1 || currentIndex >= quest.dilemmaIds.length - 1) return undefined

  return getDilemmaById(quest.dilemmaIds[currentIndex + 1])
}

/**
 * Get quests available to a player based on reputation
 */
export function getAvailableQuests(
  reputation: Record<FactionId, number>,
  completedQuestIds: string[]
): Quest[] {
  return allQuests.filter(quest => {
    // Not already completed
    if (completedQuestIds.includes(quest.id)) return false
    // Meets reputation requirement
    return reputation[quest.faction] >= quest.reputationRequired
  })
}

/**
 * Get quests that are locked due to reputation
 */
export function getLockedQuests(
  reputation: Record<FactionId, number>,
  completedQuestIds: string[]
): { quest: Quest; reason: string }[] {
  return allQuests
    .filter(quest => !completedQuestIds.includes(quest.id))
    .filter(quest => reputation[quest.faction] < quest.reputationRequired)
    .map(quest => ({
      quest,
      reason: `Requires ${quest.reputationRequired >= 0 ? '+' : ''}${quest.reputationRequired} reputation with ${quest.faction}`
    }))
}
