// Applies the official drawn quarter-final bracket (คู่ 25–32) to the EXISTING database:
// the drawn home/away pairing and the 19 Sept kickoff times, for the current tournament.
//
// It is deliberately conservative:
//   * only touches schedule entries 25–32 (quarter-finals); group, SF, FINAL and the
//     special fixture are never modified,
//   * refuses to change any quarter-final that already kicked off or has a score,
//   * is idempotent — running it again after it succeeds is a no-op,
//   * prints the plan and does nothing unless CONFIRM_KNOCKOUT_UPDATE=YES is set.
//
// Usage (on the VPS, with apps/api/.env providing DATABASE_URL):
//   npm run apply:knockout            # dry-run: prints the plan
//   CONFIRM_KNOCKOUT_UPDATE=YES npm run apply:knockout   # apply
import {PrismaClient,MatchStatus,type DivisionType} from '@prisma/client'

const prisma=new PrismaClient()
const APPLY=process.env.CONFIRM_KNOCKOUT_UPDATE==='YES'
const DATE='2026-09-19'
const TZ='+07:00'

// The drawn quarter-final bracket. PUBLIC (25–28) already matches the draw; SENIOR40
// (29–32) is corrected here — เพื่อนเยาวชน (s2) and โรงพยาบาลนาแก (s11) swap between คู่ 29/30
// and ผึ้งหลวง (s7) plays คู่ 31 in place of PB ธาตุพนม (s5).
const QF:{no:number;div:DivisionType;home:string;away:string;start:string;end:string}[]=[
  {no:25,div:'PUBLIC',home:'p3',away:'p10',start:'10:00',end:'10:40'},
  {no:26,div:'PUBLIC',home:'p8',away:'p7',start:'10:40',end:'11:20'},
  {no:27,div:'PUBLIC',home:'p1',away:'p12',start:'11:20',end:'12:00'},
  {no:28,div:'PUBLIC',home:'p2',away:'p5',start:'13:00',end:'13:50'},
  {no:29,div:'SENIOR40',home:'s9',away:'s2',start:'13:50',end:'14:40'},
  {no:30,div:'SENIOR40',home:'s11',away:'s6',start:'14:40',end:'15:30'},
  {no:31,div:'SENIOR40',home:'s10',away:'s7',start:'15:30',end:'16:20'},
  {no:32,div:'SENIOR40',home:'s4',away:'s1',start:'16:20',end:'17:10'},
]

async function main(){
  const tournament=await prisma.tournament.findFirst({orderBy:{id:'desc'}})
  if(!tournament)throw new Error('ไม่พบการแข่งขันในฐานข้อมูล')
  console.log(`Tournament #${tournament.id} — ${tournament.name} (${tournament.edition}/${tournament.year})`)
  console.log(APPLY?'MODE: APPLY (จะบันทึกการเปลี่ยนแปลง)':'MODE: DRY-RUN (ยังไม่บันทึก — ตั้ง CONFIRM_KNOCKOUT_UPDATE=YES เพื่อบันทึก)')
  let changes=0,skipped=0
  for(const cfg of QF){
    const division=await prisma.division.findFirst({where:{tournamentId:tournament.id,type:cfg.div}})
    if(!division){console.warn(`  คู่ ${cfg.no}: ไม่พบรุ่น ${cfg.div}`);skipped++;continue}
    const [home,away]=await Promise.all([
      prisma.team.findFirst({where:{divisionId:division.id,code:cfg.home}}),
      prisma.team.findFirst({where:{divisionId:division.id,code:cfg.away}}),
    ])
    if(!home||!away){console.warn(`  คู่ ${cfg.no}: ไม่พบทีม ${cfg.home}/${cfg.away} ในรุ่น ${cfg.div}`);skipped++;continue}
    const entry=await prisma.scheduleEntry.findFirst({where:{tournamentId:tournament.id,sequenceNo:cfg.no},include:{match:true}})
    if(!entry||!entry.match){console.warn(`  คู่ ${cfg.no}: ยังไม่มี match ผูกกับตาราง — ข้าม (ต้องสร้างรอบ 8 ทีมก่อน)`);skipped++;continue}
    const match=entry.match
    if(match.status!==MatchStatus.SCHEDULED||match.homeScore!==null||match.awayScore!==null){
      console.warn(`  คู่ ${cfg.no}: มีผล/เริ่มแข่งแล้ว — ข้ามเพื่อไม่ทับข้อมูล`);skipped++;continue
    }
    const startsAt=new Date(`${DATE}T${cfg.start}:00${TZ}`)
    const endsAt=new Date(`${DATE}T${cfg.end}:00${TZ}`)
    const pairingChange=match.homeTeamId!==home.id||match.awayTeamId!==away.id
    const timeChange=match.kickoffAt?.getTime()!==startsAt.getTime()||entry.startsAt.getTime()!==startsAt.getTime()||entry.endsAt.getTime()!==endsAt.getTime()
    if(!pairingChange&&!timeChange){console.log(`  คู่ ${cfg.no}: ตรงอยู่แล้ว (${home.name} vs ${away.name}, ${cfg.start}-${cfg.end})`);continue}
    console.log(`  คู่ ${cfg.no}: ${home.name} vs ${away.name} @ ${cfg.start}-${cfg.end}${pairingChange?' [แก้คู่แข่ง]':''}${timeChange?' [แก้เวลา]':''}`)
    changes++
    if(APPLY){
      await prisma.$transaction([
        prisma.match.update({where:{id:match.id},data:{homeTeamId:home.id,awayTeamId:away.id,kickoffAt:startsAt}}),
        prisma.scheduleEntry.update({where:{id:entry.id},data:{homeLabel:home.name,awayLabel:away.name,startsAt,endsAt}}),
        prisma.auditLog.create({data:{divisionId:division.id,entityType:'MATCH',entityId:String(match.id),action:'APPLY_KNOCKOUT_DRAW',actor:'apply-knockout-draw',payload:{sequenceNo:cfg.no,home:cfg.home,away:cfg.away,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()}}}),
      ])
    }
  }
  console.log(`\nสรุป: ต้องปรับ ${changes} คู่, ข้าม ${skipped} คู่.`)
  if(!APPLY&&changes>0)console.log('ยังไม่ได้บันทึก — รันซ้ำด้วย CONFIRM_KNOCKOUT_UPDATE=YES เพื่อยืนยัน')
}

main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect())
