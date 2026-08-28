import {randomInt,randomUUID} from 'node:crypto'
import {DrawStatus,Prisma,type DivisionType,type GroupCode as DbGroupCode} from '@prisma/client'
import {prisma} from '../db.js'
import {chooseNextAssignment,emptyAssignments,parseRules,GROUP_CODES,type AssignmentMap,type DivisionKey,type DrawTeam,type GroupCode} from './drawEngine.js'

export interface AuditContext{actor?:string;ip?:string}
export interface ApiTeam{id:string;name:string;seed:boolean}
export interface DrawEventView{id:string;at:string;eventType:string;message:string;team?:ApiTeam;group?:GroupCode;actor?:string}
export interface DrawState{
  sessionId:string;divisionKey:DivisionKey;groups:Record<GroupCode,ApiTeam[]>;drawnIds:string[];totalTeams:number
  teams:ApiTeam[];separateTeamCodes:string[];currentReveal:null|{team:ApiTeam;group:GroupCode};status:'READY'|'LIVE'|'COMPLETED'|'LOCKED';locked:boolean;events:DrawEventView[]
}

type Tx=Prisma.TransactionClient
const dbRandom=()=>randomInt(0,0x100000000)/0x100000000
const apiTeam=(team:{code:string;name:string;isSeed:boolean}):ApiTeam=>({id:team.code,name:team.name,seed:team.isSeed})
const domainTeam=(team:{id:number;code:string;name:string;isSeed:boolean}):DrawTeam=>({id:team.id,code:team.code,name:team.name,seed:team.isSeed})

async function divisionByType(tx:Tx,divisionKey:DivisionKey){
  const division=await tx.division.findFirst({
    where:{type:divisionKey as DivisionType},orderBy:{tournamentId:'desc'},
    include:{teams:{orderBy:{sortOrder:'asc'}},groups:{orderBy:{code:'asc'},include:{teams:{orderBy:{drawOrder:'asc'},include:{team:true}}}}}
  })
  if(!division)throw new Error(`ไม่พบรุ่น ${divisionKey} ในฐานข้อมูล กรุณารัน prisma seed`)
  return division
}

async function currentSession(tx:Tx,divisionId:number){
  // The division row is the stable mutex even while reset creates a new session.
  await tx.$queryRaw`SELECT id FROM Division WHERE id = ${divisionId} FOR UPDATE`
  let session=await tx.drawSession.findFirst({where:{divisionId},orderBy:{id:'desc'}})
  if(!session)session=await tx.drawSession.create({data:{divisionId,status:DrawStatus.READY}})
  return session
}

async function lockSession(tx:Tx,sessionId:number){
  await tx.$queryRaw`SELECT id FROM DrawSession WHERE id = ${sessionId} FOR UPDATE`
}

async function audit(tx:Tx,divisionId:number,entityType:string,entityId:string,action:string,context:AuditContext,payload?:Prisma.InputJsonValue){
  await tx.auditLog.create({data:{divisionId,entityType,entityId,action,actor:context.actor,payload:payload??undefined}})
}

function assignmentMap(division:Awaited<ReturnType<typeof divisionByType>>):AssignmentMap{
  const out=emptyAssignments()
  for(const group of division.groups)out[group.code as GroupCode]=group.teams.map(entry=>domainTeam(entry.team))
  return out
}

function snapshot(assignments:AssignmentMap):Prisma.InputJsonValue{
  return Object.fromEntries(GROUP_CODES.map(code=>[code,assignments[code].map(team=>team.code)]))
}

