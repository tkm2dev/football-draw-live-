import { separationRules,teams,type DivisionKey,type Group,type Team } from '../data.js'
export type GroupMap=Record<Group,Team[]>
export type DrawStatus='READY'|'LIVE'|'COMPLETED'|'LOCKED'
export interface DrawEvent{at:string;message:string;team?:Team;group?:Group}
export interface DrawState{
  divisionKey:DivisionKey;groups:GroupMap;drawnIds:string[];
  currentReveal:null|{team:Team;group:Group};status:DrawStatus;locked:boolean;events:DrawEvent[]
}
const groups:Group[]=['A','B','C','D']
export const emptyState=(divisionKey:DivisionKey):DrawState=>({divisionKey,groups:{A:[],B:[],C:[],D:[]},drawnIds:[],currentReveal:null,status:'READY',locked:false,events:[]})
export const states:Record<DivisionKey,DrawState>={PUBLIC:emptyState('PUBLIC'),SENIOR40:emptyState('SENIOR40')}
const shuffled=<T>(arr:T[])=>[...arr].sort(()=>Math.random()-.5)
function violates(divisionKey:DivisionKey,team:Team,groupTeams:Team[]){return separationRules[divisionKey].some(([a,b])=> (team.id===a&&groupTeams.some(t=>t.id===b))||(team.id===b&&groupTeams.some(t=>t.id===a)))}
function validGroups(divisionKey:DivisionKey,team:Team,state:DrawState){return groups.filter(g=>state.groups[g].length<3&&!violates(divisionKey,team,state.groups[g]))}
function canComplete(divisionKey:DivisionKey,state:DrawState,remaining:Team[]):boolean{
 if(!remaining.length) return true
 const [team,...rest]=remaining
 for(const g of shuffled(validGroups(divisionKey,team,state))){
  state.groups[g].push(team)
  if(canComplete(divisionKey,state,rest)){state.groups[g].pop();return true}
  state.groups[g].pop()
 }
 return false
}
export function drawNext(divisionKey:DivisionKey){
 const state=states[divisionKey]
 if(state.locked) throw new Error('การจับสลากถูกล็อกแล้ว')
 const remaining=teams[divisionKey].filter(t=>!state.drawnIds.includes(t.id))
 if(!remaining.length){state.status='COMPLETED';return state}
 state.status='LIVE'
 const pool=remaining.some(t=>t.seed)?remaining.filter(t=>t.seed):remaining
 const team=shuffled(pool)[0]
 const candidates=shuffled(validGroups(divisionKey,team,state))
 for(const group of candidates){
  state.groups[group].push(team)
  const rest=teams[divisionKey].filter(t=>!state.drawnIds.includes(t.id)&&t.id!==team.id)
  if(canComplete(divisionKey,state,shuffled(rest))){
    state.drawnIds.push(team.id)
    state.currentReveal={team,group}
    state.events.unshift({at:new Date().toISOString(),message:`${team.name} → สาย ${group}`,team,group})
    if(state.drawnIds.length===teams[divisionKey].length) state.status='COMPLETED'
    return state
  }
  state.groups[group].pop()
 }
 throw new Error('ไม่พบรูปแบบการจัดสายที่ผ่านเงื่อนไข กรุณาตรวจสอบกติกา')
}
export function drawAll(divisionKey:DivisionKey){
  let state=states[divisionKey]
  while(state.drawnIds.length<teams[divisionKey].length) state=drawNext(divisionKey)
  return state
}
export function setLock(divisionKey:DivisionKey,locked:boolean){
  const state=states[divisionKey]
  state.locked=locked
  state.status=locked?'LOCKED':(state.drawnIds.length===teams[divisionKey].length?'COMPLETED':state.drawnIds.length?'LIVE':'READY')
  state.events.unshift({at:new Date().toISOString(),message:locked?'ล็อกผลการจับสลาก':'ปลดล็อกผลการจับสลาก'})
  return state
}
