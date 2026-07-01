'use client';

export default function HowItWorks() {
  return (
    <section id='how-it-works' className='how-it-works'>
      <div className='how-decor-circle how-decor-circle-1' aria-hidden />
      <div className='how-decor-circle how-decor-circle-2' aria-hidden />
      <div className='how-decor-dash how-decor-dash-1' aria-hidden />
      <div className='how-decor-dash how-decor-dash-2' aria-hidden />

      <div className='how-it-works-inner'>
        <p className='how-eyebrow font-display font-bold text-[var(--brand-navy)]'>
          HOW <span className='how-eyebrow-underline'>IT</span> WORKS
        </p>

        <div className='how-cards-stack'>
          <article className='how-card how-card-top'>
            <div className='how-mock-session'>
              <div className='how-mock-sidebar'>
                <div className='how-mock-dot' />
                <div className='how-mock-dot muted' />
                <div className='how-mock-dot muted' />
              </div>
              <div className='how-mock-main'>
                <p className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3'>
                  Live coaching simulation
                </p>
                <div className='how-mock-videos'>
                  <div className='how-mock-video coach'>
                    <span className='how-mock-initials'>AR</span>
                    <p className='how-mock-caption'>
                      &quot;How would you reframe that for the board?&quot;
                    </p>
                  </div>
                  <div className='how-mock-video you'>
                    <span className='how-mock-you-label'>You</span>
                  </div>
                </div>
                <div className='how-mock-bar'>
                  <span className='text-xs text-slate-400'>Session active</span>
                  <span className='how-mock-end'>End session</span>
                </div>
              </div>
            </div>
            <p className='how-card-text mt-5'>
              <strong className='text-slate-900'>Practice like it&apos;s real.</strong> Voice or avatar
              sessions simulate board reviews, tough feedback, and stakeholder negotiations — with an AI
              coach that adapts to your level.
            </p>
          </article>

          <article className='how-card how-card-bottom'>
            <span className='how-score-badge' aria-label='Sample score 87'>87</span>
            <h3 className='font-display font-bold text-lg text-slate-900 mb-2'>
              AI coaching intelligence
            </h3>
            <p className='how-card-text'>
              Auto-score executive competencies, track your Coaching Development Level (CDL), and surface
              skill gaps after every session — so you know exactly what to work on next.
            </p>
            <div className='how-metrics-row'>
              <div className='how-metric'>
                <span className='how-metric-val'>+12</span>
                <span className='how-metric-label'>CDL growth</span>
              </div>
              <div className='how-metric'>
                <span className='how-metric-val'>5</span>
                <span className='how-metric-label'>Competencies</span>
              </div>
              <div className='how-metric'>
                <span className='how-metric-val'>30d</span>
                <span className='how-metric-label'>Action plan</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
