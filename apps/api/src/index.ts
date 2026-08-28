import 'dotenv/config'
import express,{type NextFunction,type Request,type Response} from 'express'
import cors from 'cors'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {Server} from 'socket.io'
import {z} from 'zod'
import {prisma,disconnectDb} from './db.js'
import {drawAll,drawNext,getDrawState,resetDraw,setDrawLock,type AuditContext} from './services/drawService.js'
import {advanceKnockout,generateGroupMatches,generateKnockout,listMatches,standings,summary,updateMatch} from './services/tournamentEngine.js'
import type {DivisionKey} from './services/drawEngine.js'

const app=express()
app.set('trust proxy',1)
const server=createServer(app)
const allowedOrigins=(process.env.WEB_ORIGIN||'http://localhost:5173').split(',').map(value=>value.trim()).filter(Boolean)
const corsOptions:cors.CorsOptions={origin:(origin,callback)=>callback(null,!origin||allowedOrigins.includes('*')||allowedOrigins.includes(origin))}
const io=new Server(server,{cors:corsOptions})
app.use(cors(corsOptions))
app.use(express.json({limit:'2mb'}))

const Division=z.enum(['PUBLIC','SENIOR40'])
const DivisionBody=z.object({divisionKey:Division})
const MatchPatch=z.object({homeScore:z.number().int().min(0).nullable().optional(),awayScore:z.number().int().min(0).nullable().optional(),status:z.enum(['SCHEDULED','LIVE','FINISHED']).optional(),kickoffAt:z.iso.datetime().nullable().optional(),field:z.string().max(120).optional()})
const route=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>handler(req,res).catch(next)
const context=(req:Request):AuditContext=>({actor:String(req.header('x-admin-user')||'draw-admin').slice(0,120),ip:req.ip})

async function emit(key:DivisionKey,state?:Awaited<ReturnType<typeof getDrawState>>){
  const nextState=state??await getDrawState(key)
  io.to(`division:${key}`).emit('draw:state',nextState)
  io.to(`division:${key}`).emit('tournament:update',await summary(key))
}

app.get('/api/health',route(async(_req,res)=>{
  try{await prisma.$queryRaw`SELECT 1`;res.json({ok:true,name:'Football Draw Live API',version:'2.0.0',database:'ready',time:new Date().toISOString()})}
  catch{res.status(503).json({ok:false,name:'Football Draw Live API',version:'2.0.0',database:'unavailable'})}
}))
app.get('/api/draw/:division',route(async(req,res)=>{res.json(await getDrawState(Division.parse(req.params.division)))}))
app.post('/api/draw/reset',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const state=await resetDraw(key,context(req));await emit(key,state);res.json(state)}))
app.post('/api/draw/next',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const state=await drawNext(key,context(req));await emit(key,state);res.json(state)}))
app.post('/api/draw/all',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const state=await drawAll(key,context(req));await emit(key,state);res.json(state)}))
app.post('/api/draw/lock',route(async(req,res)=>{const body=DivisionBody.extend({locked:z.boolean()}).parse(req.body);const state=await setDrawLock(body.divisionKey,body.locked,context(req));await emit(body.divisionKey,state);res.json(state)}))
app.get('/api/tournament/:division',route(async(req,res)=>{res.json(await summary(Division.parse(req.params.division)))}))
app.post('/api/matches/generate',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await generateGroupMatches(key,context(req));await emit(key);res.json(out)}))
app.get('/api/matches/:division',route(async(req,res)=>{res.json(await listMatches(Division.parse(req.params.division)))}))
app.patch('/api/matches/:division/:id',route(async(req,res)=>{const key=Division.parse(req.params.division);const match=await updateMatch(key,z.string().parse(req.params.id),MatchPatch.parse(req.body),context(req));await emit(key);res.json(match)}))
app.get('/api/standings/:division',route(async(req,res)=>{res.json(await standings(Division.parse(req.params.division)))}))
app.post('/api/knockout/generate',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await generateKnockout(key,context(req));await emit(key);res.json(out)}))
app.post('/api/knockout/advance',route(async(req,res)=>{const key=DivisionBody.parse(req.body).divisionKey;const out=await advanceKnockout(key,context(req));await emit(key);res.json(out)}))

io.on('connection',socket=>{
  const watch=async(value:unknown)=>{
    const key=Division.parse(value)
    for(const room of socket.rooms)if(room.startsWith('division:'))socket.leave(room)
    socket.join(`division:${key}`)
    socket.emit('draw:state',await getDrawState(key))
    socket.emit('tournament:update',await summary(key))
  }
  socket.on('watch:division',(value:unknown)=>watch(value).catch(error=>socket.emit('server:error',{message:error instanceof Error?error.message:'เกิดข้อผิดพลาด'})))
  watch('SENIOR40').catch(()=>undefined)
})

const webDist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../web/dist')
app.use(express.static(webDist))
app.get(/^(?!\/api|\/socket\.io).*/,(_req,res)=>res.sendFile(path.join(webDist,'index.html')))
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(error instanceof z.ZodError){res.status(400).json({message:'ข้อมูลที่ส่งมาไม่ถูกต้อง',issues:error.issues});return}
  const message=error instanceof Error?error.message:'เกิดข้อผิดพลาดภายในระบบ'
  console.error(error)
  res.status(message.includes('ไม่พบ')?404:message.includes('ถูกล็อก')||message.includes('กรุณา')||message.includes('ต้อง')?409:500).json({message})
})

const port=Number(process.env.PORT||4000)
server.listen(port,()=>console.log(`Football Draw Live API listening on :${port}`))
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>disconnectDb().finally(()=>process.exit(0))))
