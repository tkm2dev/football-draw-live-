<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import type {Team} from '../lib/types'

const props=defineProps<{teams:Team[];targetTeamId:string;settleDurationMs:number}>()
const palette=['#f4ce63','#1879db','#0a3b78','#54b6ed','#d9a72d','#1558a6','#082b5d','#2a91d8','#e1bd50','#104984','#061d45','#69c7ed']
const slice=computed(()=>360/Math.max(props.teams.length,1))
const wheelBackground=computed(()=>`conic-gradient(from -90deg,${props.teams.map((_,index)=>`${palette[index%palette.length]} ${index*slice.value}deg ${(index+1)*slice.value}deg`).join(',')})`)
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const markerStyle=(index:number)=>{const angle=index*slice.value+slice.value/2;return{transform:`rotate(${angle}deg) translateY(-92px) rotate(${-angle}deg)`}}
const wheel=ref<HTMLElement|null>(null)
const settling=ref(false)
let angle=0
let frame=0
let lastFrame=0

function freeSpin(now:number){
  if(settling.value)return
  const elapsed=lastFrame?Math.min(now-lastFrame,50):0
  lastFrame=now
  angle+=elapsed*.82
  if(wheel.value)wheel.value.style.transform=`rotate(${angle}deg)`
  frame=requestAnimationFrame(freeSpin)
}

function settleOnTarget(teamId:string){
  const element=wheel.value
  const index=props.teams.findIndex(team=>team.id===teamId)
  if(!element||index<0||settling.value)return
  settling.value=true
  cancelAnimationFrame(frame)
  const center=index*slice.value+slice.value/2
  const current=((angle%360)+360)%360
  const desired=((-center%360)+360)%360
  const alignment=(desired-current+360)%360
  const finalAngle=angle+1080+alignment
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    angle=finalAngle;element.style.transform=`rotate(${angle}deg)`;return
  }
  const animation=element.animate([{transform:`rotate(${angle}deg)`},{transform:`rotate(${finalAngle}deg)`}],{duration:props.settleDurationMs,easing:'cubic-bezier(.12,.72,.08,1)',fill:'forwards'})
  animation.onfinish=()=>{angle=finalAngle;element.style.transform=`rotate(${angle}deg)`}
}

onMounted(()=>{
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)frame=requestAnimationFrame(freeSpin)
  if(props.targetTeamId)settleOnTarget(props.targetTeamId)
})
watch(()=>props.targetTeamId,value=>{if(value)settleOnTarget(value)})
onBeforeUnmount(()=>cancelAnimationFrame(frame))
</script>

<template>
  <div class="wheel-show">
    <div class="wheel-arena" aria-label="วงล้อสุ่มรายชื่อทีม">
      <span class="wheel-pointer"></span>
      <div ref="wheel" class="ceremony-wheel" :class="{settling}" :style="{background:wheelBackground}">
        <span v-for="(team,index) in teams" :key="team.id" class="wheel-team-marker" :style="markerStyle(index)">
          <img v-if="team.logoUrl" :src="team.logoUrl" :alt="`โลโก้ ${team.name}`">
          <b v-else>{{initials(team.name)}}</b>
        </span>
        <span class="wheel-hub"><b>13</b><small>DRAW</small></span>
      </div>
    </div>
    <div class="wheel-announcement">
      <small>RANDOM TEAM SELECTION</small>
      <h2>{{settling?'กำลังหยุดที่ทีมที่เลือก...':'กำลังหมุนวงล้อ...'}}</h2>
      <p>สุ่มจริงจาก {{teams.length}} ทีมที่มีสิทธิ์ในรอบนี้ ตามกติกาการแข่งขัน</p>
      <div class="wheel-ticker"><div>{{teams.map(team=>team.name).join('  ✦  ')}}</div></div>
    </div>
  </div>
</template>
