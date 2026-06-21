# CDL SCORING SKILL
 
## What CDL Is
CDL (Current Difficulty Level) is a number from 1.0 to 5.0 that measures
a leader's coaching readiness. Like a golf handicap — lower means still developing,
higher means more advanced. The platform increases difficulty automatically as
the leader improves.
 
## The Math
 
### Step 1: Composite Score
composite = (human_score × 0.6) + (agent_score × 0.4)
Human Leadership is weighted higher (60%) because empathy and team leadership
are the foundation. AI governance (40%) matters increasingly as CDL rises.
 
### Step 2: CDL Adjustment
composite >= 85  → advance +0.5  (strong performance on both dimensions)
composite 60-84  → hold 0.0     (solid but not ready to advance)
composite < 60   → regress -0.3  (needs to revisit fundamentals)
too_short = True → hold 0.0     (response under 15 words, no evaluation)
 
### Step 3: Apply Adjustment
new_cdl = current_cdl + adjustment
Minimum CDL: 1.0 (cannot go below Foundation)
Maximum CDL: 5.0 (cannot go above Executive)
Round to 1 decimal place.
 
## CDL Level Descriptions
1.0-1.9  Foundation:    Single-dimension awareness questions
2.0-2.9  Developing:    Two-part cause-and-effect questions
3.0-3.9  Practitioner:  Assumption challenges, stakeholder complexity
4.0-4.9  Advanced:      Systemic friction, competing priorities
5.0      Executive:     Multi-stakeholder crisis, no single right answer
