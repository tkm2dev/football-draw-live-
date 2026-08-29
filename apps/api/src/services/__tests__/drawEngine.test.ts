import {describe,expect,it} from 'vitest'
import {chooseNextAssignment,eligibleNextTeams,emptyAssignments,parseRules,type DrawRule,type DrawTeam} from '../drawEngine.js'

const teams:DrawTeam[]=Array.from({length:12},(_,index)=>({id:index+1,code:`s${index+1}`,name:`Team ${index+1}`,seed:[1,3,8].includes(index),}))
const rules:DrawRule[]=[{type:'SEPARATE_TEAMS',teamCodes:['s2','s4','s9']}]
const seededRandom=(seed:number)=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)

function complete(seed:number,extraRules:DrawRule[]=rules){
  const groups=emptyAssignments(),random=seededRandom(seed)
  for(let index=0;index<12;index++){
    const choice=chooseNextAssignment(teams,groups,extraRules,random)
    if(!choice)throw new Error('draw completed too soon')
    groups[choice.group].push(choice.team)
  }
  return groups
}

describe('constraint draw engine',()=>{
  it('puts every genuinely eligible team on the first wheel without forcing constrained teams first',()=>{
    expect(eligibleNextTeams(teams,emptyAssignments(),rules).map(team=>team.code).sort()).toEqual(teams.map(team=>team.code).sort())
  })

  it('draws 12 teams into four full groups and always separates the three senior seeds',()=>{
    for(let seed=1;seed<=100;seed++){
      const groups=complete(seed)
      expect(Object.values(groups).map(group=>group.length)).toEqual([3,3,3,3])
      const seedGroups=Object.entries(groups).filter(([,members])=>members.some(team=>['s2','s4','s9'].includes(team.code))).map(([code])=>code)
      expect(new Set(seedGroups).size).toBe(3)
    }
  })

  it('supports future locked placements and blocked groups without changing the algorithm',()=>{
    const groups=complete(42,[...rules,{type:'LOCK_TEAM_TO_GROUP',teamCode:'s1',group:'D'},{type:'BLOCK_TEAM_FROM_GROUPS',teamCode:'s3',groups:['A','B']}])
    expect(groups.D.some(team=>team.code==='s1')).toBe(true)
    expect([...groups.A,...groups.B].some(team=>team.code==='s3')).toBe(false)
  })

  it('parses persisted JSON rules and ignores malformed payloads',()=>{
    expect(parseRules([{ruleType:'SEPARATE_TEAMS',payload:{teamCodes:['s2','s4','s9']}},{ruleType:'LOCK_TEAM_TO_GROUP',payload:{teamCode:'s1',group:'A'}},{ruleType:'SEPARATE_TEAMS',payload:{teams:['legacy']}}])).toEqual([
      {type:'SEPARATE_TEAMS',teamCodes:['s2','s4','s9'],label:undefined},
      {type:'LOCK_TEAM_TO_GROUP',teamCode:'s1',group:'A'}
    ])
  })

  it('fails before persisting when constraints cannot be completed',()=>{
    const impossible:DrawRule[]=[{type:'LOCK_TEAM_TO_GROUP',teamCode:'s1',group:'A'},{type:'LOCK_TEAM_TO_GROUP',teamCode:'s2',group:'A'},{type:'LOCK_TEAM_TO_GROUP',teamCode:'s3',group:'A'},{type:'LOCK_TEAM_TO_GROUP',teamCode:'s4',group:'A'}]
    expect(()=>chooseNextAssignment(teams,emptyAssignments(),impossible,seededRandom(1))).toThrow(/ไม่พบรูปแบบ/)
  })
})
