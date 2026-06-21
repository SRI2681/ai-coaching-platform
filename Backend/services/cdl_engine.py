def calculate_composite(human_score: int, agent_score: int) -> int:
    return round(human_score * 0.6 + agent_score * 0.4)
 
 
def determine_cdl_adjustment(composite: int, too_short: bool = False) -> float:
    if too_short:
        return 0.0
    if composite >= 85:
        return 0.5
    elif composite >= 60:
        return 0.0
    else:
        return -0.3
 
 
def apply_cdl_update(current_cdl: float, adjustment: float) -> float:
    new_cdl = current_cdl + adjustment
    return round(max(1.0, min(5.0, new_cdl)), 1)
 
 
def get_cdl_movement(current: float, new: float) -> str:
    if new > current:
        return 'advanced'
    elif new < current:
        return 'regressed'
    else:
        return 'held'
 
 
def run_cdl_update(current_cdl: float, human_score: int, agent_score: int,
                   too_short: bool = False) -> dict:
    composite  = calculate_composite(human_score, agent_score)
    adjustment = determine_cdl_adjustment(composite, too_short)
    cdl_new    = apply_cdl_update(current_cdl, adjustment)
    movement   = get_cdl_movement(current_cdl, cdl_new)
    return {
        'composite_score': composite,
        'cdl_new': cdl_new,
        'cdl_movement': movement,
        'adjustment': adjustment
    }
 
 
CDL_LEVEL_DESCRIPTIONS = {
    1: 'Foundation — single-dimension awareness questions',
    2: 'Developing — two-part cause-and-effect questions',
    3: 'Practitioner — assumption challenges, stakeholder complexity',
    4: 'Advanced — systemic friction, competing priorities',
    5: 'Executive — multi-stakeholder crisis, no single right answer'
}