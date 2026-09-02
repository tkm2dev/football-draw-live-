import {DrawStatus,MatchStage,MatchStatus,Prisma,type DivisionType,type GroupCode as DbGroupCode} from '@prisma/client'
import {prisma} from '../db.js'
import {GROUP_CODES,type DivisionKey,type GroupCode} from './drawEngine.js'
import type {ApiTeam,AuditContext} from './drawService.js'

export type Match={id:string;divisionKey:DivisionKey;stage:'GROUP'|'QF'|'SF'|'FINAL';group?:GroupCode;round:number;home:ApiTeam;away:ApiTeam;homeScore:number|null;awayScore:number|null;status:'SCHEDULED'|'LIVE'|'FINISHED';kickoffAt:string|null;field:string}
export type Standing={team:ApiTeam;p:number;w:number;d:number;l:number;gf:number;ga:number;gd:number;pts:number;rank:number}
type Tx=Prisma.TransactionClient
type MatchRow=Prisma.MatchGetPayload<{include:{home:true,away:true}}>

const apiTeam=(team:{code:string;name:string;isSeed:boolean;logoUrl:string|null}):ApiTeam=>({id:team.code,name:team.name,seed:team.isSeed,logoUrl:team.logoUrl??undefined})
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
    const existing=await matchRows(tx,div.id)
    if(existing.some(match=>match.status!==MatchStatus.SCHEDULED||match.homeScore!==null||match.awayScore!==null))throw new Error('มีผลการแข่งขันแล้ว ไม่สามารถสร้างโปรแกรมทับได้')
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

