"""Invisible framework selection — uses role, goal, CDL, and baseline profile."""

from typing import Any, Optional

FRAMEWORKS = (
    'GROW',
    'OSKAR',
    'CLEAR',
    'WOOP',
    'STEPPPA',
    'ActionCOACH',
    'Brian Tracy',
    'Goldsmith',
    'MAP',
)

FRAMEWORK_GUIDANCE = {
    'GROW': 'Goal → Reality → Options → Will. Linear solution-focused coaching.',
    'OSKAR': 'Outcome, Scaling, Know-how, Affirm, Review. Rapid goal execution.',
    'CLEAR': 'Contract, Listen, Explore, Action, Review. Structured behavioral agreement.',
    'WOOP': 'Wish, Outcome, Obstacle, Plan. Overcome internal blocks and habits.',
    'STEPPPA': 'Subject, Target, Emotion, Perception, Plan, Pace, Adapt. Deep structured change.',
    'ActionCOACH': 'Commercial strategy, accountability, measurable business outcomes.',
    'Brian Tracy': 'Eat That Frog priorities, time management, high accountability execution.',
    'Goldsmith': 'Stakeholder-Centered Coaching — behavioral change validated by peers.',
    'MAP': 'Motivational Action Planning tied to KPIs and team performance.',
}


def _gap_text(baseline: dict[str, Any]) -> str:
    return ' '.join(baseline.get('gaps') or []).lower()


def _strength_text(baseline: dict[str, Any]) -> str:
    return ' '.join(baseline.get('strengths') or []).lower()


def select_framework(
    role_level: str,
    primary_goal: str,
    current_cdl: float,
    baseline: Optional[dict[str, Any]] = None,
    employer_override: Optional[str] = None,
) -> str:
    if employer_override and employer_override in FRAMEWORKS:
        return employer_override

    baseline = baseline or {}
    goal_lower = (primary_goal or '').lower()
    gaps = _gap_text(baseline)
    strengths = _strength_text(baseline)
    level = (baseline.get('level') or '').lower()
    profile = baseline.get('methodology_profile') or {}
    disc = profile.get('disc_profile') or {}

    strat = baseline.get('strategic_score') or 0
    oper = baseline.get('operational_score') or 0
    infl = baseline.get('influence_score') or 0

    # Baseline-critical rules (Section 6.2)
    if any(k in gaps for k in ('immunity', 'habit', 'resistance', 'block')):
        return 'WOOP'
    if infl < 55 or 'influence' in gaps or 'communication' in gaps:
        return 'CLEAR'
    if strat < 55 and oper < 55 and level in ('foundation', 'developing'):
        return 'OSKAR'
    if oper < 60 or 'operational' in gaps or 'accountability' in gaps:
        if disc.get('conscientiousness', 0) >= 60:
            return 'Brian Tracy'
        return 'STEPPPA'
    if strat < 60 or 'strategic' in gaps:
        if 'revenue' in goal_lower or 'scale' in goal_lower or 'profit' in goal_lower:
            return 'ActionCOACH'
        return 'GROW'

    # Role / goal heuristics
    if role_level in ('c-suite', 'vp') or 'stakeholder' in gaps:
        return 'Goldsmith'
    if 'revenue' in goal_lower or 'scale' in goal_lower or 'profit' in goal_lower:
        return 'ActionCOACH'
    if 'time' in goal_lower or 'priority' in goal_lower or 'productivity' in goal_lower:
        return 'Brian Tracy'
    if role_level == 'director' and 'kpi' in goal_lower:
        return 'MAP'
    if strengths and oper >= 75 and strat >= 75:
        return 'OSKAR'
    if current_cdl >= 4.0:
        return 'Goldsmith'

    return 'GROW'


def framework_coaching_hint(framework: str) -> str:
    return FRAMEWORK_GUIDANCE.get(framework, FRAMEWORK_GUIDANCE['GROW'])
