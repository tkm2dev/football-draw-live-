import { PrismaClient, DivisionType, GroupCode } from '@prisma/client'

const prisma = new PrismaClient()

const publicTeams = ['นาดอกไม้','เพื่อนเเละเพื่อน','PPN','สภ.ปลาปาก','สภ.หนองฮี','นาสีนวล','Npล้านเค้ก','โพนทา FC','Thunder FC.','วังโพธิ์ FC.','วังสิม FC.','มหาชัย']
const seniorTeams = ['สมประสงค์ FC.','เพื่อนเยาวชน','ลาบโต๊ะแดงกำแพงสูง','ปตท.บายพาส นครพนม','PB ธาตุพนม','VIP.เพื่อนปลาปาก','ผึ้งหลวง','สหายอาร์มี่','Safe House','พ่อค้านาแก','โรงพยาบาลนาแก','สหายเรณู']

async function seedDivision(tournamentId:number,type:DivisionType,name:string,subtitle:string,teams:string[]) {
  const division = await prisma.division.upsert({
    where:{ tournamentId_type:{ tournamentId,type } },
    update:{ name,subtitle },
    create:{ tournamentId,type,name,subtitle }
  })
  for (const [sortOrder,teamName] of teams.entries()) {
    await prisma.team.upsert({
      where:{ divisionId_name:{ divisionId:division.id,name:teamName } },
      update:{ sortOrder },
      create:{ divisionId:division.id,name:teamName,sortOrder }
    })
  }
  for (const code of Object.values(GroupCode)) {
    await prisma.group.upsert({ where:{ divisionId_code:{divisionId:division.id,code} }, update:{}, create:{divisionId:division.id,code} })
  }
  return division
}

async function main(){
  let tournament = await prisma.tournament.findFirst({where:{edition:'13/2569'}})
  if (!tournament) tournament = await prisma.tournament.create({data:{name:'ฟุตบอลเฉลิมพระเกียรติ',edition:'13/2569',year:2569}})
  await seedDivision(tournament.id,DivisionType.PUBLIC,'รุ่นประชาชน','ภายในอำเภอปลาปาก',publicTeams)
  await seedDivision(tournament.id,DivisionType.SENIOR40,'รุ่นอาวุโส 40 ปีขึ้นไป','OPEN',seniorTeams)
  await prisma.drawRule.deleteMany({where:{divisionType:DivisionType.SENIOR40,ruleType:'SEPARATE_TEAMS'}})
  await prisma.drawRule.create({data:{divisionType:DivisionType.SENIOR40,ruleType:'SEPARATE_TEAMS',payload:{teams:['เพื่อนเยาวชน','ปตท.บายพาส นครพนม','Safe House']}}})
}

main().finally(()=>prisma.$disconnect())
