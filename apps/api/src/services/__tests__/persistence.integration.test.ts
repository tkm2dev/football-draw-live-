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
    const {getDrawState,updateTeamConfiguration}=await import('../drawService.js')
    const {prisma}=await import('../../db.js')
    const initial=await getDrawState('SENIOR40')
    const teams=initial.teams.map(team=>({code:team.id,name:team.id==='s1'?'สมประสงค์ ยูไนเต็ด':team.name}))
    const updated=await updateTeamConfiguration('SENIOR40',teams,['s1','s4','s9'],{actor:'integration-test'})
    expect(updated.teams.find(team=>team.id==='s1')?.name).toBe('สมประสงค์ ยูไนเต็ด')
    expect(updated.separateTeamCodes).toEqual(['s1','s4','s9'])
    expect(await prisma.team.count({where:{division:{type:'SENIOR40'},isSeed:true}})).toBe(3)
    expect(await prisma.auditLog.count({where:{action:'UPDATE_TEAM_CONFIGURATION'}})).toBe(1)
  })

  it('commits assignments, session events, snapshots and audit rows atomically',async()=>{
    const {drawAll,getDrawState,resetDraw,setDrawLock}=await import('../drawService.js')
    const {prisma,disconnectDb}=await import('../../db.js')
    await resetDraw('SENIOR40',{actor:'integration-test'})
    const completed=await drawAll('SENIOR40',{actor:'integration-test'})
    expect(completed.drawnIds).toHaveLength(12)
    expect(Object.values(completed.groups).every(group=>group.length===3)).toBe(true)
    expect(await prisma.groupTeam.count()).toBe(12)
    expect(await prisma.drawEvent.count({where:{eventType:'DRAW'}})).toBe(12)
    expect(await prisma.auditLog.count({where:{action:'DRAW_TEAM'}})).toBe(12)
    const separated=Object.entries(completed.groups).filter(([,teams])=>teams.some(team=>['s1','s4','s9'].includes(team.id))).map(([group])=>group)
    expect(new Set(separated).size).toBe(3)
    await setDrawLock('SENIOR40',true,{actor:'integration-test'})
    await disconnectDb()
    const restored=await getDrawState('SENIOR40')
    expect(restored.status).toBe('LOCKED')
    expect(restored.drawnIds).toHaveLength(12)
  })

  it('persists the generated 12-match group schedule',async()=>{
    const {generateGroupMatches,listMatches}=await import('../tournamentEngine.js')
    await generateGroupMatches('SENIOR40',{actor:'integration-test'})
    expect(await listMatches('SENIOR40')).toHaveLength(12)
  })
})
