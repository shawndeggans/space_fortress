// ============================================================================
// SPACE FORTRESS - Ending Evaluations
// ============================================================================

import type {
  EndingType,
  EndingEvaluation,
  FactionId,
  GameStats,
  ChoicePatterns,
  BattleRecord,
  GameFlags
} from '../types'
import { factions } from './factions'

// ----------------------------------------------------------------------------
// Ending Templates
// ----------------------------------------------------------------------------

interface EndingTemplate {
  type: EndingType
  title: string
  subtitle: string
  summaryTemplate: string
  requirements: (data: EndingData) => boolean
  priority: number  // Higher priority = checked first
}

interface EndingData {
  reputation: Record<FactionId, number>
  stats: GameStats
  flags: GameFlags
  fleetComposition: Record<FactionId, number>
}

const endingTemplates: EndingTemplate[] = [
  // Faction Commander - Devoted to one faction
  {
    type: 'faction_commander',
    title: 'Faction Commander',
    subtitle: 'A Loyal Blade',
    summaryTemplate: `Your unwavering loyalty to the {faction} has earned you a place among
their inner circle. Where others saw compromise, you saw conviction. The {faction_name}
will remember your service - and so will their enemies. Your fleet bears their colors,
your reputation precedes you, and in the halls of power, your voice carries weight.
Whether this was wisdom or folly, only time will tell.`,
    requirements: (data) => {
      // Must have 75+ reputation with at least one faction
      return Object.values(data.reputation).some(rep => rep >= 75)
    },
    priority: 100
  },

  // The Broker - Maintained balance, worked with everyone
  {
    type: 'broker',
    title: 'The Broker',
    subtitle: 'Everyone\'s Friend, No One\'s Ally',
    summaryTemplate: `You played all sides and came out ahead. The factions eye you with
a mixture of respect and suspicion - you're useful, but unpredictable. Your fleet is
a patchwork of different allegiances, each ship a reminder of deals struck and favors
owed. In the game of faction politics, you've become a piece that moves itself. Some
call that dangerous. You call it freedom.`,
    requirements: (data) => {
      // All factions between -25 and +50 (truly neutral)
      const reps = Object.values(data.reputation)
      return reps.every(rep => rep >= -25 && rep <= 50) &&
             reps.filter(rep => rep >= 0).length >= 4
    },
    priority: 90
  },

  // The Opportunist - High betrayal count, shifted allegiances
  {
    type: 'opportunist',
    title: 'The Opportunist',
    subtitle: 'Loyalty Is Just Another Word',
    summaryTemplate: `Contracts are made to be broken - at least, that's what you've proven.
Your path is littered with abandoned allies and broken promises, but your hold is full
and your ship is fast. The factions have learned not to trust you, but they still need
you. After all, someone who can be bought is predictable. Someone who changes sides
knows secrets from both. You've made yourself valuable by being dangerous.`,
    requirements: (data) => {
      return data.stats.betrayals >= 2 ||
             (data.flags['broke_ironveil_contract'] && data.flags['double_agent'])
    },
    priority: 85
  },

  // The Conqueror - Won most battles, aggressive choices
  {
    type: 'conqueror',
    title: 'The Conqueror',
    subtitle: 'Victory Through Superior Firepower',
    summaryTemplate: `Your guns spoke louder than any diplomat. When negotiations failed -
and they always did - you had the fleet to back up your words. {battles_won} battles
won, {enemies_defeated} enemies defeated. Your reputation is written in debris fields
and salvage claims. The weak fear you. The strong respect you. And somewhere in the
black, there are those who swear revenge. Let them come. Your fleet is ready.`,
    requirements: (data) => {
      return data.stats.battlesWon >= 4 &&
             data.stats.battlesWon > data.stats.battlesLost * 2
    },
    priority: 80
  },

  // The Negotiator - Avoided battles, diplomatic solutions
  {
    type: 'negotiator',
    title: 'The Negotiator',
    subtitle: 'Words Sharper Than Blades',
    summaryTemplate: `While others reached for weapons, you reached for words. {avoided}
conflicts resolved without bloodshed. Your reputation as a dealmaker has spread far
beyond these sectors. The Meridian Accord watches you with interest; the warlike
factions with confusion. How do you win without fighting? They haven't figured it
out yet, and that's your greatest advantage.`,
    requirements: (data) => {
      return data.stats.battlesAvoided >= 2 ||
             (data.stats.battlesAvoided >= 1 && data.stats.alliancesFormed >= 2)
    },
    priority: 75
  }
]

