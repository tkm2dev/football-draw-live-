// Pure knockout-progression rules shared by the tournament engine and covered by
// unit tests. Keeping the decision here (which round to build next, and from which
// winners) lets us verify the crossing without a database and keeps advanceKnockout
// focused on persistence.
export type KnockoutStage='QF'|'SF'|'FINAL'
export interface KnockoutMatchInput{stage:string;round:number;homeTeamId:number;awayTeamId:number;homeScore:number|null;awayScore:number|null;status:'SCHEDULED'|'LIVE'|'FINISHED'}
export type KnockoutPlan={stage:'SF'|'FINAL';pairs:[number,number][]}|{stage:null}

const decided=(match:KnockoutMatchInput)=>match.status==='FINISHED'&&match.homeScore!==null&&match.awayScore!==null&&match.homeScore!==match.awayScore
const allDecided=(matches:KnockoutMatchInput[],expected:number)=>matches.length===expected&&matches.every(decided)
const winnerId=(match:KnockoutMatchInput)=>match.homeScore!>match.awayScore!?match.homeTeamId:match.awayTeamId

// Determine the next knockout round to create from the current matches, or null when
// the bracket is already complete. Throws the same messages the control screen shows
// when a round still needs results before the next one can be built.
export function planKnockoutAdvance(matches:KnockoutMatchInput[]):KnockoutPlan{
  const qf=matches.filter(match=>match.stage==='QF').sort((a,b)=>a.round-b.round)
  if(!allDecided(qf,4))throw new Error('กรุณากรอกผลรอบ 8 ทีมให้ครบและต้องมีผู้ชนะ')
  const sf=matches.filter(match=>match.stage==='SF').sort((a,b)=>a.round-b.round)
  if(sf.length===0)return{stage:'SF',pairs:[[winnerId(qf[0]),winnerId(qf[2])],[winnerId(qf[1]),winnerId(qf[3])]]}
  if(!allDecided(sf,2))throw new Error('กรุณากรอกผลรอบรองชนะเลิศให้ครบและต้องมีผู้ชนะ')
  if(!matches.some(match=>match.stage==='FINAL'))return{stage:'FINAL',pairs:[[winnerId(sf[0]),winnerId(sf[1])]]}
  return{stage:null}
}
