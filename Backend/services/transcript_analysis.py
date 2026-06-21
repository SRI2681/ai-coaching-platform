HUMAN_LEADERSHIP_SIGNALS = {
    'empathy':              ['feel', 'understand', 'imagine', 'perspective', 'trust', 'support'],
    'clarity':              ['clear', 'align', 'communicate', 'ensure', 'define', 'priority'],
    'accountability':       ['responsible', 'own', 'commit', 'i will', 'by when', 'deadline'],
    'psychological_safety': ['safe', 'open', 'honest', 'candid', 'willing to'],
    'active_listening':     ['what i heard', 'you said', 'you mentioned', 'correct me if'],
}
 
AGENT_SYSTEM_SIGNALS = {
    'systemic_thinking': ['system', 'process', 'pipeline', 'workflow', 'architecture'],
    'ai_governance':     ['guardrail', 'output', 'validate', 'trust the data', 'verify', 'bias'],
    'kpi_linkage':       ['metric', 'kpi', 'measure', 'track', 'target', 'performance'],
    'risk_awareness':    ['risk', 'failure', 'contingency', 'backup', 'downtime', 'error'],
    'agent_diagnosis':   ['why is it', 'root cause', 'investigate', 'diagnose', 'check the'],
}
 
FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally',
                'i mean', 'kind of', 'sort of', 'right?']
 
 
def analyze_transcript(transcript: str) -> dict:
    if not transcript or not transcript.strip():
        return {'word_count': 0, 'too_short': True, 'off_topic': True,
                'human_signals': [], 'agent_signals': [],
                'dual_oversight_demonstrated': False,
                'question_ratio': 0, 'filler_density': 0,
                'high_filler_density': False, 'vocabulary_richness': 0}
 
    words      = transcript.split()
    word_count = len(words)
    too_short  = word_count < 15
    tl         = transcript.lower()
 
    human_found = [k for k, terms in HUMAN_LEADERSHIP_SIGNALS.items()
                   if any(t in tl for t in terms)]
    agent_found = [k for k, terms in AGENT_SYSTEM_SIGNALS.items()
                   if any(t in tl for t in terms)]
 
    q_count    = transcript.count('?')
    total_utts = len(transcript.split('.')) + q_count
    q_ratio    = round(q_count / max(total_utts, 1), 2)
 
    filler_count = sum(tl.count(w) for w in FILLER_WORDS)
    filler_ratio = round(filler_count / max(word_count, 1), 2)
 
    return {
        'word_count':                  word_count,
        'too_short':                   too_short,
        'vocabulary_richness':         round(len(set(words)) / max(word_count, 1), 2),
        'human_signals':               human_found,
        'agent_signals':               agent_found,
        'dual_oversight_demonstrated': len(human_found) > 0 and len(agent_found) > 0,
        'question_ratio':              q_ratio,
        'leadership_style':            'inquiring' if q_count > 0 else 'advocating',
        'filler_density':              filler_ratio,
        'high_filler_density':         filler_ratio > 0.08,
        'off_topic':                   word_count < 10,
    }
