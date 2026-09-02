import {execFileSync} from 'node:child_process'
import {afterAll,beforeAll,describe,expect,it} from 'vitest'

const testDatabase=process.env.TEST_DATABASE_URL
const integration=describe.skipIf(!testDatabase)

integration('Prisma/MySQL draw and match persistence',()=>{
  beforeAll(async()=>{
    process.env.DATABASE_URL=testDatabase
    const runNpx=(args:string[])=>{
      const command=process.platform==='win32'?(process.env.ComSpec??'cmd.exe'):'npx'
      const commandArgs=process.platform==='win32'?['/d','/s','/c','npx',...args]:args
      execFileSync(command,commandArgs,{cwd:new URL('../../../../../',import.meta.url),env:process.env,stdio:'pipe'})
    }
    runNpx(['prisma','migrate','reset','--force','--skip-seed'])
    runNpx(['tsx','prisma/seed.ts'])
  },60_000)

  afterAll(async()=>{
    const {disconnectDb}=await import('../../db.js')
    await disconnectDb()
  })

  it('updates team names and the three senior separation teams with an audit entry',async()=>{
    const {getDrawState,updateTeamConfiguration,updateTeamLogo}=await import('../drawService.js')
    const {prisma}=await import('../../db.js')
    const initial=await getDrawState('SENIOR40')
    const teams=initial.teams.map(team=>({code:team.id,name:team.id==='s1'?'สมประสงค์ ยูไนเต็ด':team.name}))
    const updated=await updateTeamConfiguration('SENIOR40',teams,['s1','s4','s9'],{actor:'integration-test'})
    expect(updated.teams.find(team=>team.id==='s1')?.name).toBe('สมประสงค์ ยูไนเต็ด')
    expect(updated.separateTeamCodes).toEqual(['s1','s4','s9'])
    expect(await prisma.team.count({where:{division:{type:'SENIOR40'},isSeed:true}})).toBe(3)
    expect(await prisma.auditLog.count({where:{action:'UPDATE_TEAM_CONFIGURATION'}})).toBe(1)
    const logoUrl='/uploads/team-logos/550e8400-e29b-41d4-a716-446655440000.png'
    const logo=await updateTeamLogo('SENIOR40','s1',logoUrl,{actor:'integration-test'})
    expect(logo.state.teams.find(team=>team.id==='s1')?.logoUrl).toBe(logoUrl)
    expect(await prisma.auditLog.count({where:{action:'UPDATE_TEAM_LOGO'}})).toBe(1)
  })

  it('commits assignments, session events, snapshots and audit rows atomically',async()=>{
    const {commitPlannedDraw,drawAll,getDrawState,planNextDraw,resetDraw,setDrawLock,updateTeamConfiguration}=await import('../drawService.js')
    const {prisma,disconnectDb}=await import('../../db.js')
    await resetDraw('SENIOR40',{actor:'integration-test'})
    const planned=await planNextDraw('SENIOR40')
    expect(planned.candidates.map(team=>team.id).sort()).toEqual(Array.from({length:12},(_,index)=>`s${index+1}`).sort())
    expect(await prisma.groupTeam.count()).toBe(0)
    const first=await commitPlannedDraw('SENIOR40',planned.plan,{actor:'integration-test'})
    expect(first.drawnIds).toHaveLength(1)
    const completed=await drawAll('SENIOR40',{actor:'integration-test'})
    expect(completed.drawnIds).toHaveLength(12)
    expect(Object.values(completed.groups).every(group=>group.length===3)).toBe(true)
    expect(await prisma.groupTeam.count()).toBe(12)
    expect(await prisma.drawEvent.count({where:{eventType:'DRAW'}})).toBe(12)
    expect(await prisma.auditLog.count({where:{action:'DRAW_TEAM'}})).toBe(12)
    const separated=Object.entries(completed.groups).filter(([,teams])=>teams.some(team=>['s1','s4','s9'].includes(team.id))).map(([group])=>group)
    expect(new Set(separated).size).toBe(3)
    const renamed=completed.teams.map(team=>({code:team.id,name:team.id==='s2'?'เพื่อนเยาวชน VIP':team.name}))
    const renamedState=await updateTeamConfiguration('SENIOR40',renamed,['s1','s4','s9'],{actor:'integration-test'})
    expect(renamedState.teams.find(team=>team.id==='s2')?.name).toBe('เพื่อนเยาวชน VIP')
    await expect(updateTeamConfiguration('SENIOR40',renamed,['s2','s4','s9'],{actor:'integration-test'})).rejects.toThrow(/เปลี่ยน 3 ทีมบังคับไม่ได้/)
    expect(await prisma.auditLog.count({where:{action:'UPDATE_TEAM_NAMES'}})).toBe(1)
    await setDrawLock('SENIOR40',true,{actor:'integration-test'})
    await disconnectDb()
    const restored=await getDrawState('SENIOR40')
    expect(restored.status).toBe('LOCKED')
    expect(restored.drawnIds).toHaveLength(12)
  })

  it('persists the generated 12-match group schedule',async()=>{
    const {generateGroupMatches,listMatches,standings,updateMatch,updateMatchSchedule}=await import('../tournamentEngine.js')
    const generated=await generateGroupMatches('SENIOR40',{actor:'integration-test'})
    expect(generated).toHaveLength(12)
    const firstKickoff=new Date('2026-12-01T02:00:00.000Z')
    const duplicatePair=generated.map((match,index)=>({id:match.id,homeTeamCode:index===0?generated[1].home.id:match.home.id,awayTeamCode:index===0?generated[1].away.id:match.away.id,kickoffAt:null,field:'สนามกลาง'}))
    await expect(updateMatchSchedule('SENIOR40',duplicatePair,{actor:'integration-test'})).rejects.toThrow(/คู่ซ้ำ/)
    const scheduled=await updateMatchSchedule('SENIOR40',generated.map((match,index)=>({id:match.id,homeTeamCode:match.home.id,awayTeamCode:match.away.id,kickoffAt:new Date(firstKickoff.getTime()+index*40*60_000).toISOString(),field:index%2?'สนาม 2':'สนาม 1'})),{actor:'integration-test'})
    expect(scheduled).toHaveLength(12)
    expect(scheduled[0].kickoffAt).toBe(firstKickoff.toISOString())
    expect(scheduled.every(match=>Boolean(match.field))).toBe(true)
    expect(scheduled.some(match=>match.home.logoUrl||match.away.logoUrl)).toBe(true)
    const first=scheduled[0]
    await expect(updateMatch('SENIOR40',first.id,{status:'FINISHED',homeScore:null,awayScore:null},{actor:'integration-test'})).rejects.toThrow(/กรอกสกอร์/)
    await updateMatch('SENIOR40',first.id,{status:'FINISHED',homeScore:2,awayScore:1},{actor:'integration-test'})
    const table=await standings('SENIOR40')
    expect(table[first.group!].find(row=>row.team.id===first.home.id)?.pts).toBe(3)
    expect((await listMatches('SENIOR40')).filter(match=>match.status==='FINISHED')).toHaveLength(1)
  })

  it('installs and links the complete 39-match official timetable atomically',async()=>{
    const {drawAll,resetDraw,setDrawLock,updateTeamLogo}=await import('../drawService.js')
    const {installOfficialSchedule,listOfficialSchedule}=await import('../officialSchedule.js')
    const {updateMatch}=await import('../tournamentEngine.js')
    const {prisma}=await import('../../db.js')
    await resetDraw('PUBLIC',{actor:'integration-test'})
    await drawAll('PUBLIC',{actor:'integration-test'})
    await setDrawLock('PUBLIC',true,{actor:'integration-test'})
    await prisma.match.deleteMany()
    await prisma.groupTeam.deleteMany()
    const assignments={PUBLIC:{A:['p3','p4','p7'],B:['p6','p1','p5'],C:['p9','p10','p8'],D:['p11','p12','p2']},SENIOR40:{A:['s9','s6','s8'],B:['s1','s10','s12'],C:['s3','s2','s11'],D:['s5','s4','s7']}} as const
    for(const [divisionType,groups] of Object.entries(assignments)){
      const div=await prisma.division.findFirstOrThrow({where:{type:divisionType as 'PUBLIC'|'SENIOR40'},include:{teams:true,groups:true}})
      for(const [code,teamCodes] of Object.entries(groups)){
        const group=div.groups.find(item=>item.code===code)!
        await prisma.groupTeam.createMany({data:(teamCodes as readonly string[]).map((teamCode:string,drawOrder:number)=>({groupId:group.id,teamId:div.teams.find(team=>team.code===teamCode)!.id,drawOrder:drawOrder+1}))})
      }
    }
    const installed=await installOfficialSchedule({actor:'integration-test'})
    expect(installed).toHaveLength(39)
    expect(installed.filter(item=>item.matchId)).toHaveLength(24)
    expect(installed.find(item=>item.sequenceNo===38)?.home.name).toBe('Vip หมออลงกต')
    expect(await prisma.match.count()).toBe(24)
    expect(await prisma.scheduleEntry.count()).toBe(39)
    const publicLogo='/uploads/team-logos/00000000-0000-4000-8000-000000000001.png'
    await updateTeamLogo('PUBLIC','p3',publicLogo,{actor:'integration-test'})
    expect((await listOfficialSchedule())[0].home.logoUrl).toBe(publicLogo)
    const first=installed[0]
    await updateMatch('PUBLIC',first.matchId!,{homeScore:1,awayScore:0,status:'FINISHED'},{actor:'integration-test'})
    expect((await listOfficialSchedule())[0]).toMatchObject({homeScore:1,awayScore:0,status:'FINISHED'})
  })
})
