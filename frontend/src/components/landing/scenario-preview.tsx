'use client';

import { useState } from 'react';
import { COACHING_SCENARIOS, type CoachingScenario } from './scenario-data';

export { COACHING_SCENARIOS };

export default function ScenarioPreview({ onStart }: { onStart: () => void }) {
  const [selected, setSelected] = useState<CoachingScenario>(COACHING_SCENARIOS[0]);

  return (
    <div id='scenarios' className='scenario-explorer'>
      <div className='scenario-explorer-header'>
        <div>
          <p className='scenario-explorer-eyebrow'>Executive rehearsal studio</p>
          <h2 className='scenario-explorer-title'>Choose your next conversation</h2>
        </div>
        <p className='scenario-explorer-aside'>
          Tap a scenario to preview — then launch a live AI coaching session.
        </p>
      </div>

      <div className='scenario-card-grid'>
        {COACHING_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type='button'
            onClick={() => setSelected(s)}
            className={`scenario-tile ${selected.id === s.id ? 'scenario-tile-active' : ''}`}
          >
            <span className={`scenario-tile-icon bg-gradient-to-br ${s.accent}`}>{s.icon}</span>
            <span className='scenario-tile-label'>{s.label}</span>
            {s.badge && <span className='scenario-tile-badge'>{s.badge}</span>}
          </button>
        ))}
      </div>

      <div className='scenario-detail-panel'>
        <div className='scenario-detail-copy'>
          <p className='scenario-detail-role'>{selected.coachRole}</p>
          <h3 className='scenario-detail-headline'>{selected.headline}</h3>
          <blockquote className='scenario-detail-quote'>{selected.prompt}</blockquote>
          <div className='scenario-detail-meta'>
            <span>Coach: {selected.coachName}</span>
            <span className='scenario-detail-dot' />
            <span>~15 min session</span>
          </div>
        </div>
        <div className='scenario-detail-action'>
          <div className={`scenario-detail-avatar bg-gradient-to-br ${selected.accent}`}>
            {selected.coachInitials}
          </div>
          <button type='button' onClick={onStart} className='btn-scenario-launch'>
            Start practice session
          </button>
        </div>
      </div>
    </div>
  );
}
