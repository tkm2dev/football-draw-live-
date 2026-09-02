import {DrawStatus,MatchStage,MatchStatus,Prisma,type DivisionType} from '@prisma/client'
import {prisma} from '../db.js'
import type {AuditContext} from './drawService.js'
import type {DivisionKey,GroupCode} from './drawEngine.js'

export type OfficialStage='GROUP'|'QF'|'SF'|'FINAL'|'SPECIAL'
type TeamSource={kind:'TEAM';code:string}|{kind:'LABEL';label:string}
export interface OfficialScheduleTemplate{
  sequenceNo:number
  divisionKey:DivisionKey|null
  categoryLabel:string
  stage:OfficialStage
  groupLabel?:string
  startsAt:string
  endsAt:string
  home:TeamSource
  away:TeamSource
}

const team=(code:string):TeamSource=>({kind:'TEAM',code})
const label=(value:string):TeamSource=>({kind:'LABEL',label:value})
const slot=(sequenceNo:number,divisionKey:DivisionKey|null,categoryLabel:string,stage:OfficialStage,groupLabel:string|undefined,date:string,start:string,end:string,home:TeamSource,away:TeamSource):OfficialScheduleTemplate=>({sequenceNo,divisionKey,categoryLabel,stage,groupLabel,startsAt:`${date}T${start}:00+07:00`,endsAt:`${date}T${end}:00+07:00`,home,away})

