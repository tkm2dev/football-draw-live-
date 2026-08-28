<script setup lang="ts">
import type {Team} from '../lib/types'
defineProps<{name:string;teams:Team[];featured?:boolean}>()
</script>
<template>
  <section class="group-card" :class="{featured}">
    <div class="group-title"><span>GROUP</span><b>{{name}}</b><small>{{teams.length}} / 3</small></div>
    <div v-for="(team,index) in teams" :key="team.id" class="team-row">
      <span class="num">{{index+1}}</span><span class="team-name">{{team.name}}</span><span v-if="team.seed" class="seed-badge">SEEDED</span>
    </div>
    <div v-for="index in Math.max(0,3-teams.length)" :key="'empty-'+index" class="team-row ghost">
      <span class="num">{{teams.length+index}}</span><span>รอผลการจับสลาก</span>
    </div>
  </section>
</template>