async function stateInTransaction(tx:Tx,divisionKey:DivisionKey):Promise<DrawState>{
  const division=await divisionByType(tx,divisionKey)
  const session=await currentSession(tx,division.id)
  const separateRule=await tx.drawRule.findFirst({where:{divisionType:division.type,ruleType:'SEPARATE_TEAMS',active:true},orderBy:{id:'desc'}})
  const separateTeamCodes=parseRules(separateRule?[separateRule]:[]).flatMap(rule=>rule.type==='SEPARATE_TEAMS'?rule.teamCodes:[])
  const events=await tx.drawEvent.findMany({where:{drawSessionId:session.id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100,include:{team:true}})
  const groups=Object.fromEntries(GROUP_CODES.map(code=>{
    const row=division.groups.find(group=>group.code===code)
    return[code,row?.teams.map(entry=>apiTeam(entry.team))??[]]
  })) as Record<GroupCode,ApiTeam[]>
  const drawnIds=GROUP_CODES.flatMap(code=>groups[code].map(team=>team.id))
  const reveal=events.find(event=>event.eventType==='DRAW'&&event.team&&event.groupCode)
  return{
    sessionId:String(session.id),divisionKey,groups,drawnIds,totalTeams:division.teams.length,teams:division.teams.map(apiTeam),separateTeamCodes,
    currentReveal:reveal?.team&&reveal.groupCode?{team:apiTeam(reveal.team),group:reveal.groupCode as GroupCode}:null,
    status:session.status,locked:session.status===DrawStatus.LOCKED,
    events:events.map(event=>({id:String(event.id),at:event.createdAt.toISOString(),eventType:event.eventType,message:event.message,team:event.team?apiTeam(event.team):undefined,group:event.groupCode as GroupCode|undefined,actor:event.actor??undefined}))
  }
}

export interface TeamConfigurationInput{code:string;name:string}

export async function updateTeamConfiguration(divisionKey:DivisionKey,teams:TeamConfigurationInput[],separateTeamCodes:string[],context:AuditContext={}):Promise<DrawState>{
  return serializable(async tx=>{
    const division=await divisionByType(tx,divisionKey)
    const session=await currentSession(tx,division.id)
    await lockSession(tx,session.id)
    const assigned=await tx.groupTeam.count({where:{group:{divisionId:division.id}}})
    if(session.status===DrawStatus.LOCKED)throw new Error('ผลถูกล็อกแล้ว กรุณาปลดล็อกก่อนแก้ไขชื่อทีม')
    if(teams.length!==division.teams.length||teams.length!==12)throw new Error('ต้องมีรายชื่อทีมครบ 12 ทีม')
    const existingCodes=new Set(division.teams.map(team=>team.code))
    const incomingCodes=new Set(teams.map(team=>team.code))
    if(incomingCodes.size!==teams.length||[...incomingCodes].some(code=>!existingCodes.has(code)))throw new Error('รหัสทีมไม่ตรงกับรุ่นการแข่งขัน')
    const normalized=teams.map(team=>({code:team.code,name:team.name.trim()}))
    if(normalized.some(team=>!team.name||team.name.length>120))throw new Error('ชื่อทีมต้องมี 1–120 ตัวอักษร')
    if(new Set(normalized.map(team=>team.name.toLocaleLowerCase('th-TH'))).size!==normalized.length)throw new Error('ชื่อทีมต้องไม่ซ้ำกัน')
    if(divisionKey==='SENIOR40'){
      if(separateTeamCodes.length!==3||new Set(separateTeamCodes).size!==3||separateTeamCodes.some(code=>!existingCodes.has(code)))throw new Error('กรุณาเลือกทีมบังคับแยกสายให้ครบ 3 ทีม')
    }else if(separateTeamCodes.length)throw new Error('กติกาทีมบังคับใช้เฉพาะรุ่นอาวุโส')

    const previousTeams=division.teams.map(team=>({code:team.code,name:team.name,seed:team.isSeed}))
    const previousRules=await tx.drawRule.findMany({where:{divisionType:division.type,ruleType:'SEPARATE_TEAMS',active:true}})
    const previousSeparateCodes=parseRules(previousRules).flatMap(rule=>rule.type==='SEPARATE_TEAMS'?rule.teamCodes:[])
    const sameSeparateCodes=[...previousSeparateCodes].sort().join('|')===[...separateTeamCodes].sort().join('|')
    if(assigned>0&&!sameSeparateCodes)throw new Error('เริ่มจับสลากแล้ว แก้ชื่อทีมได้แต่เปลี่ยน 3 ทีมบังคับไม่ได้')
    for(const team of division.teams)await tx.team.update({where:{id:team.id},data:{name:`__editing_${randomUUID()}`}})
    for(const team of normalized){
      const row=division.teams.find(existing=>existing.code===team.code)!
      await tx.team.update({where:{id:row.id},data:{name:team.name,isSeed:divisionKey==='SENIOR40'&&separateTeamCodes.includes(team.code)}})
    }
    if(assigned===0){
      await tx.drawRule.deleteMany({where:{divisionType:division.type,ruleType:'SEPARATE_TEAMS'}})
      if(divisionKey==='SENIOR40')await tx.drawRule.create({data:{divisionType:division.type,ruleType:'SEPARATE_TEAMS',payload:{teamCodes:separateTeamCodes,label:'ทีมบังคับรุ่นอาวุโสต้องอยู่คนละสาย'}}})
    }
    const action=assigned>0?'UPDATE_TEAM_NAMES':'UPDATE_TEAM_CONFIGURATION'
    const message=assigned>0?'แก้ไขชื่อทีมระหว่างพิธี':'แก้ไขรายชื่อทีมและกติกาบังคับ'
    await tx.drawEvent.create({data:{drawSessionId:session.id,eventType:'CONFIG',message,actor:context.actor,metadata:{ip:context.ip??null,separateTeamCodes,assigned}}})
    await audit(tx,division.id,'DIVISION',String(division.id),action,context,{previousTeams,previousRuleIds:previousRules.map(rule=>rule.id),teams:normalized,separateTeamCodes,assigned})
    return stateInTransaction(tx,divisionKey)
  })
}

async function serializable<T>(operation:(tx:Tx)=>Promise<T>):Promise<T>{
  for(let attempt=1;attempt<=3;attempt++){
    try{return await prisma.$transaction(operation,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:15000})}
    catch(error){
      const code=error instanceof Prisma.PrismaClientKnownRequestError?error.code:''
      if(attempt===3||!['P2034','P2028'].includes(code))throw error
    }
  }
  throw new Error('ไม่สามารถเริ่ม transaction ได้')
}

