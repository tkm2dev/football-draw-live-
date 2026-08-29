<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,reactive,ref} from 'vue'
import {io} from 'socket.io-client'
import GroupCard from '../components/GroupCard.vue'
import DrawWheel from '../components/DrawWheel.vue'
import TournamentCrest from '../components/TournamentCrest.vue'
import {divisions} from '../lib/data'
import type {DivisionKey,DrawSettleEvent,DrawSpinEvent,DrawState,GroupCode,GroupMap,Team} from '../lib/types'

type BroadcastState=DrawState&{spinActive:boolean;spinTeams:Team[];spinTargetTeamId:string;spinSettleDurationMs:number}
const divisionKeys:DivisionKey[]=['PUBLIC','SENIOR40']
const emptyGroups=():GroupMap=>({A:[],B:[],C:[],D:[]})
const metadata=(key:DivisionKey)=>divisions.find(division=>division.key===key)!
const emptyState=(key:DivisionKey):BroadcastState=>({sessionId:'',divisionKey:key,groups:emptyGroups(),drawnIds:[],totalTeams:12,teams:[...metadata(key).teams],separateTeamCodes:[],currentReveal:null,status:'READY',locked:false,events:[],spinActive:false,spinTeams:[],spinTargetTeamId:'',spinSettleDurationMs:1800})
const states=reactive<Record<DivisionKey,BroadcastState>>({PUBLIC:emptyState('PUBLIC'),SENIOR40:emptyState('SENIOR40')})
const activeKey=ref<DivisionKey>('SENIOR40')
const activeState=computed(()=>states[activeKey.value])
const activeDivision=computed(()=>metadata(activeKey.value))
const connected=ref(false)
const now=ref(new Date())
const fullscreen=ref(false)
const configuredApi=(import.meta as any).env?.VITE_API_URL as string|undefined
const api=configuredApi||((import.meta as any).env?.DEV?'http://localhost:4000':window.location.origin)
let socket:ReturnType<typeof io>|undefined
let timer:number|undefined
let latestEventAt=0

const progress=(state:BroadcastState)=>Math.round(state.drawnIds.length/Math.max(state.totalTeams,1)*100)
const featuredGroup=(state:BroadcastState):GroupCode|undefined=>state.currentReveal?.group
const stateLabel=(state:BroadcastState)=>state.spinActive?'กำลังหมุน':state.locked?'ผลทางการ':state.status==='COMPLETED'?'จับครบแล้ว':state.status==='LIVE'?'กำลังจับสลาก':'พร้อมเริ่ม'
const statusText=computed(()=>activeState.value.spinActive?'WHEEL IN MOTION':activeState.value.locked?'OFFICIAL RESULT':activeState.value.status==='COMPLETED'?'DRAW COMPLETED':activeState.value.status==='LIVE'?'LIVE DRAW IN PROGRESS':'STANDBY')

function applyState(state:DrawState){
  const target=states[state.divisionKey]
  Object.assign(target,state,{spinActive:false,spinTeams:[],spinTargetTeamId:''})
  const eventAt=Date.parse(state.events[0]?.at||'')||0
  if(eventAt>latestEventAt){latestEventAt=eventAt;activeKey.value=state.divisionKey}
}

function startSpin(event:DrawSpinEvent){
  const target=states[event.divisionKey]
  activeKey.value=event.divisionKey
  target.spinTeams=event.teams
  target.spinTargetTeamId=''
  target.spinSettleDurationMs=event.settleDurationMs
  target.spinActive=true
}

function settleSpin(event:DrawSettleEvent){
  const target=states[event.divisionKey]
  if(target.spinActive){activeKey.value=event.divisionKey;target.spinTargetTeamId=event.targetTeamId;target.spinSettleDurationMs=event.durationMs}
}

async function toggleFullscreen(){if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();fullscreen.value=Boolean(document.fullscreenElement)}

onMounted(()=>{
  socket=io(api)
  socket.on('connect',()=>{connected.value=true;socket?.emit('watch:divisions',divisionKeys)})
  socket.on('disconnect',()=>connected.value=false)
  socket.on('draw:state',applyState)
  socket.on('draw:spinning',startSpin)
  socket.on('draw:settling',settleSpin)
  timer=window.setInterval(()=>now.value=new Date(),1000)
  document.addEventListener('fullscreenchange',()=>fullscreen.value=Boolean(document.fullscreenElement))
})
onBeforeUnmount(()=>{window.clearInterval(timer);socket?.close()})
</script>

