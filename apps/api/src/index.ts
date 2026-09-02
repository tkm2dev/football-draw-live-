import 'dotenv/config'
import express,{type NextFunction,type Request,type Response} from 'express'
import cors from 'cors'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {mkdir,unlink,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import multer,{MulterError} from 'multer'
import {Server} from 'socket.io'
import {z} from 'zod'
import {prisma,disconnectDb} from './db.js'
import {commitPlannedDraw,drawAll,getDrawState,planNextDraw,resetDraw,setDrawLock,updateTeamConfiguration,updateTeamLogo,type AuditContext} from './services/drawService.js'
import {advanceKnockout,generateGroupMatches,generateKnockout,listMatches,standings,summary,updateMatch,updateMatchSchedule} from './services/tournamentEngine.js'
import {installOfficialSchedule,listOfficialSchedule,updateStandaloneScheduleResult} from './services/officialSchedule.js'
import type {DivisionKey} from './services/drawEngine.js'
import {logoExtension,MAX_LOGO_BYTES,resolveUploadRoot,storedLogoPath} from './uploads.js'

const app=express()
app.set('trust proxy',1)
const server=createServer(app)
const allowedOrigins=(process.env.WEB_ORIGIN||'http://localhost:5173').split(',').map(value=>value.trim()).filter(Boolean)
const corsOptions:cors.CorsOptions={origin:(origin,callback)=>callback(null,!origin||allowedOrigins.includes('*')||allowedOrigins.includes(origin))}
const io=new Server(server,{cors:corsOptions})
app.use(cors(corsOptions))
app.use(express.json({limit:'2mb'}))
const uploadRoot=resolveUploadRoot(process.env.UPLOAD_DIR)
await mkdir(path.join(uploadRoot,'team-logos'),{recursive:true})
const logoUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_LOGO_BYTES,files:1}})
app.use('/uploads',express.static(uploadRoot,{dotfiles:'deny',fallthrough:true,maxAge:'30d',immutable:true}))

const Division=z.enum(['PUBLIC','SENIOR40'])
const DRAW_SPIN_MS=2600
const DRAW_SETTLE_MS=1800
const spinningDivisions=new Set<DivisionKey>()
const DivisionBody=z.object({divisionKey:Division})
const TeamConfigurationBody=z.object({teams:z.array(z.object({code:z.string().min(1).max(30),name:z.string().trim().min(1).max(120)})).length(12),separateTeamCodes:z.array(z.string().min(1).max(30)).max(3)})
const MatchPatch=z.object({homeScore:z.number().int().min(0).nullable().optional(),awayScore:z.number().int().min(0).nullable().optional(),status:z.enum(['SCHEDULED','LIVE','FINISHED']).optional(),kickoffAt:z.iso.datetime().nullable().optional(),field:z.string().max(120).optional()})
const MatchScheduleBody=z.object({matches:z.array(z.object({id:z.string().regex(/^\d+$/),homeTeamCode:z.string().min(1).max(30),awayTeamCode:z.string().min(1).max(30),kickoffAt:z.iso.datetime().nullable(),field:z.string().max(120)})).min(1).max(64)})
const StandaloneResultBody=z.object({homeScore:z.number().int().min(0).nullable(),awayScore:z.number().int().min(0).nullable(),status:z.enum(['SCHEDULED','LIVE','FINISHED'])})
const route=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>handler(req,res).catch(next)
const context=(req:Request):AuditContext=>({actor:String(req.header('x-admin-user')||'draw-admin').slice(0,120),ip:req.ip})
const ensureNotSpinning=(key:DivisionKey)=>{if(spinningDivisions.has(key))throw new Error('กรุณารอวงล้อหยุดก่อนทำรายการถัดไป')}

async function emit(key:DivisionKey,state?:Awaited<ReturnType<typeof getDrawState>>){
  const [nextState,tournament,schedule]=await Promise.all([state??getDrawState(key),summary(key),listOfficialSchedule()])
  io.to(`division:${key}`).emit('draw:state',nextState)
  io.to(`division:${key}`).emit('tournament:update',tournament)
  io.emit('schedule:update',schedule)
}

