<script setup lang="ts">
import {RouterLink} from 'vue-router'
import type {DivisionKey,Team} from '../lib/types'
defineProps<{name:string;teams:Team[];featured?:boolean;division?:DivisionKey}>()
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
</script>
<template>
  <section :class="['group-card','group-'+name,{featured}]">
    <div class="group-title"><span>GROUP</span><b class="group-shield">{{name}}</b><small>{{teams.length}} / 3</small></div>
    <TransitionGroup name="team-slot" tag="div" class="team-list">
      <component :is="division?RouterLink:'div'" v-for="(team,index) in teams" :key="team.id" :to="division?`/teams/${division}/${team.id}`:undefined" :class="['team-row',{'team-link':Boolean(division)}]" :aria-label="division?`ดูรายละเอียดทีม ${team.name}`:undefined">
        <span class="num">{{index+1}}</span><span class="team-mark" :class="{'has-logo':team.logoUrl}"><img v-if="team.logoUrl" :src="team.logoUrl" :alt="`โลโก้ ${team.name}`"><template v-else>{{initials(team.name)}}</template></span><span class="team-name">{{team.name}}</span>
      </component>
      <div v-for="index in Math.max(0,3-teams.length)" :key="'empty-'+index" class="team-row ghost">
        <span class="num">{{teams.length+index}}</span><span class="team-mark empty">◆</span><span>รอผลการจับสลาก</span>
      </div>
    </TransitionGroup>
  </section>
</template>
