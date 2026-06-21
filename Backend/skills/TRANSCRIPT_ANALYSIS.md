# TRANSCRIPT ANALYSIS SKILL
 
## What This Does
Analyzes the candidate's spoken words before scoring. Detects leadership language
signals, filler word density, response length, and question vs. statement balance.
This is fast text analysis — no AI API call is needed. Results are passed to
the Scoring Agent to improve scoring accuracy.
 
## Human Leadership Signals (keywords that indicate each quality)
empathy:              feel, understand, imagine, perspective, trust, support
clarity:              clear, align, communicate, ensure, define, priority
accountability:       responsible, own, commit, i will, by when, deadline
psychological_safety: safe, open, honest, candid, willing to
active_listening:     what i heard, you said, you mentioned, correct me if
 
## AI/Agent Leadership Signals
systemic_thinking:  system, process, pipeline, workflow, architecture
ai_governance:      guardrail, output, validate, trust the data, verify, bias
kpi_linkage:        metric, kpi, measure, track, target, performance
risk_awareness:     risk, failure, contingency, backup, downtime, error
agent_diagnosis:    why is it, root cause, investigate, diagnose, check the
 
## Filler Words (penalised in evaluation)
um, uh, like, you know, basically, literally, i mean, kind of, sort of, right?
 
## Computed Metrics
word_count:                  total words in response
too_short:                   True if word_count < 15
vocabulary_richness:         unique words / total words (higher is better)
human_signals:               list of detected human leadership signals
agent_signals:               list of detected AI/agent leadership signals
dual_oversight_demonstrated: True if both human AND agent signals detected
question_ratio:              questions / total utterances
leadership_style:            'inquiring' (asks questions) or 'advocating' (makes statements)
filler_density:              filler words / total words (lower is better)
high_filler_density:         True if filler_density > 0.08