app.get('/api/health',route(async(_req,res)=>{
  try{await prisma.$queryRaw`SELECT 1`;res.json({ok:true,name:'Football Draw Live API',version:'2.0.0',database:'ready',time:new Date().toISOString()})}
  catch{res.status(503).json({ok:false,name:'Football Draw Live API',version:'2.0.0',database:'unavailable'})}
}))
app.get('/api/draw/:division',route(async(req,res)=>{res.json(await getDrawState(Division.parse(req.params.division)))}))
app.put('/api/divisions/:division/teams',route(async(req,res)=>{const key=Division.parse(req.params.division);ensureNotSpinning(key);const body=TeamConfigurationBody.parse(req.body);const state=await updateTeamConfiguration(key,body.teams,body.separateTeamCodes,context(req));await emit(key,state);res.json(state)}))
app.post('/api/teams/:division/:code/logo',logoUpload.single('logo'),route(async(req,res)=>{
  const key=Division.parse(req.params.division)
  const teamCode=z.string().min(1).max(30).parse(req.params.code)
  if(!req.file){res.status(400).json({message:'กรุณาเลือกไฟล์โลโก้'});return}
  const extension=logoExtension(req.file.buffer)
  if(!extension){res.status(400).json({message:'รองรับเฉพาะไฟล์ PNG, JPG และ WebP'});return}
  const logoDirectory=path.join(uploadRoot,'team-logos')
  await mkdir(logoDirectory,{recursive:true})
  const filename=`${randomUUID()}.${extension}`
  const filePath=path.join(logoDirectory,filename)
  const logoUrl=`/uploads/team-logos/${filename}`
  await writeFile(filePath,req.file.buffer,{flag:'wx'})
  try{
    const result=await updateTeamLogo(key,teamCode,logoUrl,context(req))
    const previousPath=storedLogoPath(uploadRoot,result.previousLogoUrl)
    if(previousPath&&previousPath!==filePath)await unlink(previousPath).catch(()=>undefined)
    await emit(key,result.state)
    res.json(result.state)
  }catch(error){await unlink(filePath).catch(()=>undefined);throw error}
}))
app.post('/api/draw/reset',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;ensureNotSpinning(key);const state=await resetDraw(key,context(req));await emit(key,state);res.json(state)}))
app.post('/api/draw/next',route(async(req,res)=>{
  const key=DivisionBody.parse(req.body).divisionKey
  ensureNotSpinning(key)
  spinningDivisions.add(key)
  try{
    const {plan,candidates}=await planNextDraw(key)
    io.to(`division:${key}`).emit('draw:spinning',{divisionKey:key,teams:candidates,durationMs:DRAW_SPIN_MS,settleDurationMs:DRAW_SETTLE_MS,startedAt:new Date().toISOString()})
    await new Promise(resolve=>setTimeout(resolve,DRAW_SPIN_MS))
    io.to(`division:${key}`).emit('draw:settling',{divisionKey:key,targetTeamId:plan.teamCode,durationMs:DRAW_SETTLE_MS})
    await new Promise(resolve=>setTimeout(resolve,DRAW_SETTLE_MS))
    const state=await commitPlannedDraw(key,plan,context(req))
    await emit(key,state)
    res.json(state)
  }catch(error){
    // Releasing the live clients from the wheel is best-effort; preserve the
    // original planning/commit error for the control screen.
    await getDrawState(key).then(state=>emit(key,state)).catch(()=>undefined)
    throw error
  }finally{spinningDivisions.delete(key)}
}))
app.post('/api/draw/all',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;ensureNotSpinning(key);const state=await drawAll(key,context(req));await emit(key,state);res.json(state)}))
app.post('/api/draw/lock',route(async(req,res)=>{const body=DivisionBody.extend({locked:z.boolean()}).parse(req.body);ensureNotSpinning(body.divisionKey);const state=await setDrawLock(body.divisionKey,body.locked,context(req));await emit(body.divisionKey,state);res.json(state)}))
app.get('/api/tournament/:division',route(async(req,res)=>{res.json(await summary(Division.parse(req.params.division)))}))
app.get('/api/schedule',route(async(_req,res)=>{res.json(await listOfficialSchedule())}))
app.post('/api/schedule/official',route(async(req,res)=>{const out=await installOfficialSchedule(context(req));await Promise.all((['PUBLIC','SENIOR40'] as DivisionKey[]).map(key=>emit(key)));res.json(out)}))
app.patch('/api/schedule/:id/result',route(async(req,res)=>{const body=StandaloneResultBody.parse(req.body);res.json(await updateStandaloneScheduleResult(z.string().parse(req.params.id),body.homeScore,body.awayScore,body.status,context(req)))}))
app.post('/api/matches/generate',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await generateGroupMatches(key,context(req));await emit(key);res.json(out)}))
app.get('/api/matches/:division',route(async(req,res)=>{res.json(await listMatches(Division.parse(req.params.division)))}))
app.put('/api/matches/:division/schedule',route(async(req,res)=>{const key=Division.parse(req.params.division);const body=MatchScheduleBody.parse(req.body);const out=await updateMatchSchedule(key,body.matches,context(req));await emit(key);res.json(out)}))
app.patch('/api/matches/:division/:id',route(async(req,res)=>{const key=Division.parse(req.params.division);const match=await updateMatch(key,z.string().parse(req.params.id),MatchPatch.parse(req.body),context(req));await emit(key);res.json(match)}))
app.get('/api/standings/:division',route(async(req,res)=>{res.json(await standings(Division.parse(req.params.division)))}))
app.post('/api/knockout/generate',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await generateKnockout(key,context(req));await emit(key);res.json(out)}))
app.post('/api/knockout/advance',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await advanceKnockout(key,context(req));await emit(key);res.json(out)}))

