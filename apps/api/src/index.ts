import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { z } from 'zod'
import { drawAll,drawNext,emptyState,setLock,states } from './services/drawEngine.js'
import { generateGroupMatches,listMatches,updateMatch,standings,generateKnockout,advanceKnockout,summary } from './services/tournamentEngine.js'
import type { DivisionKey } from './data.js'
const app=express();const server=createServer(app);const io=new Server(server,{cors:{origin:process.env.WEB_ORIGIN||'*'}})
app.use(cors());app.use(express.json({limit:'2mb'}))
const Division=z.enum(['PUBLIC','SENIOR40'])
const emit=(k:DivisionKey)=>{io.emit('draw:state',states[k]);io.emit('tournament:update',summary(k))}
app.get('/api/health',(_req,res)=>res.json({ok:true,name:'Football Draw Live API',version:'1.0.0'}))
app.get('/api/draw/:division',(req,res)=>{const k=Division.parse(req.params.division);res.json(states[k])})
app.post('/api/draw/reset',(req,res)=>{const k=Division.parse(req.body.divisionKey);states[k]=emptyState(k);emit(k);res.json(states[k])})
app.post('/api/draw/next',(req,res)=>{try{const k=Division.parse(req.body.divisionKey);const state=drawNext(k);emit(k);res.json(state)}catch(e:any){res.status(400).json({message:e.message})}})
app.post('/api/draw/all',(req,res)=>{try{const k=Division.parse(req.body.divisionKey);const state=drawAll(k);emit(k);res.json(state)}catch(e:any){res.status(400).json({message:e.message})}})
app.post('/api/draw/lock',(req,res)=>{const k=Division.parse(req.body.divisionKey);const state=setLock(k,Boolean(req.body.locked));emit(k);res.json(state)})
app.get('/api/tournament/:division',(req,res)=>{const k=Division.parse(req.params.division);res.json(summary(k))})
app.post('/api/matches/generate',(req,res)=>{try{const k=Division.parse(req.body.divisionKey);const out=generateGroupMatches(k);emit(k);res.json(out)}catch(e:any){res.status(400).json({message:e.message})}})
app.get('/api/matches/:division',(req,res)=>{const k=Division.parse(req.params.division);res.json(listMatches(k))})
app.patch('/api/matches/:division/:id',(req,res)=>{try{const k=Division.parse(req.params.division);const m=updateMatch(k,req.params.id,req.body);emit(k);res.json(m)}catch(e:any){res.status(400).json({message:e.message})}})
app.get('/api/standings/:division',(req,res)=>{const k=Division.parse(req.params.division);res.json(standings(k))})
app.post('/api/knockout/generate',(req,res)=>{try{const k=Division.parse(req.body.divisionKey);const out=generateKnockout(k);emit(k);res.json(out)}catch(e:any){res.status(400).json({message:e.message})}})
app.post('/api/knockout/advance',(req,res)=>{try{const k=Division.parse(req.body.divisionKey);const out=advanceKnockout(k);emit(k);res.json(out)}catch(e:any){res.status(400).json({message:e.message})}})
io.on('connection',socket=>{socket.emit('draw:state',states.SENIOR40);socket.on('watch:division',(k:DivisionKey)=>socket.emit('tournament:update',summary(k)))})
const port=Number(process.env.PORT||4000);server.listen(port,()=>console.log(`API on :${port}`))
