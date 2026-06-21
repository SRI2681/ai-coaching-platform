# FRAMEWORK SELECTOR SKILL
 
## What This Does
Selects the most appropriate coaching framework for each candidate based on
their role level and primary coaching goal. Called once at session start.
 
## Selection Rules (apply in order — first match wins)
 
1. If employer has set a framework override → use that framework
 
2. If role_level is 'c-suite' or 'vp' → use Goldsmith SCC
   Goldsmith Stakeholder-Centered Coaching is designed for senior executives.
   Focuses on behavioral change visible to stakeholders.
 
3. If primary_goal contains 'revenue' or 'scale' → use ActionCOACH
   ActionCOACH is results-focused, used by founders and growth leaders.
   Focuses on measurable outcomes and business momentum.
 
4. If role_level is 'director' AND primary_goal contains 'kpi' → use MAP
   MAP (Motivational Action Planning) connects leadership development
   to measurable team performance indicators.
 
5. Default for all other cases → use GROW
   GROW (Goal, Reality, Options, Will) is the most widely used framework.
   Works for all levels. Clear, structured, action-oriented.
 
## Frameworks Reference
GROW:         Goal → Reality → Options → Will (action plan). Best for managers.
MAP:          Motivational Action Planning. Best for directors with KPI goals.
ActionCOACH:  Business performance focus. Best for founders and revenue leaders.
Goldsmith:    Stakeholder-centered behavioral coaching. Best for VP and C-suite.