io.on('connection',socket=>{
  const watchMany=async(value:unknown)=>{
    const keys=[...new Set(z.array(Division).min(1).max(2).parse(value))]
    for(const room of socket.rooms)if(room.startsWith('division:'))socket.leave(room)
    for(const key of keys){
      socket.join(`division:${key}`)
      socket.emit('draw:state',await getDrawState(key))
      socket.emit('tournament:update',await summary(key))
    }
  }
  const report=(error:unknown)=>socket.emit('server:error',{message:error instanceof Error?error.message:'เกิดข้อผิดพลาด'})
  socket.on('watch:division',(value:unknown)=>watchMany([value]).catch(report))
  socket.on('watch:divisions',(value:unknown)=>watchMany(value).catch(report))
  watchMany(['SENIOR40']).catch(()=>undefined)
})

const webDist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../web/dist')
app.use(express.static(webDist))
app.get(/^(?!\/api|\/socket\.io).*/,(_req,res)=>res.sendFile(path.join(webDist,'index.html')))
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(error instanceof MulterError){res.status(400).json({message:error.code==='LIMIT_FILE_SIZE'?'ไฟล์โลโก้ต้องไม่เกิน 5 MB':'อัปโหลดโลโก้ไม่สำเร็จ'});return}
  if(error instanceof z.ZodError){res.status(400).json({message:'ข้อมูลที่ส่งมาไม่ถูกต้อง',issues:error.issues});return}
  const message=error instanceof Error?error.message:'เกิดข้อผิดพลาดภายในระบบ'
  console.error(error)
  res.status(message.includes('ไม่พบ')?404:message.includes('ถูกล็อก')||message.includes('กรุณา')||message.includes('ต้อง')?409:500).json({message})
})

const port=Number(process.env.PORT||4000)
server.listen(port,()=>console.log(`Football Draw Live API listening on :${port}`))
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>disconnectDb().finally(()=>process.exit(0))))
