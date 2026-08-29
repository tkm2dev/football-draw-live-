export type DivisionKey='PUBLIC'|'SENIOR40'
export type GroupCode='A'|'B'|'C'|'D'
export const GROUP_CODES:GroupCode[]=['A','B','C','D']
export const GROUP_CAPACITY=3

export interface DrawTeam{id:number;code:string;name:string;seed:boolean}
export type AssignmentMap=Record<GroupCode,DrawTeam[]>
export type DrawRule=
  | {type:'SEPARATE_TEAMS';teamCodes:string[];label?:string}
  | {type:'SEED_ACROSS_GROUPS'}
  | {type:'LOCK_TEAM_TO_GROUP';teamCode:string;group:GroupCode}
  | {type:'BLOCK_TEAM_FROM_GROUPS';teamCode:string;groups:GroupCode[]}

export interface StoredRule{ruleType:string;payload:unknown}
export interface DrawChoice{team:DrawTeam;group:GroupCode}
export type RandomSource=()=>number

export const emptyAssignments=():AssignmentMap=>({A:[],B:[],C:[],D:[]})

function object(value:unknown):Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
}

function group(value:unknown):GroupCode|null{
  return typeof value==='string'&&GROUP_CODES.includes(value as GroupCode)?value as GroupCode:null
}

export function parseRules(rows:StoredRule[]):DrawRule[]{
  const parsed:DrawRule[]=[]
  for(const row of rows){
    const payload=object(row.payload)
    if(row.ruleType==='SEPARATE_TEAMS'){
      const teamCodes=Array.isArray(payload.teamCodes)?payload.teamCodes.filter((x):x is string=>typeof x==='string'):[]
      if(teamCodes.length>1)parsed.push({type:'SEPARATE_TEAMS',teamCodes,label:typeof payload.label==='string'?payload.label:undefined})
    }
    if(row.ruleType==='SEED_ACROSS_GROUPS')parsed.push({type:'SEED_ACROSS_GROUPS'})
    if(row.ruleType==='LOCK_TEAM_TO_GROUP'){
      const lockedGroup=group(payload.group)
      if(typeof payload.teamCode==='string'&&lockedGroup)parsed.push({type:'LOCK_TEAM_TO_GROUP',teamCode:payload.teamCode,group:lockedGroup})
    }
    if(row.ruleType==='BLOCK_TEAM_FROM_GROUPS'&&typeof payload.teamCode==='string'&&Array.isArray(payload.groups)){
      const groups=payload.groups.map(group).filter((x):x is GroupCode=>x!==null)
      parsed.push({type:'BLOCK_TEAM_FROM_GROUPS',teamCode:payload.teamCode,groups})
    }
  }
  return parsed
}

function shuffled<T>(items:T[],random:RandomSource):T[]{
  const out=[...items]
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out
}

function fits(team:DrawTeam,groupCode:GroupCode,assignments:AssignmentMap,rules:DrawRule[]):boolean{
  const members=assignments[groupCode]
  if(members.length>=GROUP_CAPACITY)return false
  for(const rule of rules){
    if(rule.type==='LOCK_TEAM_TO_GROUP'&&rule.teamCode===team.code&&rule.group!==groupCode)return false
    if(rule.type==='BLOCK_TEAM_FROM_GROUPS'&&rule.teamCode===team.code&&rule.groups.includes(groupCode))return false
    if(rule.type==='SEPARATE_TEAMS'&&rule.teamCodes.includes(team.code)&&members.some(member=>rule.teamCodes.includes(member.code)))return false
    if(rule.type==='SEED_ACROSS_GROUPS'&&team.seed&&members.some(member=>member.seed))return false
  }
  return true
}

export function validGroups(team:DrawTeam,assignments:AssignmentMap,rules:DrawRule[]):GroupCode[]{
  return GROUP_CODES.filter(code=>fits(team,code,assignments,rules))
}