export async function getDrawState(divisionKey:DivisionKey):Promise<DrawState>{
  return prisma.$transaction(tx=>stateInTransaction(tx,divisionKey))
}

async function persistChoice(tx:Tx,division:Awaited<ReturnType<typeof divisionByType>>,sessionId:number,choice:{team:DrawTeam;group:GroupCode},drawOrder:number,context:AuditContext){
  const group=division.groups.find(row=>row.code===choice.group)
  if(!group)throw new Error(`ไม่พบสาย ${choice.group} ในฐานข้อมูล`)
  await tx.groupTeam.create({data:{groupId:group.id,teamId:choice.team.id,drawOrder}})
  const message=`${choice.team.name} → สาย ${choice.group}`
  await tx.drawEvent.create({data:{drawSessionId:sessionId,teamId:choice.team.id,groupCode:choice.group as DbGroupCode,eventType:'DRAW',message,actor:context.actor,metadata:{ip:context.ip??null,drawOrder}}})
  await audit(tx,division.id,'DRAW_SESSION',String(sessionId),'DRAW_TEAM',context,{teamCode:choice.team.code,group:choice.group,drawOrder})
}

export async function resetDraw(divisionKey:DivisionKey,context:AuditContext={}):Promise<DrawState>{
  return serializable(async tx=>{
    const division=await divisionByType(tx,divisionKey)
    const previous=await currentSession(tx,division.id)
    await lockSession(tx,previous.id)
    if(previous.status===DrawStatus.LOCKED)throw new Error('ผลถูกล็อกอยู่ กรุณาปลดล็อกก่อนเริ่มใหม่')
    await tx.match.deleteMany({where:{divisionId:division.id}})
    await tx.groupTeam.deleteMany({where:{group:{divisionId:division.id}}})
    const session=await tx.drawSession.create({data:{divisionId:division.id,status:DrawStatus.READY,events:{create:{eventType:'RESET',message:'เริ่มการจับสลากใหม่',actor:context.actor,metadata:{ip:context.ip??null,previousSessionId:previous.id}}}}})
    await audit(tx,division.id,'DRAW_SESSION',String(session.id),'RESET',context,{previousSessionId:previous.id})
    return stateInTransaction(tx,divisionKey)
  })
}

