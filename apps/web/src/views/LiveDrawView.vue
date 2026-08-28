<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue'
import {useRoute} from 'vue-router'
import GroupCard from '../components/GroupCard.vue'
import TournamentCrest from '../components/TournamentCrest.vue'
import {useTournamentStore} from '../stores/tournament'
import type {DivisionKey} from '../lib/types'

const store=useTournamentStore()
const route=useRoute()
const now=ref(new Date())
const fullscreen=ref(false)
let timer:number|undefined
const featuredGroup=computed(()=>store.currentReveal?.group)
const statusText=computed(()=>store.locked?'OFFICIAL RESULT':store.status==='COMPLETED'?'DRAW COMPLETED':store.status==='LIVE'?'LIVE DRAW IN PROGRESS':'STANDBY')
async function toggleFullscreen(){if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();fullscreen.value=Boolean(document.fullscreenElement)}
onMounted(async()=>{
  const key=route.query.division
  if(key==='PUBLIC'||key==='SENIOR40')store.divisionKey=key as DivisionKey
  store.connect();await store.setDivision(store.divisionKey)
  timer=window.setInterval(()=>now.value=new Date(),1000)
  document.addEventListener('fullscreenchange',()=>fullscreen.value=Boolean(document.fullscreenElement))
})
onBeforeUnmount(()=>window.clearInterval(timer))
</script>

<template>
  <div class="live-broadcast" :class="{locked:store.locked}">
    <div class="stadium-scene"><div class="floodlight left"></div><div class="floodlight right"></div><div class="pitch-lines"></div></div>
    <div class="ambient-particles" aria-hidden="true"><i v-for="index in 18" :key="index" :style="{left:`${(index*37)%100}%`,animationDelay:`${-(index%9)*.73}s`,animationDuration:`${5+(index%5)}s`}"></i></div>
    <header class="broadcast-head">
      <div class="event-mark"><TournamentCrest/><div><small>ROYAL HONOR FOOTBALL</small><strong>PLAPAK 2026</strong></div></div>
      <div class="event-title"><span>✦ พิธีจับสลากแบ่งสาย ✦</span><h1>ฟุตบอลเฉลิมพระเกียรติ</h1><p>ครั้งที่ 13/2569 • {{store.division.name}} <b>{{store.division.subtitle}}</b></p></div>
      <div class="on-air"><span><i></i>{{store.connected?'ON AIR':'LINKING'}}</span><time>{{now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}}</time><button title="เต็มจอ" @click="toggleFullscreen">{{fullscreen?'⊙':'⛶'}}</button></div>
    </header>

    <main class="broadcast-content">
      <section class="reveal-stage">
        <div class="reveal-kicker"><span>{{statusText}}</span><b>{{store.drawnIds.length}} / {{store.totalTeams}}</b></div>
        <Transition name="broadcast-reveal" mode="out-in">
          <div :key="store.currentReveal?.team.id||store.status" class="reveal-result">
            <span v-if="store.currentReveal" class="reveal-sweep" aria-hidden="true"></span>
            <template v-if="store.currentReveal"><div class="ball-seal">⚽<i></i></div><div class="revealed-team"><small>TEAM REVEALED</small><strong>{{store.currentReveal.team.name}}</strong></div><div class="group-reveal"><small>GROUP</small><b>{{store.currentReveal.group}}</b></div></template>
            <template v-else><div class="ball-seal standby">13</div><div class="revealed-team"><small>OFFICIAL LIVE DRAW</small><strong>กำลังรอการจับสลาก</strong></div><div class="group-reveal idle"><small>GROUP</small><b>–</b></div></template>
          </div>
        </Transition>
        <div class="draw-meter"><div class="meter-line"><i :style="{width:store.progress+'%'}"></i></div><div class="meter-nodes"><span v-for="index in store.totalTeams" :key="index" :class="{done:index<=store.drawnIds.length,current:index===store.drawnIds.length}">{{index}}</span></div></div>
      </section>

      <section class="live-groups"><GroupCard name="A" :teams="store.groups.A" :featured="featuredGroup==='A'"/><GroupCard name="B" :teams="store.groups.B" :featured="featuredGroup==='B'"/><GroupCard name="C" :teams="store.groups.C" :featured="featuredGroup==='C'"/><GroupCard name="D" :teams="store.groups.D" :featured="featuredGroup==='D'"/></section>
    </main>

    <footer class="broadcast-footer"><div><i></i> LIVE • OFFICIAL DRAW FEED</div><strong>{{store.locked?'ผลการจับสลากอย่างเป็นทางการ • LOCKED':'ระบบจับสลากภายใต้เงื่อนไขการแข่งขัน'}}</strong><span>4 GROUPS • 12 TEAMS</span></footer>
  </div>
</template>