function canComplete(remaining:DrawTeam[],assignments:AssignmentMap,rules:DrawRule[],random:RandomSource):boolean{
  if(remaining.length===0)return true
  const ordered=[...remaining].sort((a,b)=>validGroups(a,assignments,rules).length-validGroups(b,assignments,rules).length)
  const [team,...rest]=ordered
  for(const code of shuffled(validGroups(team,assignments,rules),random)){
    assignments[code].push(team)
    if(canComplete(rest,assignments,rules,random)){assignments[code].pop();return true}
    assignments[code].pop()
  }
  return false
}

export function assertDrawConfiguration(teams:DrawTeam[],assignments:AssignmentMap,rules:DrawRule[]):void{
  if(teams.length!==GROUP_CODES.length*GROUP_CAPACITY)throw new Error('การจับสลากต้องมี 12 ทีม สำหรับ 4 สาย สายละ 3 ทีม')
  const codes=new Set(teams.map(team=>team.code))
  if(codes.size!==teams.length)throw new Error('รหัสทีมต้องไม่ซ้ำกัน')
  for(const rule of rules){
    const referenced=rule.type==='SEPARATE_TEAMS'?rule.teamCodes:(rule.type==='LOCK_TEAM_TO_GROUP'||rule.type==='BLOCK_TEAM_FROM_GROUPS'?[rule.teamCode]:[])
    for(const code of referenced)if(!codes.has(code))throw new Error(`กติกาอ้างถึงทีมที่ไม่มีอยู่: ${code}`)
  }
  const assignedIds=GROUP_CODES.flatMap(code=>assignments[code].map(team=>team.id))
  if(new Set(assignedIds).size!==assignedIds.length)throw new Error('พบทีมซ้ำในผลจับสลาก')
  for(const code of GROUP_CODES)for(const team of assignments[code]){
    const withoutTeam={...assignments,[code]:assignments[code].filter(x=>x.id!==team.id)}
    if(!fits(team,code,withoutTeam,rules))throw new Error(`ผลเดิมขัดกับกติกา: ${team.name}`)
  }
}

export function feasibleNextChoices(teams:DrawTeam[],assignments:AssignmentMap,rules:DrawRule[]):DrawChoice[]{
  assertDrawConfiguration(teams,assignments,rules)
  const drawn=new Set(GROUP_CODES.flatMap(code=>assignments[code].map(team=>team.id)))
  const remaining=teams.filter(team=>!drawn.has(team.id))
  if(remaining.length===0)return[]
  const choices:DrawChoice[]=[]
  for(const team of remaining){
    for(const code of validGroups(team,assignments,rules)){
      assignments[code].push(team)
      const rest=remaining.filter(candidate=>candidate.id!==team.id)
      const possible=canComplete(rest,assignments,rules,()=>.5)
      assignments[code].pop()
      if(possible)choices.push({team,group:code})
    }
  }
  return choices
}

export function eligibleNextTeams(teams:DrawTeam[],assignments:AssignmentMap,rules:DrawRule[]):DrawTeam[]{
  const choices=feasibleNextChoices(teams,assignments,rules)
  return choices.filter((choice,index)=>choices.findIndex(candidate=>candidate.team.id===choice.team.id)===index).map(choice=>choice.team)
}

export function chooseNextAssignment(teams:DrawTeam[],assignments:AssignmentMap,rules:DrawRule[],random:RandomSource=Math.random):DrawChoice|null{
  const choices=feasibleNextChoices(teams,assignments,rules)
  if(!choices.length){
    const drawn=GROUP_CODES.reduce((total,code)=>total+assignments[code].length,0)
    if(drawn===teams.length)return null
    throw new Error('ไม่พบรูปแบบการจัดสายที่ผ่านเงื่อนไข กรุณาตรวจสอบกติกา ทีมวาง และทีมที่ล็อกไว้')
  }
  const teamsInWheel=choices.filter((choice,index)=>choices.findIndex(candidate=>candidate.team.id===choice.team.id)===index).map(choice=>choice.team)
  const team=shuffled(teamsInWheel,random)[0]
  const groups=choices.filter(choice=>choice.team.id===team.id).map(choice=>choice.group)
  const group=shuffled(groups,random)[0]
  return{team,group}
}