export interface MatchScheduleInput{id:string;homeTeamCode:string;awayTeamCode:string;kickoffAt:string|null;field:string}
export async function updateMatchSchedule(key:DivisionKey,inputs:MatchScheduleInput[],context:AuditContext={}):Promise<Match[]>{
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM Division WHERE id = ${div.id} FOR UPDATE`
    const ids=inputs.map(input=>Number(input.id))
    if(ids.some(id=>!Number.isInteger(id))||new Set(ids).size!==ids.length)throw new Error('รายการแข่งขันซ้ำหรือรหัสไม่ถูกต้อง')
    const rows=await matchRows(tx,div.id)
    const rowById=new Map(rows.map(row=>[row.id,row]))
    const teamByCode=new Map(div.teams.map(team=>[team.code,team]))
    const changes=new Map<number,{homeTeamId:number;awayTeamId:number;kickoffAt:Date|null;field:string|null}>()
    for(const input of inputs){
      const id=Number(input.id),row=rowById.get(id)
      if(!row)throw new Error(`ไม่พบการแข่งขัน ${input.id}`)
      const home=teamByCode.get(input.homeTeamCode),away=teamByCode.get(input.awayTeamCode)
      if(!home||!away)throw new Error('ทีมแข่งขันไม่อยู่ในรุ่นนี้')
      if(home.id===away.id)throw new Error('ทีมเหย้าและทีมเยือนต้องเป็นคนละทีม')
      if((home.id!==row.homeTeamId||away.id!==row.awayTeamId)&&(row.status!==MatchStatus.SCHEDULED||row.homeScore!==null||row.awayScore!==null))throw new Error('ไม่สามารถเปลี่ยนคู่แข่งขันของนัดที่เริ่มแข่งขันหรือมีผลแล้ว')
      if(row.stage===MatchStage.GROUP){
        const group=div.groups.find(item=>item.code===row.groupCode)
        const members=new Set(group?.teams.map(entry=>entry.teamId)??[])
        if(!members.has(home.id)||!members.has(away.id))throw new Error(`คู่แข่งขันนัดสาย ${row.groupCode} ต้องเลือกจากทีมในสายเดียวกัน`)
      }
      const kickoffAt=input.kickoffAt?new Date(input.kickoffAt):null
      if(kickoffAt&&Number.isNaN(kickoffAt.getTime()))throw new Error('วันเวลาแข่งขันไม่ถูกต้อง')
      changes.set(id,{homeTeamId:home.id,awayTeamId:away.id,kickoffAt,field:input.field.trim()||null})
    }
    const planned=rows.map(row=>({id:row.id,stage:row.stage,groupCode:row.groupCode,homeTeamId:changes.get(row.id)?.homeTeamId??row.homeTeamId,awayTeamId:changes.get(row.id)?.awayTeamId??row.awayTeamId}))
    for(const code of GROUP_CODES){
      const matches=planned.filter(row=>row.stage===MatchStage.GROUP&&row.groupCode===code)
      if(!matches.length)continue
      if(matches.length!==3)throw new Error(`โปรแกรมสาย ${code} ต้องมี 3 นัด`)
      const pairs=new Set(matches.map(match=>[match.homeTeamId,match.awayTeamId].sort((a,b)=>a-b).join(':')))
      const appearances=new Map<number,number>()
      for(const match of matches){appearances.set(match.homeTeamId,(appearances.get(match.homeTeamId)??0)+1);appearances.set(match.awayTeamId,(appearances.get(match.awayTeamId)??0)+1)}
      if(pairs.size!==3||[...appearances.values()].some(count=>count!==2)||appearances.size!==3)throw new Error(`โปรแกรมสาย ${code} ต้องพบกันครบทุกคู่และห้ามมีคู่ซ้ำ`)
    }
    for(const [id,data] of changes){
      await tx.match.update({where:{id},data})
      const linked=await tx.scheduleEntry.findUnique({where:{matchId:id}})
      if(linked){
        const duration=linked.endsAt.getTime()-linked.startsAt.getTime()
        const home=div.teams.find(team=>team.id===data.homeTeamId)!,away=div.teams.find(team=>team.id===data.awayTeamId)!
        await tx.scheduleEntry.update({where:{id:linked.id},data:{homeLabel:home.name,awayLabel:away.name,startsAt:data.kickoffAt??linked.startsAt,endsAt:data.kickoffAt?new Date(data.kickoffAt.getTime()+duration):linked.endsAt,field:data.field}})
      }
    }
    await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'UPDATE_MATCH_SCHEDULE',context,{matchIds:ids,count:ids.length})
    return(await matchRows(tx,div.id)).map(row=>matchView(key,row))
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

export interface MatchPatch{homeScore?:number|null;awayScore?:number|null;status?:'SCHEDULED'|'LIVE'|'FINISHED';kickoffAt?:string|null;field?:string}
export async function updateMatch(key:DivisionKey,id:string,patch:MatchPatch,context:AuditContext={}):Promise<Match>{
  const numericId=Number(id)
  if(!Number.isInteger(numericId))throw new Error('รหัสการแข่งขันไม่ถูกต้อง')
  return prisma.$transaction(async tx=>{
    const div=await division(tx,key)
    await tx.$queryRaw`SELECT id FROM \`Match\` WHERE id = ${numericId} FOR UPDATE`
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
    const nextStatus=patch.status??(nextHome!==null&&nextHome!==undefined&&nextAway!==null&&nextAway!==undefined?'FINISHED':existing.status)
    if(nextStatus==='FINISHED'&&(nextHome===null||nextHome===undefined||nextAway===null||nextAway===undefined))throw new Error('กรุณากรอกสกอร์ทั้งสองทีมก่อนยืนยันผลการแข่งขัน')
    if(!patch.status&&nextHome!==null&&nextHome!==undefined&&nextAway!==null&&nextAway!==undefined)data.status=MatchStatus.FINISHED
    const updated=await tx.match.update({where:{id:numericId},data,include:{home:true,away:true}})
    const schedule=await tx.scheduleEntry.findUnique({where:{matchId:numericId}})
    if(schedule){
      const scheduleData:Prisma.ScheduleEntryUpdateInput={homeScore:updated.homeScore,awayScore:updated.awayScore,status:updated.status,field:updated.field}
      if(updated.kickoffAt){
        const duration=schedule.endsAt.getTime()-schedule.startsAt.getTime()
        scheduleData.startsAt=updated.kickoffAt
        scheduleData.endsAt=new Date(updated.kickoffAt.getTime()+duration)
      }
      await tx.scheduleEntry.update({where:{id:schedule.id},data:scheduleData})
    }
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
    const qfPairs:[[Standing,Standing],[Standing,Standing],[Standing,Standing],[Standing,Standing]]=[[table.A[0],table.C[1]],[table.C[0],table.A[1]],[table.B[0],table.D[1]],[table.D[0],table.B[1]]]
    const scheduleNos=key==='PUBLIC'?[25,26,27,28]:[29,30,31,32]
    const slots=await tx.scheduleEntry.findMany({where:{tournamentId:div.tournamentId,sequenceNo:{in:scheduleNos}}})
    for(const [index,pair] of qfPairs.entries()){
      const home=div.teams.find(team=>team.code===pair[0].team.id)!,away=div.teams.find(team=>team.code===pair[1].team.id)!,slot=slots.find(item=>item.sequenceNo===scheduleNos[index])
      const created=await tx.match.create({data:{divisionId:div.id,stage:MatchStage.QF,round:index+1,homeTeamId:home.id,awayTeamId:away.id,status:MatchStatus.SCHEDULED,kickoffAt:slot?.startsAt,field:slot?.field??'สนามกลาง'}})
      if(slot)await tx.scheduleEntry.update({where:{id:slot.id},data:{matchId:created.id,homeLabel:home.name,awayLabel:away.name,homeScore:null,awayScore:null,status:MatchStatus.SCHEDULED}})
    }
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
    const qf=rows.filter(match=>match.stage===MatchStage.QF).sort((a,b)=>a.round-b.round)
    if(qf.length!==4||qf.some(match=>match.status!==MatchStatus.FINISHED||match.homeScore===match.awayScore))throw new Error('กรุณากรอกผลรอบ 8 ทีมให้ครบและต้องมีผู้ชนะ')
    if(!rows.some(match=>match.stage===MatchStage.SF)){
      const sfPairs=[[winner(qf[0]),winner(qf[2])],[winner(qf[1]),winner(qf[3])]] as const
      const scheduleNos=key==='PUBLIC'?[33,34]:[35,36]
      const slots=await tx.scheduleEntry.findMany({where:{tournamentId:div.tournamentId,sequenceNo:{in:scheduleNos}}})
      for(const [index,pair] of sfPairs.entries()){
        const slot=slots.find(item=>item.sequenceNo===scheduleNos[index]),home=div.teams.find(team=>team.id===pair[0])!,away=div.teams.find(team=>team.id===pair[1])!
        const created=await tx.match.create({data:{divisionId:div.id,stage:MatchStage.SF,round:index+1,homeTeamId:home.id,awayTeamId:away.id,kickoffAt:slot?.startsAt,field:slot?.field??'สนามกลาง'}})
        if(slot)await tx.scheduleEntry.update({where:{id:slot.id},data:{matchId:created.id,homeLabel:home.name,awayLabel:away.name,homeScore:null,awayScore:null,status:MatchStatus.SCHEDULED}})
      }
      await audit(tx,div.id,'MATCH_SCHEDULE',String(div.id),'ADVANCE_KNOCKOUT',context,{stage:'SF'})
    }else{
      const sf=rows.filter(match=>match.stage===MatchStage.SF).sort((a,b)=>a.round-b.round)
      if(sf.length!==2||sf.some(match=>match.status!==MatchStatus.FINISHED||match.homeScore===match.awayScore))throw new Error('กรุณากรอกผลรอบรองชนะเลิศให้ครบและต้องมีผู้ชนะ')
      if(!rows.some(match=>match.stage===MatchStage.FINAL)){
        const scheduleNo=key==='PUBLIC'?37:39
        const slot=await tx.scheduleEntry.findFirst({where:{tournamentId:div.tournamentId,sequenceNo:scheduleNo}})
        const home=div.teams.find(team=>team.id===winner(sf[0]))!,away=div.teams.find(team=>team.id===winner(sf[1]))!
        const created=await tx.match.create({data:{divisionId:div.id,stage:MatchStage.FINAL,round:1,homeTeamId:home.id,awayTeamId:away.id,kickoffAt:slot?.startsAt,field:slot?.field??'สนามกลาง'}})
        if(slot)await tx.scheduleEntry.update({where:{id:slot.id},data:{matchId:created.id,homeLabel:home.name,awayLabel:away.name,homeScore:null,awayScore:null,status:MatchStatus.SCHEDULED}})
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