export const OFFICIAL_SCHEDULE:OfficialScheduleTemplate[]=[
  slot(1,'PUBLIC','ประชาชน','GROUP','A','2026-09-06','10:00','10:50',team('p3'),team('p4')),
  slot(2,'PUBLIC','ประชาชน','GROUP','B','2026-09-06','10:50','11:40',team('p6'),team('p5')),
  slot(3,'PUBLIC','ประชาชน','GROUP','C','2026-09-06','13:00','13:50',team('p9'),team('p10')),
  slot(4,'PUBLIC','ประชาชน','GROUP','D','2026-09-06','13:50','14:40',team('p11'),team('p12')),
  slot(5,'SENIOR40','อาวุโส 40+','GROUP','D','2026-09-06','14:40','15:30',team('s5'),team('s7')),
  slot(6,'SENIOR40','อาวุโส 40+','GROUP','C','2026-09-06','15:30','16:20',team('s3'),team('s11')),
  slot(7,'SENIOR40','อาวุโส 40+','GROUP','B','2026-09-06','16:20','17:10',team('s1'),team('s10')),
  slot(8,'SENIOR40','อาวุโส 40+','GROUP','A','2026-09-06','17:10','18:00',team('s6'),team('s8')),

  slot(9,'PUBLIC','ประชาชน','GROUP','D','2026-09-12','09:30','10:20',team('p11'),team('p2')),
  slot(10,'PUBLIC','ประชาชน','GROUP','C','2026-09-12','10:20','11:10',team('p9'),team('p8')),
  slot(11,'PUBLIC','ประชาชน','GROUP','B','2026-09-12','11:10','12:00',team('p6'),team('p1')),
  slot(12,'PUBLIC','ประชาชน','GROUP','A','2026-09-12','13:00','13:50',team('p3'),team('p7')),
  slot(13,'SENIOR40','อาวุโส 40+','GROUP','A','2026-09-12','13:50','14:40',team('s9'),team('s8')),
  slot(14,'SENIOR40','อาวุโส 40+','GROUP','D','2026-09-12','14:40','15:30',team('s5'),team('s4')),
  slot(15,'SENIOR40','อาวุโส 40+','GROUP','B','2026-09-12','15:30','16:20',team('s1'),team('s12')),
  slot(16,'SENIOR40','อาวุโส 40+','GROUP','C','2026-09-12','16:20','17:10',team('s3'),team('s2')),
  slot(17,'SENIOR40','อาวุโส 40+','GROUP','A','2026-09-12','17:10','18:00',team('s9'),team('s6')),
  slot(18,'SENIOR40','อาวุโส 40+','GROUP','D','2026-09-12','18:00','18:50',team('s4'),team('s7')),

  slot(19,'PUBLIC','ประชาชน','GROUP','C','2026-09-13','10:00','10:50',team('p10'),team('p8')),
  slot(20,'PUBLIC','ประชาชน','GROUP','B','2026-09-13','10:50','11:40',team('p1'),team('p5')),
  slot(21,'PUBLIC','ประชาชน','GROUP','D','2026-09-13','13:00','13:50',team('p12'),team('p2')),
  slot(22,'PUBLIC','ประชาชน','GROUP','A','2026-09-13','13:50','14:40',team('p4'),team('p7')),
  slot(23,'SENIOR40','อาวุโส 40+','GROUP','B','2026-09-13','14:40','15:30',team('s10'),team('s12')),
  slot(24,'SENIOR40','อาวุโส 40+','GROUP','C','2026-09-13','15:30','16:20',team('s2'),team('s11')),

  slot(25,'PUBLIC','ประชาชน','QF','A-C','2026-09-19','10:00','10:50',label('อันดับ 1 สาย A'),label('อันดับ 2 สาย C')),
  slot(26,'PUBLIC','ประชาชน','QF','A-C','2026-09-19','10:50','11:40',label('อันดับ 1 สาย C'),label('อันดับ 2 สาย A')),
  slot(27,'PUBLIC','ประชาชน','QF','B-D','2026-09-19','13:00','13:50',label('อันดับ 1 สาย B'),label('อันดับ 2 สาย D')),
  slot(28,'PUBLIC','ประชาชน','QF','B-D','2026-09-19','13:50','14:40',label('อันดับ 1 สาย D'),label('อันดับ 2 สาย B')),
  slot(29,'SENIOR40','อาวุโส 40+','QF','A-C','2026-09-19','14:40','15:30',label('อันดับ 1 สาย A'),label('อันดับ 2 สาย C')),
  slot(30,'SENIOR40','อาวุโส 40+','QF','A-C','2026-09-19','15:30','16:20',label('อันดับ 1 สาย C'),label('อันดับ 2 สาย A')),
  slot(31,'SENIOR40','อาวุโส 40+','QF','B-D','2026-09-19','16:20','17:10',label('อันดับ 1 สาย B'),label('อันดับ 2 สาย D')),
  slot(32,'SENIOR40','อาวุโส 40+','QF','B-D','2026-09-19','17:10','18:00',label('อันดับ 1 สาย D'),label('อันดับ 2 สาย B')),

  slot(33,'PUBLIC','ประชาชน','SF',undefined,'2026-09-20','09:00','09:50',label('ผู้ชนะคู่ที่ 25'),label('ผู้ชนะคู่ที่ 27')),
  slot(34,'PUBLIC','ประชาชน','SF',undefined,'2026-09-20','09:50','10:40',label('ผู้ชนะคู่ที่ 26'),label('ผู้ชนะคู่ที่ 28')),
  slot(35,'SENIOR40','อาวุโส 40+','SF',undefined,'2026-09-20','10:40','11:30',label('ผู้ชนะคู่ที่ 29'),label('ผู้ชนะคู่ที่ 31')),
  slot(36,'SENIOR40','อาวุโส 40+','SF',undefined,'2026-09-20','11:30','12:20',label('ผู้ชนะคู่ที่ 30'),label('ผู้ชนะคู่ที่ 32')),
  slot(37,'PUBLIC','ประชาชน','FINAL',undefined,'2026-09-20','13:30','14:20',label('ผู้ชนะคู่ที่ 33'),label('ผู้ชนะคู่ที่ 34')),
  slot(38,null,'คู่พิเศษ','SPECIAL',undefined,'2026-09-20','14:20','15:00',label('Vip หมออลงกต'),label('Vip สภ.ปลาปาก')),
  slot(39,'SENIOR40','อาวุโส 40+','FINAL',undefined,'2026-09-20','15:00','16:00',label('ผู้ชนะคู่ที่ 35'),label('ผู้ชนะคู่ที่ 36')),
]