// ----------------------------------------------------------------------------
// Default Ending (Fallback)
// ----------------------------------------------------------------------------

const defaultEnding: EndingTemplate = {
  type: 'broker',  // Default to broker if nothing else fits
  title: 'The Survivor',
  subtitle: 'Still Flying',
  summaryTemplate: `You made it through. Three quests, countless choices, and you're still
here. Your fleet is intact, your reputation is... complicated. You've made friends and
enemies in equal measure, and the galaxy will remember your passing. Whether that memory
is fond or bitter depends on who's doing the remembering. But you survived. In the black,
that's the only victory that matters.`,
  requirements: () => true,
  priority: 0
}

// ----------------------------------------------------------------------------
// Ending Generation
// ----------------------------------------------------------------------------

/**
 * Determine the ending based on player data
 */
export function determineEnding(
  reputation: Record<FactionId, number>,
  stats: GameStats,
  flags: GameFlags,
  ownedCardFactions: FactionId[]
): EndingEvaluation {
  // Calculate fleet composition
  const fleetComposition: Record<FactionId, number> = {
    ironveil: 0,
    ashfall: 0,
    meridian: 0,
    void_wardens: 0,
    sundered_oath: 0
  }
  for (const faction of ownedCardFactions) {
    fleetComposition[faction]++
  }

  const data: EndingData = {
    reputation,
    stats,
    flags,
    fleetComposition
  }

  // Find the highest priority matching ending
  const sortedTemplates = [...endingTemplates].sort((a, b) => b.priority - a.priority)
  const matchingTemplate = sortedTemplates.find(t => t.requirements(data)) || defaultEnding

  // Determine primary faction (highest reputation)
  let primaryFaction: FactionId | undefined
  let highestRep = -100
  for (const [faction, rep] of Object.entries(reputation)) {
    if (rep > highestRep) {
      highestRep = rep
      primaryFaction = faction as FactionId
    }
  }

  // Build choice patterns
  const choicePatterns: ChoicePatterns = {
    combatVsDiplomacy: calculateCombatVsDiplomacy(stats),
    loyaltyVsOpportunism: calculateLoyaltyVsOpportunism(stats, flags),
    betrayalCount: stats.betrayals,
    secretsKept: countFlags(flags, 'secret', true),
    secretsExposed: countFlags(flags, 'revealed', true)
  }

  // Build battle record
  const battleRecord: BattleRecord = {
    total: stats.battlesWon + stats.battlesLost + stats.battlesDraw,
    wins: stats.battlesWon,
    losses: stats.battlesLost,
    draws: stats.battlesDraw,
    avoided: stats.battlesAvoided
  }

  // Generate summary text
  const summary = generateSummary(matchingTemplate, data, primaryFaction)

  return {
    endingType: matchingTemplate.type,
    title: generateTitle(matchingTemplate, primaryFaction),
    subtitle: matchingTemplate.subtitle,
    summary,
    primaryFaction: highestRep >= 25 ? primaryFaction : undefined,
    fleetComposition,
    reputationFinal: reputation,
    choicePatterns,
    battleRecord
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function calculateCombatVsDiplomacy(stats: GameStats): number {
  const combatScore = stats.battlesWon + stats.battlesLost
  const diplomacyScore = stats.battlesAvoided + stats.alliancesFormed
  const total = combatScore + diplomacyScore
  if (total === 0) return 0
  return (combatScore - diplomacyScore) / total  // -1 to 1
}

function calculateLoyaltyVsOpportunism(stats: GameStats, flags: GameFlags): number {
  let loyalty = 0
  let opportunism = 0

  // Count loyal actions
  if (flags['salvage_sided_ironveil']) loyalty++
  if (flags['salvage_sided_ashfall']) loyalty++
  if (flags['sanctuary_paid_fees']) loyalty++
  if (flags['broker_stayed_neutral']) loyalty++

  // Count opportunistic actions
  opportunism += stats.betrayals
  if (flags['double_agent']) opportunism += 2
  if (flags['broker_sold_secrets']) opportunism++
  if (flags['sanctuary_blackmailed']) opportunism++

  const total = loyalty + opportunism
  if (total === 0) return 0
  return (loyalty - opportunism) / total  // -1 to 1
}

function countFlags(flags: GameFlags, contains: string, value: boolean): number {
  return Object.entries(flags)
    .filter(([key, val]) => key.includes(contains) && val === value)
    .length
}

function generateTitle(template: EndingTemplate, primaryFaction?: FactionId): string {
  if (template.type === 'faction_commander' && primaryFaction) {
    const faction = factions[primaryFaction]
    return `${faction.name} Commander`
  }
  return template.title
}

function generateSummary(
  template: EndingTemplate,
  data: EndingData,
  primaryFaction?: FactionId
): string {
  let summary = template.summaryTemplate

  // Replace faction placeholders
  if (primaryFaction) {
    const faction = factions[primaryFaction]
    summary = summary.replace(/{faction}/g, primaryFaction)
    summary = summary.replace(/{faction_name}/g, faction.name)
  }

  // Replace stat placeholders
  summary = summary.replace(/{battles_won}/g, data.stats.battlesWon.toString())
  summary = summary.replace(/{enemies_defeated}/g, (data.stats.battlesWon * 5).toString())
  summary = summary.replace(/{avoided}/g, data.stats.battlesAvoided.toString())

  return summary
}

// ----------------------------------------------------------------------------
// Ending Statistics Display
// ----------------------------------------------------------------------------

export interface EndingStatDisplay {
  label: string
  value: string | number
  highlight?: boolean
}

/**
 * Generate stats for display on ending screen
 */
export function getEndingStats(evaluation: EndingEvaluation): EndingStatDisplay[] {
  const stats: EndingStatDisplay[] = []

  // Battle record
  stats.push({
    label: 'Battles Won',
    value: evaluation.battleRecord.wins,
    highlight: evaluation.battleRecord.wins >= 3
  })
  stats.push({
    label: 'Battles Lost',
    value: evaluation.battleRecord.losses
  })
  stats.push({
    label: 'Conflicts Avoided',
    value: evaluation.battleRecord.avoided,
    highlight: evaluation.battleRecord.avoided >= 2
  })

  // Diplomacy
  if (evaluation.choicePatterns.betrayalCount > 0) {
    stats.push({
      label: 'Betrayals',
      value: evaluation.choicePatterns.betrayalCount,
      highlight: true
    })
  }

  // Secrets
  if (evaluation.choicePatterns.secretsKept > 0) {
    stats.push({
      label: 'Secrets Kept',
      value: evaluation.choicePatterns.secretsKept
    })
  }

  return stats
}

// ----------------------------------------------------------------------------
// Faction Standing Summary
// ----------------------------------------------------------------------------

export interface FactionStanding {
  factionId: FactionId
  name: string
  value: number
  status: string
  icon: string
}

/**
 * Get formatted faction standings for ending display
 */
export function getFactionStandings(reputation: Record<FactionId, number>): FactionStanding[] {
  return Object.entries(reputation).map(([factionId, value]) => {
    const faction = factions[factionId as FactionId]
    let status: string
    if (value >= 75) status = 'Devoted Ally'
    else if (value >= 50) status = 'Trusted Partner'
    else if (value >= 25) status = 'Friendly'
    else if (value >= 0) status = 'Neutral'
    else if (value >= -25) status = 'Cool'
    else if (value >= -50) status = 'Unfriendly'
    else if (value >= -75) status = 'Hostile'
    else status = 'Blood Enemy'

    return {
      factionId: factionId as FactionId,
      name: faction.name,
      value,
      status,
      icon: faction.icon
    }
  }).sort((a, b) => b.value - a.value)
}

// ----------------------------------------------------------------------------
// Ending Teaser Text (for pre-ending hints)
// ----------------------------------------------------------------------------

/**
 * Get teaser text about player's trajectory before final ending
 */
export function getEndingTeaser(
  reputation: Record<FactionId, number>,
  stats: GameStats
): string {
  const highestRep = Math.max(...Object.values(reputation))
  const lowestRep = Math.min(...Object.values(reputation))

  if (highestRep >= 60) {
    const faction = Object.entries(reputation).find(([, v]) => v === highestRep)?.[0]
    return `Your strong ties to the ${factions[faction as FactionId].name} are shaping your destiny...`
  }

  if (stats.battlesWon >= 3) {
    return 'Your combat prowess has not gone unnoticed. They call you a conqueror...'
  }

  if (stats.battlesAvoided >= 2) {
    return 'Your diplomatic skills have saved many lives. The negotiators watch with interest...'
  }

  if (stats.betrayals >= 1) {
    return 'Your shifting loyalties have earned you a reputation. Opportunist, some say...'
  }

  if (lowestRep <= -50) {
    const faction = Object.entries(reputation).find(([, v]) => v === lowestRep)?.[0]
    return `The ${factions[faction as FactionId].name} have not forgotten your choices...`
  }

  return 'Your story is still being written. How will it end?'
}
