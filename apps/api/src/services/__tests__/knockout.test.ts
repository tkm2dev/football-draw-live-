import {describe,expect,it} from 'vitest'
import {planKnockoutAdvance,type KnockoutMatchInput} from '../knockout.js'

const qf=(round:number,homeTeamId:number,awayTeamId:number,homeScore:number|null=null,awayScore:number|null=null,status:KnockoutMatchInput['status']='SCHEDULED'):KnockoutMatchInput=>({stage:'QF',round,homeTeamId,awayTeamId,homeScore,awayScore,status})
const sf=(round:number,homeTeamId:number,awayTeamId:number,homeScore:number|null=null,awayScore:number|null=null,status:KnockoutMatchInput['status']='SCHEDULED'):KnockoutMatchInput=>({stage:'SF',round,homeTeamId,awayTeamId,homeScore,awayScore,status})
const finished=(match:KnockoutMatchInput,homeScore:number,awayScore:number):KnockoutMatchInput=>({...match,homeScore,awayScore,status:'FINISHED'})

// Four quarter-finals with a clear winner in each: home wins #1/#3, away wins #2/#4.
const decidedQf=()=>[finished(qf(1,10,20),2,1),finished(qf(2,30,40),0,3),finished(qf(3,50,60),4,2),finished(qf(4,70,80),1,5)]

describe('knockout advancement rules',()=>{
  it('refuses to build the semi-finals until every quarter-final has a winner',()=>{
    expect(()=>planKnockoutAdvance([])).toThrow(/รอบ 8 ทีม/)
    const draw=[...decidedQf()];draw[0]=finished(qf(1,10,20),2,2)
    expect(()=>planKnockoutAdvance(draw)).toThrow(/รอบ 8 ทีม/)
    const pending=[...decidedQf()];pending[3]=qf(4,70,80)
    expect(()=>planKnockoutAdvance(pending)).toThrow(/รอบ 8 ทีม/)
  })

  it('crosses quarter-final winners 1v3 and 2v4 into the semi-finals',()=>{
    expect(planKnockoutAdvance(decidedQf())).toEqual({stage:'SF',pairs:[[10,50],[40,80]]})
  })

  it('waits for both semi-finals before building the final',()=>{
    const withSemis=[...decidedQf(),sf(1,10,50),sf(2,40,80)]
    expect(()=>planKnockoutAdvance(withSemis)).toThrow(/รอบรองชนะเลิศ/)
    const halfDone=[...decidedQf(),finished(sf(1,10,50),3,1),sf(2,40,80)]
    expect(()=>planKnockoutAdvance(halfDone)).toThrow(/รอบรองชนะเลิศ/)
  })

  it('sends the two semi-final winners to the final',()=>{
    const complete=[...decidedQf(),finished(sf(1,10,50),3,1),finished(sf(2,40,80),2,4)]
    expect(planKnockoutAdvance(complete)).toEqual({stage:'FINAL',pairs:[[10,80]]})
  })

  it('reports nothing to advance once the final already exists',()=>{
    const complete=[...decidedQf(),finished(sf(1,10,50),3,1),finished(sf(2,40,80),2,4),{stage:'FINAL',round:1,homeTeamId:10,awayTeamId:80,homeScore:null,awayScore:null,status:'SCHEDULED'} as KnockoutMatchInput]
    expect(planKnockoutAdvance(complete)).toEqual({stage:null})
  })
})