type ScheduleRow=Prisma.ScheduleEntryGetPayload<{include:{match:{include:{home:true,away:true}}}}>
export interface OfficialScheduleEntry{
  id:string
  sequenceNo:number
  divisionKey:DivisionKey|null
  categoryLabel:string
  stage:OfficialStage
  groupLabel:string|null
  startsAt:string
  endsAt:string
  home:{id?:string;name:string;logoUrl?:string}
  away:{id?:string;name:string;logoUrl?:string}
  homeScore:number|null
  awayScore:number|null
  status:'SCHEDULED'|'LIVE'|'FINISHED'
  field:string
  matchId:string|null
}

const scheduleView=(row:ScheduleRow):OfficialScheduleEntry=>({
  id:String(row.id),sequenceNo:row.sequenceNo,divisionKey:row.divisionType as DivisionKey|null,categoryLabel:row.categoryLabel,stage:row.stage as OfficialStage,groupLabel:row.groupLabel,
  startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
  home:row.match?{id:row.match.home.code,name:row.match.home.name,logoUrl:row.match.home.logoUrl??undefined}:{name:row.homeLabel},
  away:row.match?{id:row.match.away.code,name:row.match.away.name,logoUrl:row.match.away.logoUrl??undefined}:{name:row.awayLabel},
  homeScore:row.match?.homeScore??row.homeScore,awayScore:row.match?.awayScore??row.awayScore,status:row.match?.status??row.status,field:row.match?.field??row.field??'สนามกลาง',matchId:row.matchId?String(row.matchId):null,
})

async function scheduleRows(tx:Prisma.TransactionClient|typeof prisma,tournamentId:number){
  return tx.scheduleEntry.findMany({where:{tournamentId},orderBy:{sequenceNo:'asc'},include:{match:{include:{home:true,away:true}}}})
}

export async function listOfficialSchedule():Promise<OfficialScheduleEntry[]>{
  const tournament=await prisma.tournament.findFirst({orderBy:{id:'desc'}})
  if(!tournament)return[]
  return(await scheduleRows(prisma,tournament.id)).map(scheduleView)
}

