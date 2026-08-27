import type { DivisionKey, Group, Team } from '../data.js'
import { teams } from '../data.js'
import { states } from './drawEngine.js'

export type MatchStatus='SCHEDULED'|'LIVE'|'FINISHED'
export type Stage='GROUP'|'QF'|'SF'|'FINAL'
export type Match={id:string;divisionKey:DivisionKey;stage:Stage;group?:Group;round:number;home:Team;away:Team;homeScore:number|null;awayScore:number|null;status:MatchStatus;kickoffAt:string|null;field:string}
export type Standing={team:Team;p:number;w:number;d:number;l:number;gf:number;ga:number;gd:number;pts:number;rank:number}
const matches:Record<DivisionKey,Match[]>={PUBLIC:[],SENIOR40:[]}
const brackets:Record<DivisionKey,Match[]>={PUBLIC:[],SENIOR40:[]}

export function generateGroupMatches(k:DivisionKey){
 const out:Match[]=[]
 ;(['A','B','C','D'] as Group[]).forEach(g=>{
  const ts=states[k].groups[g]
  if(ts.length!==3) throw new Error(`สาย ${g} ยังมีทีมไม่ครบ 3 ทีม`)
  const pairs:[[number,number],[number,number],[number,number]]=[[0,1],[2,0],[1,2]]
  pairs.forEach((p,i)=>out.push({id:`${k}-${g}-${i+1}`,divisionKey:k,stage:'GROUP',group:g,round:i+1,home:ts[p[0]],away:ts[p[1]],homeScore:null,awayScore:null,status:'SCHEDULED',kickoffAt:null,field:'สนามกลาง'}))
 })
 matches[k]=out; brackets[k]=[]; return out
}
export function listMatches(k:DivisionKey){return [...matches[k],...brackets[k]]}
export function updateMatch(k:DivisionKey,id:string,patch:Partial<Pick<Match,'homeScore'|'awayScore'|'status'|'kickoffAt'|'field'>>){
 const m=listMatches(k).find(x=>x.id===id); if(!m) throw new Error('ไม่พบการแข่งขัน')
 Object.assign(m,patch)
 if(m.homeScore!==null&&m.awayScore!==null&&patch.status===undefined)m.status='FINISHED'
 return m
}
export function standings(k:DivisionKey):Record<Group,Standing[]>{
 const table={} as Record<Group,Standing[]>
 ;(['A','B','C','D'] as Group[]).forEach(g=>{
  const rows=new Map<string,Standing>(); states[k].groups[g].forEach(t=>rows.set(t.id,{team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,rank:0}))
  matches[k].filter(m=>m.group===g&&m.status==='FINISHED'&&m.homeScore!==null&&m.awayScore!==null).forEach(m=>{
   const h=rows.get(m.home.id)!,a=rows.get(m.away.id)!; const hs=m.homeScore!,as=m.awayScore!; h.p++;a.p++;h.gf+=hs;h.ga+=as;a.gf+=as;a.ga+=hs
   if(hs>as){h.w++;a.l++;h.pts+=3}else if(hs<as){a.w++;h.l++;a.pts+=3}else{h.d++;a.d++;h.pts++;a.pts++}
  })
  const sorted=[...rows.values()].map(r=>({...r,gd:r.gf-r.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.name.localeCompare(b.team.name,'th'))
  sorted.forEach((r,i)=>r.rank=i+1); table[g]=sorted
 })
 return table
}
export function generateKnockout(k:DivisionKey){
 const st=standings(k); for(const g of ['A','B','C','D'] as Group[]) if(st[g].length<2) throw new Error('ยังไม่มีอันดับทีมครบทุกสาย')
 const qfPairs:[[Standing,Standing],[Standing,Standing],[Standing,Standing],[Standing,Standing]]=[[st.A[0],st.B[1]],[st.B[0],st.A[1]],[st.C[0],st.D[1]],[st.D[0],st.C[1]]]
 brackets[k]=qfPairs.map((p,i)=>({id:`${k}-QF-${i+1}`,divisionKey:k,stage:'QF',round:1,home:p[0].team,away:p[1].team,homeScore:null,awayScore:null,status:'SCHEDULED',kickoffAt:null,field:'สนามกลาง'}))
 return brackets[k]
}
export function advanceKnockout(k:DivisionKey){
 const b=brackets[k]; const qf=b.filter(m=>m.stage==='QF'); if(qf.length!==4||qf.some(m=>m.status!=='FINISHED'||m.homeScore===m.awayScore)) throw new Error('กรุณากรอกผลรอบ 8 ทีมให้ครบและต้องมีผู้ชนะ')
 const winner=(m:Match)=>m.homeScore!>m.awayScore!?m.home:m.away
 if(!b.some(m=>m.stage==='SF')){b.push({id:`${k}-SF-1`,divisionKey:k,stage:'SF',round:1,home:winner(qf[0]),away:winner(qf[2]),homeScore:null,awayScore:null,status:'SCHEDULED',kickoffAt:null,field:'สนามกลาง'},{id:`${k}-SF-2`,divisionKey:k,stage:'SF',round:1,home:winner(qf[1]),away:winner(qf[3]),homeScore:null,awayScore:null,status:'SCHEDULED',kickoffAt:null,field:'สนามกลาง'});return b}
 const sf=b.filter(m=>m.stage==='SF'); if(sf.some(m=>m.status!=='FINISHED'||m.homeScore===m.awayScore)) throw new Error('กรุณากรอกผลรอบรองชนะเลิศให้ครบและต้องมีผู้ชนะ')
 if(!b.some(m=>m.stage==='FINAL')) b.push({id:`${k}-FINAL`,divisionKey:k,stage:'FINAL',round:1,home:winner(sf[0]),away:winner(sf[1]),homeScore:null,awayScore:null,status:'SCHEDULED',kickoffAt:null,field:'สนามกลาง'})
 return b
}
export function summary(k:DivisionKey){return {divisionKey:k,totalTeams:teams[k].length,drawn:states[k].drawnIds.length,groupMatches:matches[k].length,finished:matches[k].filter(m=>m.status==='FINISHED').length,standings:standings(k),matches:listMatches(k)}}
