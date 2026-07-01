'use client';

const STEPS = [
  {
    num: '01',
    title: 'Set your leadership goal',
    body: 'Define what promotion-ready looks like for you — presence, influence, or strategic judgment.',
  },
  {
    num: '02',
    title: 'Practice high-stakes dialogue',
    body: 'Voice or avatar sessions simulate real executive moments. Your AI coach adapts to your CDL level.',
  },
  {
    num: '03',
    title: 'Measure growth & act',
    body: 'Every session is scored, debriefed, and folded into a 30-day action plan you can track.',
  },
];

export default function HowItWorks() {
  return (
    <section id='how-it-works' className='journey-section'>
      <div className='journey-section-inner'>
        <div className='journey-section-intro'>
          <p className='journey-eyebrow'>The path to promotion-ready leadership</p>
          <h2 className='journey-title'>
            From first conversation to <span className='journey-title-accent'>measurable growth</span>
          </h2>
        </div>

        <div className='journey-steps'>
          {STEPS.map((step, i) => (
            <article key={step.num} className='journey-step'>
              {i < STEPS.length - 1 && <div className='journey-step-connector' aria-hidden />}
              <span className='journey-step-num'>{step.num}</span>
              <h3 className='journey-step-title'>{step.title}</h3>
              <p className='journey-step-body'>{step.body}</p>
            </article>
          ))}
        </div>

        <div className='journey-proof'>
          <div className='journey-proof-card'>
            <span className='journey-proof-score'>87</span>
            <div>
              <p className='journey-proof-label'>Sample session score</p>
              <p className='journey-proof-desc'>
                Competency scoring across strategic thinking, operational accountability, and influence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
