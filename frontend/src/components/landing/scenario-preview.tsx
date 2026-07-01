'use client';

import { useState } from 'react';

export interface CoachingScenario {
  id: string;
  label: string;
  coachName: string;
  coachRole: string;
  coachInitials: string;
  accent: string;
  prompt: string;
  badge?: string;
}

export const COACHING_SCENARIOS: CoachingScenario[] = [
  {
    id: 'board',
    label: 'Navigate a board presentation',
    coachName: 'Alex Rivera',
    coachRole: 'Executive Coach',
    coachInitials: 'AR',
    accent: 'from-indigo-500 to-violet-600',
    prompt:
      '"Walk me through your Q3 narrative. The board will challenge your assumptions — how do you frame the story?"',
  },
  {
    id: 'feedback',
    label: 'Deliver difficult feedback',
    coachName: 'Morgan Chen',
    coachRole: 'Leadership Advisor',
    coachInitials: 'MC',
    accent: 'from-violet-500 to-purple-600',
    prompt:
      '"Your VP of Sales missed targets twice. Practice the conversation — direct, empathetic, and outcome-focused."',
  },
  {
    id: 'stakeholders',
    label: 'Influence cross-functional leaders',
    coachName: 'Jordan Blake',
    coachRole: 'Strategy Coach',
    coachInitials: 'JB',
    accent: 'from-teal-500 to-cyan-600',
    prompt:
      '"You need Engineering and Finance aligned on your initiative. How do you build coalition without authority?"',
  },
  {
    id: 'avatar',
    label: 'Executive presence with avatar',
    coachName: 'Alex Rivera',
    coachRole: 'AI Coach · Face-to-face',
    coachInitials: 'AR',
    accent: 'from-amber-400 to-orange-500',
    prompt:
      '"Practice your opening for the all-hands. Camera on — presence, pace, and conviction matter here."',
    badge: 'NEW',
  },
  {
    id: 'priorities',
    label: 'Strategic prioritization',
    coachName: 'Elena Vasquez',
    coachRole: 'C-Suite Advisor',
    coachInitials: 'EV',
    accent: 'from-slate-600 to-slate-800',
    prompt:
      '"You have five priorities and capacity for two. Defend your choices to a skeptical CEO."',
  },
];

export default function ScenarioPreview({ onStart }: { onStart: () => void }) {
  const [selected, setSelected] = useState(COACHING_SCENARIOS[0]);
  const scenario = selected;

  return (
    <div id='scenarios' className='scenario-showcase'>
      <div className='scenario-showcase-grid'>
        <div className='scenario-picker'>
          <h2 className='font-display text-xl font-bold text-[var(--brand-navy)] mb-1'>
            Try executive coaching scenarios
          </h2>
          <p className='text-sm text-slate-500 mb-5'>
            Pick a high-stakes conversation — then sign in to practice live with AI.
          </p>
          <ul className='space-y-2'>
            {COACHING_SCENARIOS.map((s) => (
              <li key={s.id}>
                <button
                  type='button'
                  onClick={() => setSelected(s)}
                  className={`scenario-option w-full text-left ${selected.id === s.id ? 'scenario-option-active' : ''}`}
                >
                  <span className='flex items-center gap-2'>
                    {s.label}
                    {s.badge && <span className='scenario-new-badge'>{s.badge}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type='button' onClick={onStart} className='scenario-build-link'>
            Build your own coaching goal →
          </button>
        </div>

        <div className='scenario-stage'>
          <div className='scenario-stage-inner'>
            <div
              className={`scenario-avatar bg-gradient-to-br ${scenario.accent}`}
              aria-hidden
            >
              {scenario.coachInitials}
            </div>
            <p className='font-display font-bold text-slate-900 text-lg'>{scenario.coachName}</p>
            <p className='text-sm text-slate-500 mb-4'>{scenario.coachRole}</p>
            <blockquote className='scenario-prompt'>{scenario.prompt}</blockquote>
            <button type='button' onClick={onStart} className='btn-scenario-start'>
              Start practice session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