<template>
  <div class="live-broadcast dual-broadcast" :class="{locked:divisionKeys.every(key=>states[key].locked)}">
    <div class="stadium-scene"><div class="floodlight left"></div><div class="floodlight right"></div><div class="pitch-lines"></div></div>
    <div class="ambient-particles" aria-hidden="true"><i v-for="index in 18" :key="index" :style="{left:`${(index*37)%100}%`,animationDelay:`${-(index%9)*.73}s`,animationDuration:`${5+(index%5)}s`}"></i></div>
    <header class="broadcast-head">
      <div class="event-mark"><TournamentCrest/><div><small>ROYAL HONOR FOOTBALL</small><strong>PLAPAK 2026</strong></div></div>
      <div class="event-title"><span>✦ พิธีจับสลากแบ่งสาย ✦</span><h1>ฟุตบอลเฉลิมพระเกียรติ</h1><p>ครั้งที่ 13/2569 • รุ่นประชาชน และ รุ่นอาวุโส 40 ปีขึ้นไป</p></div>
      <div class="on-air"><span><i></i>{{connected?'ON AIR':'LINKING'}}</span><time>{{now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}}</time><button title="เต็มจอ" @click="toggleFullscreen">{{fullscreen?'⊙':'⛶'}}</button></div>
    </header>

    <main class="broadcast-content dual-content">
      <section class="reveal-stage dual-reveal">
        <div class="reveal-kicker"><span>{{statusText}} • {{activeDivision.name}} {{activeDivision.subtitle}}</span><b>{{activeState.drawnIds.length}} / {{activeState.totalTeams}}</b></div>
        <Transition name="broadcast-reveal" mode="out-in">
          <DrawWheel v-if="activeState.spinActive" :key="`wheel-${activeKey}`" :teams="activeState.spinTeams" :target-team-id="activeState.spinTargetTeamId" :settle-duration-ms="activeState.spinSettleDurationMs"/>
          <div v-else :key="`${activeKey}-${activeState.currentReveal?.team.id||activeState.status}`" class="reveal-result">
            <span v-if="activeState.currentReveal" class="reveal-sweep" aria-hidden="true"></span>
            <template v-if="activeState.currentReveal"><div class="ball-seal" :class="{'has-team-logo':activeState.currentReveal.team.logoUrl}"><img v-if="activeState.currentReveal.team.logoUrl" :src="activeState.currentReveal.team.logoUrl" :alt="`โลโก้ ${activeState.currentReveal.team.name}`"><template v-else>⚽</template><i></i></div><div class="revealed-team"><small>{{activeDivision.name}} • TEAM REVEALED</small><strong>{{activeState.currentReveal.team.name}}</strong></div><div class="group-reveal"><small>GROUP</small><b>{{activeState.currentReveal.group}}</b></div></template>
            <template v-else><div class="ball-seal standby">13</div><div class="revealed-team"><small>OFFICIAL LIVE DRAW • 2 DIVISIONS</small><strong>กำลังรอการจับสลาก</strong></div><div class="group-reveal idle"><small>GROUP</small><b>–</b></div></template>
          </div>
        </Transition>
      </section>

      <section class="dual-division-grid">
        <article v-for="key in divisionKeys" :key="key" class="division-board" :class="{active:activeKey===key,locked:states[key].locked}">
          <header class="division-board-head"><div><small>DIVISION</small><h2>{{metadata(key).name}}</h2><span>{{metadata(key).subtitle}}</span></div><div class="division-board-status"><b>{{states[key].drawnIds.length}} / {{states[key].totalTeams}}</b><span>{{stateLabel(states[key])}}</span></div></header>
          <div class="division-progress"><i :style="{width:progress(states[key])+'%'}"></i></div>
          <div class="live-groups division-group-grid"><GroupCard name="A" :teams="states[key].groups.A" :featured="featuredGroup(states[key])==='A'"/><GroupCard name="B" :teams="states[key].groups.B" :featured="featuredGroup(states[key])==='B'"/><GroupCard name="C" :teams="states[key].groups.C" :featured="featuredGroup(states[key])==='C'"/><GroupCard name="D" :teams="states[key].groups.D" :featured="featuredGroup(states[key])==='D'"/></div>
        </article>
      </section>
    </main>

    <footer class="broadcast-footer"><div><i></i> LIVE • OFFICIAL DRAW FEED</div><strong>ผลจับสลากทั้ง 2 รุ่นในจอเดียว</strong><span>8 GROUPS • 24 TEAMS</span></footer>
  </div>
</template>
