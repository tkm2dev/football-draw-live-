import {DrawStatus,MatchStage,MatchStatus,Prisma,type DivisionType,type GroupCode as DbGroupCode} from '@prisma/client'
import {prisma} from '../db.js'
import {GROUP_CODES,type DivisionKey,type GroupCode} from './drawEngine.js'
import type {ApiTeam,AuditContext} from './drawService.js'

export type Match={id:string;divisionKey:DivisionKey;stage:'GROUP'|'QF'|'SF'|'FINAL';group?:GroupCode;round:number;home:ApiTeam;away:ApiTeam;homeScore:number|null;awayScore:number|null;status:'SCHEDULED'|'LIVE'|'FINISHED';kickoffAt:string|null;field:string}
export type Standing={team:ApiTeam;p:number;w:number;d:number;l:number;gf:number;ga:number;gd:number;pts:number;rank:number}
type Tx=Prisma.TransactionClient
type MatchRow=Prisma.MatchGetPayload<{include:{home:true,away:true}}>

const apiTeam=(team:{code:string;name:string;isSeed:boolean}):ApiTeam=>({id:team.code,name:team.name,seed:team.isSeed})
const matchView=(divisionKey:DivisionKey,row:MatchRow):Match=>({id:String(row.id),divisionKey,stage:row.stage,group:row.groupCode as GroupCode|undefined,round:row.round,home:apiTeam(row.home),away:apiTeam(row.away),homeScore:row.homeScore,awayScore:row.awayScore,status:row.status,kickoffAt:row.kickoffAt?.toISOString()??null,field:row.field??'สนามกลาง'})

async function division(tx:Tx,key:DivisionKey){
  const row=await tx.division.findFirst({where:{type:key as DivisionType},orderBy:{tournamentId:'desc'},include:{teams:{orderBy:{sortOrder:'asc'}},groups:{orderBy:{code:'asc'},include:{teams:{orderBy:{drawOrder:'asc'},include:{team:true}}}}}})
  if(!row)throw new Error(`ไม่พบรุ่น ${key} ในฐานข้อมูล กรุณารัน prisma seed`)
  return row
}

async function audit(tx:Tx,divisionId:number,entityType:string,entityId:string,action:string,context:AuditContext,payload?:Prisma.InputJsonValue){
  await tx.auditLog.create({data:{divisionId,entityType,entityId,action,actor:context.actor,payload:payload??undefined}})
}

async function matchRows(tx:Tx,divisionId:number){
  return tx.match.findMany({where:{divisionId},orderBy:[{stage:'asc'},{groupCode:'asc'},{round:'asc'},{id:'asc'}],include:{home:true,away:true}})
}

