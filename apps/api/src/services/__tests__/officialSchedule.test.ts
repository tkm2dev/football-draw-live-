import {describe,expect,it} from 'vitest'
import {OFFICIAL_SCHEDULE} from '../officialSchedule.js'

describe('official 2569 competition schedule',()=>{
  it('contains all 39 matches in order across the five official dates',()=>{
    expect(OFFICIAL_SCHEDULE.map(item=>item.sequenceNo)).toEqual(Array.from({length:39},(_,index)=>index+1))
    const counts=OFFICIAL_SCHEDULE.reduce<Record<string,number>>((out,item)=>{const date=item.startsAt.slice(0,10);out[date]=(out[date]??0)+1;return out},{})
    expect(counts).toEqual({'2026-09-06':8,'2026-09-12':10,'2026-09-13':6,'2026-09-19':8,'2026-09-20':7})
  })

  it('has 24 real group fixtures and the specified knockout crossing',()=>{
    const groups=OFFICIAL_SCHEDULE.filter(item=>item.stage==='GROUP')
    expect(groups).toHaveLength(24)
    expect(groups.every(item=>item.home.kind==='TEAM'&&item.away.kind==='TEAM')).toBe(true)
    expect(OFFICIAL_SCHEDULE.slice(24,32).map(item=>[item.groupLabel,item.home.kind==='LABEL'?item.home.label:'',item.away.kind==='LABEL'?item.away.label:''])).toEqual([
      ['A-C','อันดับ 1 สาย A','อันดับ 2 สาย C'],['A-C','อันดับ 1 สาย C','อันดับ 2 สาย A'],['B-D','อันดับ 1 สาย B','อันดับ 2 สาย D'],['B-D','อันดับ 1 สาย D','อันดับ 2 สาย B'],
      ['A-C','อันดับ 1 สาย A','อันดับ 2 สาย C'],['A-C','อันดับ 1 สาย C','อันดับ 2 สาย A'],['B-D','อันดับ 1 สาย B','อันดับ 2 สาย D'],['B-D','อันดับ 1 สาย D','อันดับ 2 สาย B'],
    ])
  })

  it('preserves the special VIP fixture and final match times',()=>{
    const special=OFFICIAL_SCHEDULE.find(item=>item.sequenceNo===38)!
    expect(special.categoryLabel).toBe('คู่พิเศษ')
    expect(special.home).toEqual({kind:'LABEL',label:'Vip หมออลงกต'})
    expect(special.away).toEqual({kind:'LABEL',label:'Vip สภ.ปลาปาก'})
    expect(OFFICIAL_SCHEDULE.at(-1)?.endsAt).toBe('2026-09-20T16:00:00+07:00')
  })
})