async function drawInsideTransaction(tx:Tx,divisionKey:DivisionKey,context:AuditContext,all:boolean):Promise<DrawState>{
  let division=await divisionByType(tx,divisionKey)
  const session=await currentSession(tx,division.id)
  await lockSession(tx,session.id)
  if(session.status===DrawStatus.LOCKED)throw new Error('การจับสลากถูกล็อกแล้ว')
  const ruleRows=await tx.drawRule.findMany({where:{divisionType:division.type,active:true},orderBy:{id:'asc'}})
  const rules=parseRules(ruleRows)
  const teams=division.teams.map(domainTeam)
  const assignments=assignmentMap(division)
  let drawOrder=GROUP_CODES.reduce((total,code)=>total+assignments[code].length,0)
  let latest:ReturnType<typeof chooseNextAssignment>=null
  do{
    latest=chooseNextAssignment(teams,assignments,rules,dbRandom)
    if(!latest)break
    drawOrder++
    await persistChoice(tx,division,session.id,latest,drawOrder,context)
    assignments[latest.group].push(latest.team)
  }while(all&&drawOrder<teams.length)
  const completed=drawOrder===teams.length
  await tx.drawSession.update({where:{id:session.id},data:{status:completed?DrawStatus.COMPLETED:drawOrder?DrawStatus.LIVE:DrawStatus.READY,startedAt:session.startedAt??(drawOrder?new Date():null),completedAt:completed?(session.completedAt??new Date()):null,snapshot:snapshot(assignments)}})
  return stateInTransaction(tx,divisionKey)
}

export async function drawNext(divisionKey:DivisionKey,context:AuditContext={}):Promise<DrawState>{
  return serializable(tx=>drawInsideTransaction(tx,divisionKey,context,false))
}

export async function drawAll(divisionKey:DivisionKey,context:AuditContext={}):Promise<DrawState>{
  return serializable(tx=>drawInsideTransaction(tx,divisionKey,context,true))
}

export async function setDrawLock(divisionKey:DivisionKey,locked:boolean,context:AuditContext={}):Promise<DrawState>{
  return serializable(async tx=>{
    const division=await divisionByType(tx,divisionKey)
    const session=await currentSession(tx,division.id)
    await lockSession(tx,session.id)
    const drawn=await tx.groupTeam.count({where:{group:{divisionId:division.id}}})
    if(locked&&drawn!==division.teams.length)throw new Error(`ล็อกผลได้เมื่อจับครบ ${division.teams.length} ทีมแล้วเท่านั้น`)
    const status=locked?DrawStatus.LOCKED:(drawn===division.teams.length?DrawStatus.COMPLETED:drawn?DrawStatus.LIVE:DrawStatus.READY)
    const action=locked?'LOCK':'UNLOCK'
    const message=locked?'ล็อกผลการจับสลากอย่างเป็นทางการ':'ปลดล็อกผลการจับสลาก'
    await tx.drawSession.update({where:{id:session.id},data:{status,lockedAt:locked?new Date():null}})
    await tx.drawEvent.create({data:{drawSessionId:session.id,eventType:action,message,actor:context.actor,metadata:{ip:context.ip??null}}})
    await audit(tx,division.id,'DRAW_SESSION',String(session.id),action,context,{drawn})
    return stateInTransaction(tx,divisionKey)
  })
}
