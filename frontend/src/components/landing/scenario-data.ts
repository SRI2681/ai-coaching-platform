export interface CoachingScenario {
  id: string;
  label: string;
  headline: string;
  coachName: string;
  coachRole: string;
  coachInitials: string;
  accent: string;
  icon: string;
  prompt: string;
  badge?: string;
}

export const COACHING_SCENARIOS: CoachingScenario[] = [
  {
    id: 'board',
    label: 'Board narrative',
    headline: 'Defend your strategy under scrutiny',
    coachName: 'Alex Rivera',
    coachRole: 'Executive Coach',
    coachInitials: 'AR',
    accent: 'from-slate-700 to-slate-900',
    icon: '◆',
    prompt:
      'Walk me through your Q3 narrative. The board will challenge your assumptions — how do you frame the story with conviction?',
  },
  {
    id: 'feedback',
    label: 'Tough feedback',
    headline: 'Lead with clarity and empathy',
    coachName: 'Morgan Chen',
    coachRole: 'Leadership Advisor',
    coachInitials: 'MC',
    accent: 'from-teal-600 to-cyan-700',
    icon: '◎',
    prompt:
      'Your VP missed targets twice. Practice the conversation — direct, empathetic, and outcome-focused.',
  },
  {
    id: 'stakeholders',
    label: 'Cross-functional influence',
    headline: 'Build coalition without authority',
    coachName: 'Jordan Blake',
    coachRole: 'Strategy Coach',
    coachInitials: 'JB',
    accent: 'from-indigo-600 to-blue-800',
    icon: '⬡',
    prompt:
      'Engineering and Finance must align on your initiative. How do you persuade peers who don\'t report to you?',
  },
  {
    id: 'avatar',
    label: 'Executive presence',
    headline: 'Command the room on camera',
    coachName: 'Alex Rivera',
    coachRole: 'Avatar coaching',
    coachInitials: 'AR',
    accent: 'from-amber-500 to-orange-600',
    icon: '◇',
    prompt:
      'Practice your all-hands opening. Presence, pace, and conviction matter — camera on.',
    badge: 'Avatar',
  },
  {
    id: 'priorities',
    label: 'Strategic trade-offs',
    headline: 'Say no with executive judgment',
    coachName: 'Elena Vasquez',
    coachRole: 'C-Suite Advisor',
    coachInitials: 'EV',
    accent: 'from-violet-600 to-purple-800',
    icon: '△',
    prompt:
      'Five priorities, capacity for two. Defend your choices to a skeptical CEO without losing credibility.',
  },
];
