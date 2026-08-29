<script setup lang="ts">
import {computed} from 'vue'
import type {Team} from '../lib/types'

const props=defineProps<{teams:Team[];durationMs:number}>()
const palette=['#f4ce63','#1879db','#0a3b78','#54b6ed','#d9a72d','#1558a6','#082b5d','#2a91d8','#e1bd50','#104984','#061d45','#69c7ed']
const slice=computed(()=>360/Math.max(props.teams.length,1))
const wheelBackground=computed(()=>`conic-gradient(from -90deg,${props.teams.map((_,index)=>`${palette[index%palette.length]} ${index*slice.value}deg ${(index+1)*slice.value}deg`).join(',')})`)
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const markerStyle=(index:number)=>{const angle=index*slice.value+slice.value/2;return{transform:`rotate(${angle}deg) translateY(-92px) rotate(${-angle}deg)`}}
</script>

<template>
  <div class="wheel-show">
    <div class="wheel-arena" aria-label="วงล้อสุ่มรายชื่อทีม">
      <span class="wheel-pointer"></span>
      <div class="ceremony-wheel" :style="{background:wheelBackground,animationDuration:`${durationMs}ms`}">
        <span v-for="(team,index) in teams" :key="team.id" class="wheel-team-marker" :style="markerStyle(index)">
          <img v-if="team.logoUrl" :src="team.logoUrl" :alt="`โลโก้ ${team.name}`">
          <b v-else>{{initials(team.name)}}</b>
        </span>
        <span class="wheel-hub"><b>13</b><small>DRAW</small></span>
      </div>
    </div>
    <div class="wheel-announcement">
      <small>RANDOM TEAM SELECTION</small>
      <h2>กำลังหมุนวงล้อ...</h2>
      <p>สุ่มจากทีมที่เหลือ {{teams.length}} ทีม ตามกติกาการแข่งขัน</p>
      <div class="wheel-ticker"><div>{{teams.map(team=>team.name).join('  ✦  ')}}</div></div>
    </div>
  </div>
</template>