export async function installOfficialSchedule(context:AuditContext={}):Promise<OfficialScheduleEntry[]>{
  return prisma.$transaction(async tx=>{
    const tournament=await tx.tournament.findFirst({orderBy:{id:'desc'},include:{divisions:{include:{teams:true,groups:{include:{teams:{include:{team:true}}}},drawSessions:{orderBy:{id:'desc'},take:1}}}}})
    if(!tournament)throw new Error('ไม่พบการแข่งขันในฐานข้อมูล กรุณารัน prisma seed')
    await tx.$queryRaw`SELECT id FROM Tournament WHERE id = ${tournament.id} FOR UPDATE`
    const divisions=new Map(tournament.divisions.map(item=>[item.type as DivisionKey,item]))
    for(const key of ['PUBLIC','SENIOR40'] as DivisionKey[]){
      const div=divisions.get(key)
      if(!div||div.drawSessions[0]?.status!==DrawStatus.LOCKED)throw new Error(`กรุณาล็อกผลแบ่งสาย${key==='PUBLIC'?'รุ่นประชาชน':'รุ่นอาวุโส 40+'}ก่อนติดตั้งตารางทางการ`)
    }
    const divisionIds=tournament.divisions.map(item=>item.id)
    const current=await tx.match.findMany({where:{divisionId:{in:divisionIds}}})
    if(current.some(match=>match.status!==MatchStatus.SCHEDULED||match.homeScore!==null||match.awayScore!==null))throw new Error('มีการแข่งขันที่เริ่มแล้วหรือบันทึกผลแล้ว จึงไม่สามารถติดตั้งตารางทับได้')
    const resolved=OFFICIAL_SCHEDULE.map(entry=>{
      const homeSource=entry.home,awaySource=entry.away
      if(!entry.divisionKey||homeSource.kind!=='TEAM'||awaySource.kind!=='TEAM')return{entry,division:null,home:null,away:null}
      const div=divisions.get(entry.divisionKey)!
      const home=div.teams.find(item=>item.code===homeSource.code),away=div.teams.find(item=>item.code===awaySource.code)
      if(!home||!away)throw new Error(`ไม่พบทีมของคู่ที่ ${entry.sequenceNo} ในฐานข้อมูล`)
      const group=div.groups.find(item=>item.code===entry.groupLabel)
      const members=new Set(group?.teams.map(item=>item.team.code)??[])
      if(!members.has(home.code)||!members.has(away.code))throw new Error(`ผลแบ่งสายปัจจุบันไม่ตรงกับตารางทางการที่คู่ ${entry.sequenceNo} กรุณาตรวจสอบสาย ${entry.groupLabel}`)
      return{entry,division:div,home,away}
    })
    await tx.scheduleEntry.deleteMany({where:{tournamentId:tournament.id}})
    await tx.match.deleteMany({where:{divisionId:{in:divisionIds}}})
    const groupRounds=new Map<string,number>()
    for(const item of resolved){
      const {entry,division,home,away}=item
      let matchId:number|undefined
      if(division&&home&&away){
        const roundKey=`${entry.divisionKey}:${entry.groupLabel}`
        const round=(groupRounds.get(roundKey)??0)+1
        groupRounds.set(roundKey,round)
        const match=await tx.match.create({data:{divisionId:division.id,stage:MatchStage.GROUP,groupCode:entry.groupLabel as GroupCode,round,homeTeamId:home.id,awayTeamId:away.id,kickoffAt:new Date(entry.startsAt),field:'สนามกลาง',status:MatchStatus.SCHEDULED}})
        matchId=match.id
      }
      await tx.scheduleEntry.create({data:{tournamentId:tournament.id,sequenceNo:entry.sequenceNo,divisionType:entry.divisionKey as DivisionType|null,categoryLabel:entry.categoryLabel,stage:entry.stage,groupLabel:entry.groupLabel,startsAt:new Date(entry.startsAt),endsAt:new Date(entry.endsAt),homeLabel:home?.name??(entry.home.kind==='LABEL'?entry.home.label:''),awayLabel:away?.name??(entry.away.kind==='LABEL'?entry.away.label:''),field:'สนามกลาง',matchId}})
    }
    for(const div of tournament.divisions)await tx.auditLog.create({data:{divisionId:div.id,entityType:'OFFICIAL_SCHEDULE',entityId:String(tournament.id),action:'INSTALL_OFFICIAL_SCHEDULE',actor:context.actor,payload:{matches:39,groupMatches:24}}})
    return(await scheduleRows(tx,tournament.id)).map(scheduleView)
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}

export async function updateStandaloneScheduleResult(id:string,homeScore:number|null,awayScore:number|null,status:'SCHEDULED'|'LIVE'|'FINISHED',context:AuditContext={}):Promise<OfficialScheduleEntry>{
  const numericId=Number(id)
  if(!Number.isInteger(numericId))throw new Error('รหัสการแข่งขันไม่ถูกต้อง')
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM ScheduleEntry WHERE id = ${numericId} FOR UPDATE`
    const entry=await tx.scheduleEntry.findUnique({where:{id:numericId}})
    if(!entry)throw new Error('ไม่พบรายการแข่งขัน')
    if(entry.matchId)throw new Error('กรุณาบันทึกผลคู่นี้จากรายการแข่งขันของรุ่น')
    if(entry.stage!=='SPECIAL')throw new Error('ยังไม่สามารถบันทึกผลได้จนกว่าจะทราบทีมแข่งขัน')
    if(status==='FINISHED'&&(homeScore===null||awayScore===null))throw new Error('กรุณากรอกสกอร์ทั้งสองทีมก่อนยืนยันผลการแข่งขัน')
    const updated=await tx.scheduleEntry.update({where:{id:numericId},data:{homeScore,awayScore,status:status as MatchStatus},include:{match:{include:{home:true,away:true}}}})
    const publicDivision=await tx.division.findFirst({where:{tournamentId:entry.tournamentId,type:'PUBLIC'}})
    if(publicDivision)await tx.auditLog.create({data:{divisionId:publicDivision.id,entityType:'SCHEDULE_ENTRY',entityId:id,action:'UPDATE_SPECIAL_RESULT',actor:context.actor,payload:{homeScore,awayScore,status}}})
    return scheduleView(updated)
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}
