<script setup lang="ts">
import type {Team} from '../lib/types'
defineProps<{name:string;teams:Team[];featured?:boolean}>()
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
</script>
<template>
  <section :class="['group-card','group-'+name,{featured}]">
    <div class="group-title"><span>GROUP</span><b class="group-shield">{{name}}</b><small>{{teams.length}} / 3</small></div>
    <TransitionGroup name="team-slot" tag="div" class="team-list">
      <div v-for="(team,index) in teams" :key="team.id" class="team-row">
        <span class="num">{{index+1}}</span><span class="team-mark">{{initials(team.name)}}</span><span class="team-name">{{team.name}}</span><span v-if="team.seed" class="seed-badge">SEEDED</span>
      </div>
      <div v-for="index in Math.max(0,3-teams.length)" :key="'empty-'+index" class="team-row ghost">
        <span class="num">{{teams.length+index}}</span><span class="team-mark empty">◆</span><span>รอผลการจับสลาก</span>
      </div>
    </TransitionGroup>
  </section>
</template>
