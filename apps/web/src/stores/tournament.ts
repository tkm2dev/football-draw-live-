import {defineStore} from 'pinia'
import {io} from 'socket.io-client'
import {divisions} from '../lib/data'
import type {DivisionKey,DrawSettleEvent,DrawSpinEvent,DrawState,GroupMap,GroupCode,Match,Standing,Team} from '../lib/types'

const emptyGroups=():GroupMap=>({A:[],B:[],C:[],D:[]})
const configuredApi=(import.meta as any).env?.VITE_API_URL as string|undefined
const api=configuredApi||((import.meta as any).env?.DEV?'http://localhost:4000':window.location.origin)
async function json(response:Response){const data=await response.json();if(!response.ok)throw new Error(data.message||'เกิดข้อผิดพลาด');return data}
const writeHeaders={'content-type':'application/json','x-admin-user':'draw-control'}

export const useTournamentStore=defineStore('tournament',{
  state:()=>({divisionKey:'SENIOR40' as DivisionKey,groups:emptyGroups(),drawnIds:[] as string[],totalTeams:12,teams:[...divisions.find(division=>division.key==='SENIOR40')!.teams] as Team[],separateTeamCodes:['s2','s4','s9'] as string[],currentReveal:null as null|{team:Team;group:GroupCode},spinActive:false,spinTeams:[] as Team[],spinDurationMs:2600,spinSettleDurationMs:1800,spinTargetTeamId:'' as string,matches:[] as Match[],standings:{A:[],B:[],C:[],D:[]} as Record<GroupCode,Standing[]>,socket:null as any,status:'READY' as DrawState['status'],locked:false,events:[] as DrawState['events'],lastError:'',connected:false}),
  getters:{
    division:state=>divisions.find(division=>division.key===state.divisionKey)!,
    remaining:state=>state.teams.filter(team=>!state.drawnIds.includes(team.id)),
    progress:state=>Math.round(state.drawnIds.length/Math.max(state.totalTeams,1)*100),
    groupMatches:state=>state.matches.filter(match=>match.stage==='GROUP'),
    knockoutMatches:state=>state.matches.filter(match=>match.stage!=='GROUP')
  },
  actions:{
    applyState(state:DrawState){this.groups=state.groups;this.drawnIds=state.drawnIds;this.totalTeams=state.totalTeams||12;this.teams=state.teams||[];this.separateTeamCodes=state.separateTeamCodes||[];this.currentReveal=state.currentReveal;this.status=state.status;this.locked=state.locked;this.events=state.events||[];this.spinActive=false},
    async setDivision(key:DivisionKey){this.divisionKey=key;this.socket?.emit('watch:division',key);await Promise.all([this.loadState(),this.loadTournament()])},
    connect(){
      if(this.socket){this.socket.emit('watch:division',this.divisionKey);return}
      this.socket=io(api)
      this.socket.on('connect',()=>{this.connected=true;this.socket.emit('watch:division',this.divisionKey)})
      this.socket.on('disconnect',()=>{this.connected=false})
      this.socket.on('draw:spinning',(event:DrawSpinEvent)=>{if(event.divisionKey===this.divisionKey){this.spinTeams=event.teams;this.spinDurationMs=event.durationMs;this.spinSettleDurationMs=event.settleDurationMs;this.spinTargetTeamId='';this.spinActive=true}})
      this.socket.on('draw:settling',(event:DrawSettleEvent)=>{if(event.divisionKey===this.divisionKey&&this.spinActive){this.spinTargetTeamId=event.targetTeamId;this.spinSettleDurationMs=event.durationMs}})
      this.socket.on('draw:state',(state:DrawState)=>{if(state.divisionKey===this.divisionKey)this.applyState(state)})
      this.socket.on('tournament:update',(state:any)=>{if(state.divisionKey===this.divisionKey){this.matches=state.matches||[];this.standings=state.standings||this.standings}})
      this.socket.on('server:error',(error:{message:string})=>{this.lastError=error.message})
    },
    async loadState(){this.applyState(await json(await fetch(`${api}/api/draw/${this.divisionKey}`)))},
    async loadTournament(){const state=await json(await fetch(`${api}/api/tournament/${this.divisionKey}`));this.matches=state.matches||[];this.standings=state.standings||this.standings},
    async post(url:string,body:unknown){return json(await fetch(`${api}${url}`,{method:'POST',headers:writeHeaders,body:JSON.stringify(body)}))},
    async saveTeamConfiguration(teams:{code:string;name:string}[],separateTeamCodes:string[]){this.applyState(await json(await fetch(`${api}/api/divisions/${this.divisionKey}/teams`,{method:'PUT',headers:writeHeaders,body:JSON.stringify({teams,separateTeamCodes})})))},
    async uploadTeamLogo(teamCode:string,file:File){const body=new FormData();body.append('logo',file);const state=await json(await fetch(`${api}/api/teams/${this.divisionKey}/${teamCode}/logo`,{method:'POST',headers:{'x-admin-user':'draw-control'},body}));this.applyState(state);return state as DrawState},
    async reset(){this.applyState(await this.post('/api/draw/reset',{divisionKey:this.divisionKey}));this.matches=[];this.standings={A:[],B:[],C:[],D:[]}},
    async drawNext(){this.applyState(await this.post('/api/draw/next',{divisionKey:this.divisionKey}))},
    async drawAll(){this.applyState(await this.post('/api/draw/all',{divisionKey:this.divisionKey}))},
    async toggleLock(){this.applyState(await this.post('/api/draw/lock',{divisionKey:this.divisionKey,locked:!this.locked}))},
    async generateMatches(){this.matches=await this.post('/api/matches/generate',{divisionKey:this.divisionKey});await this.loadTournament()},
    async saveScore(match:Match){await json(await fetch(`${api}/api/matches/${this.divisionKey}/${match.id}`,{method:'PATCH',headers:writeHeaders,body:JSON.stringify({homeScore:match.homeScore,awayScore:match.awayScore,status:'FINISHED',kickoffAt:match.kickoffAt||null,field:match.field})}));await this.loadTournament()},
    async generateKnockout(){await this.post('/api/knockout/generate',{divisionKey:this.divisionKey});await this.loadTournament()},
    async advanceKnockout(){await this.post('/api/knockout/advance',{divisionKey:this.divisionKey});await this.loadTournament()}
  }
})