function tableFor(groups:Awaited<ReturnType<typeof division>>['groups'],matches:MatchRow[]):Record<GroupCode,Standing[]>{
  const table={} as Record<GroupCode,Standing[]>
  for(const code of GROUP_CODES){
    const rows=new Map<string,Standing>()
    const group=groups.find(item=>item.code===code)
    for(const entry of group?.teams??[])rows.set(entry.team.code,{team:apiTeam(entry.team),p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,rank:0})
    for(const match of matches.filter(item=>item.groupCode===code&&item.status===MatchStatus.FINISHED&&item.homeScore!==null&&item.awayScore!==null)){
      const home=rows.get(match.home.code),away=rows.get(match.away.code)
      if(!home||!away)continue
      const homeScore=match.homeScore!,awayScore=match.awayScore!
      home.p++;away.p++;home.gf+=homeScore;home.ga+=awayScore;away.gf+=awayScore;away.ga+=homeScore
      if(homeScore>awayScore){home.w++;away.l++;home.pts+=3}else if(homeScore<awayScore){away.w++;home.l++;away.pts+=3}else{home.d++;away.d++;home.pts++;away.pts++}
    }
    const sorted=[...rows.values()].map(row=>({...row,gd:row.gf-row.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.name.localeCompare(b.team.name,'th'))
    sorted.forEach((row,index)=>row.rank=index+1)
    table[code]=sorted
  }
  return table
}

export async function generateGroupMatches(key:DivisionKey,context:AuditContext={}):Promise<Match[]>{
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM Division WHERE id = ${div.id} FOR UPDATE`
    const session=await tx.drawSession.findFirst({where:{divisionId:div.id},orderBy:{id:'desc'}})
    if(session?.status!==DrawStatus.LOCKED)throw new Error('กรุณาจับครบและล็อกผลอย่างเป็นทางการก่อนสร้างโปรแกรมแข่งขัน')
    for(const group of div.groups)if(group.teams.length!==3)throw new Error(`สาย ${group.code} ยังมีทีมไม่ครบ 3 ทีม`)
    await tx.match.deleteMany({where:{divisionId:div.id}})
    const pairs:[[number,number],[number,number],[number,number]]=[[0,1],[2,0],[1,2]]
    for(const group of div.groups)for(const [index,pair] of pairs.entries())await tx.match.create({data:{divisionId:div.id,stage:MatchStage.GROUP,groupCode:group.code,round:index+1,homeTeamId:group.teams[pair[0]].teamId,awayTeamId:group.teams[pair[1]].teamId,status:MatchStatus.SCHEDULED,field:'สนามกลาง'}})
    await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'GENERATE_GROUP_MATCHES',context,{matches:12})
    return(await matchRows(tx,div.id)).map(row=>matchView(key,row))
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

export async function listMatches(key:DivisionKey):Promise<Match[]>{
  const div=await division(prisma,key)
  return(await matchRows(prisma,div.id)).map(row=>matchView(key,row))
}

export interface MatchPatch{homeScore?:number|null;awayScore?:number|null;status?:'SCHEDULED'|'LIVE'|'FINISHED';kickoffAt?:string|null;field?:string}
export async function updateMatch(key:DivisionKey,id:string,patch:MatchPatch,context:AuditContext={}):Promise<Match>{
  const numericId=Number(id)
  if(!Number.isInteger(numericId))throw new Error('รหัสการแข่งขันไม่ถูกต้อง')
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM Match WHERE id = ${numericId} FOR UPDATE`
    const existing=await tx.match.findFirst({where:{id:numericId,divisionId:div.id}})
    if(!existing)throw new Error('ไม่พบการแข่งขัน')
    const data:Prisma.MatchUpdateInput={}
    if('homeScore'in patch)data.homeScore=patch.homeScore
    if('awayScore'in patch)data.awayScore=patch.awayScore
    if(patch.status)data.status=patch.status as MatchStatus
    if('kickoffAt'in patch)data.kickoffAt=patch.kickoffAt?new Date(patch.kickoffAt):null
    if('field'in patch)data.field=patch.field?.trim()||null
    const nextHome='homeScore'in patch?patch.homeScore:existing.homeScore
    const nextAway='awayScore'in patch?patch.awayScore:existing.awayScore
    if(!patch.status&&nextHome!==null&&nextHome!==undefined&&nextAway!==null&&nextAway!==undefined)data.status=MatchStatus.FINISHED
    const updated=await tx.match.update({where:{id:numericId},data,include:{home:true,away:true}})
    await audit(tx,div.id,'MATCH',id,'UPDATE',context,JSON.parse(JSON.stringify(patch)) as Prisma.InputJsonValue)
    return matchView(key,updated)
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

export async function standings(key:DivisionKey):Promise<Record<GroupCode,Standing[]>>{
  const div=await division(prisma,key)
  return tableFor(div.groups,await matchRows(prisma,div.id))
}

export async function generateKnockout(key:DivisionKey,context:AuditContext={}):Promise<Match[]>{
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM Division WHERE id = ${div.id} FOR UPDATE`
    const current=await matchRows(tx,div.id)
    const table=tableFor(div.groups,current)
    for(const code of GROUP_CODES){
      if(table[code].length!==3)throw new Error('ยังไม่มีทีมครบทุกสาย')
      const groupMatches=current.filter(match=>match.groupCode===code)
      if(groupMatches.length!==3||groupMatches.some(match=>match.status!==MatchStatus.FINISHED))throw new Error(`กรุณากรอกผลสาย ${code} ให้ครบก่อนสร้างรอบ 8 ทีม`)
    }
    await tx.match.deleteMany({where:{divisionId:div.id,stage:{not:MatchStage.GROUP}}})
    const qfPairs:[[Standing,Standing],[Standing,Standing],[Standing,Standing],[Standing,Standing]]=[[table.A[0],table.B[1]],[table.B[0],table.A[1]],[table.C[0],table.D[1]],[table.D[0],table.C[1]]]
    for(const [index,pair] of qfPairs.entries())await tx.match.create({data:{divisionId:div.id,stage:MatchStage.QF,round:index+1,homeTeamId:div.teams.find(team=>team.code===pair[0].team.id)!.id,awayTeamId:div.teams.find(team=>team.code===pair[1].team.id)!.id,status:MatchStatus.SCHEDULED,field:'สนามกลาง'}})
    await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'GENERATE_KNOCKOUT',context,{stage:'QF'})
    return(await matchRows(tx,div.id)).map(row=>matchView(key,row))
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

const winner=(match:MatchRow)=>match.homeScore!>match.awayScore!?match.homeTeamId:match.awayTeamId
export async function advanceKnockout(key:DivisionKey,context:AuditContext={}):Promise<Match[]>{
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM Division WHERE id = ${div.id} FOR UPDATE`
    const rows=await matchRows(tx,div.id)
    const qf=rows.filter(match=>match.stage===MatchStage.QF)
    if(qf.length!==4||qf.some(match=>match.status!==MatchStatus.FINISHED||match.homeScore===match.awayScore))throw new Error('กรุณากรอกผลรอบ 8 ทีมให้ครบและต้องมีผู้ชนะ')
    if(!rows.some(match=>match.stage===MatchStage.SF)){
      await tx.match.createMany({data:[{divisionId:div.id,stage:MatchStage.SF,round:1,homeTeamId:winner(qf[0]),awayTeamId:winner(qf[2]),field:'สนามกลาง'},{divisionId:div.id,stage:MatchStage.SF,round:2,homeTeamId:winner(qf[1]),awayTeamId:winner(qf[3]),field:'สนามกลาง'}]})
      await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'ADVANCE_KNOCKOUT',context,{stage:'SF'})
    }else{
      const sf=rows.filter(match=>match.stage===MatchStage.SF)
      if(sf.length!==2||sf.some(match=>match.status!==MatchStatus.FINISHED||match.homeScore===match.awayScore))throw new Error('กรุณากรอกผลรอบรองชนะเลิศให้ครบและต้องมีผู้ชนะ')
      if(!rows.some(match=>match.stage===MatchStage.FINAL)){
        await tx.match.create({data:{divisionId:div.id,stage:MatchStage.FINAL,round:1,homeTeamId:winner(sf[0]),awayTeamId:winner(sf[1]),field:'สนามกลาง'}})
        await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'ADVANCE_KNOCKOUT',context,{stage:'FINAL'})
      }
    }
    return(await matchRows(tx,div.id)).map(row=>matchView(key,row))
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

export async function summary(key:DivisionKey){
  const div=await division(prisma,key)
  const rows=await matchRows(prisma,div.id)
  const drawn=div.groups.reduce((total,group)=>total+group.teams.length,0)
  return{divisionKey:key,totalTeams:div.teams.length,drawn,groupMatches:rows.filter(match=>match.stage===MatchStage.GROUP).length,finished:rows.filter(match=>match.status===MatchStatus.FINISHED).length,standings:tableFor(div.groups,rows),matches:rows.map(row=>matchView(key,row))}
}
