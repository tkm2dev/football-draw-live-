<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import TopBar from '../components/TopBar.vue'
import {api} from '../stores/tournament'
import type {DivisionKey,DrawState,GroupCode,Team} from '../lib/types'

const states=ref<Record<DivisionKey,DrawState|null>>({PUBLIC:null,SENIOR40:null})
const loading=ref(true)
const query=ref('')
const divisionInfo=[{key:'PUBLIC' as const,name:'รุ่นประชาชน',subtitle:'ภายในอำเภอปลาปาก'},{key:'SENIOR40' as const,name:'รุ่นอาวุโส 40+',subtitle:'OPEN'}]
const groups:GroupCode[]=['A','B','C','D']
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const visible=(team:Team)=>!query.value.trim()||team.name.toLocaleLowerCase('th').includes(query.value.trim().toLocaleLowerCase('th'))
const total=computed(()=>Object.values(states.value).reduce((sum,state)=>sum+(state?.teams.length??0),0))
onMounted(async()=>{try{const [publicState,seniorState]=await Promise.all((['PUBLIC','SENIOR40'] as DivisionKey[]).map(key=>fetch(`${api}/api/draw/${key}`).then(response=>response.json())));states.value={PUBLIC:publicState,SENIOR40:seniorState}}finally{loading.value=false}})
</script>

<template><div class="page public-hub-page"><TopBar/><main class="content public-hub-content">
  <header class="hub-heading"><div><div class="eyebrow">TEAMS & OFFICIAL GROUPS</div><h1>ทีมแข่งขันและผลการแบ่งสาย</h1><p>เลือกทีมเพื่อดูโปรแกรม ผลการแข่งขัน และอันดับล่าสุดของทีมนั้น</p></div><label class="team-search"><span>ค้นหาทีม</span><input v-model="query" type="search" placeholder="พิมพ์ชื่อทีม..."></label></header>
  <section class="hub-summary"><div><small>TEAMS</small><b>{{total}}</b><span>ทีมทั้งหมด</span></div><div><small>DIVISIONS</small><b>2</b><span>รุ่นการแข่งขัน</span></div><div><small>GROUPS</small><b>8</b><span>สาย A–D ทั้งสองรุ่น</span></div></section>
  <div v-if="loading" class="public-empty">กำลังโหลดข้อมูลทีม...</div>
  <section v-for="division in divisionInfo" v-else :key="division.key" class="team-division-section"><header><div><small>{{division.key}}</small><h2>{{division.name}}</h2><p>{{division.subtitle}}</p></div><b>12 ทีม</b></header><div class="team-groups-grid"><article v-for="group in groups" :key="group" class="team-group-panel"><h3><span>สาย</span><b>{{group}}</b></h3><div class="team-directory-list"><RouterLink v-for="team in states[division.key]?.groups[group].filter(visible)" :key="team.id" :to="`/teams/${division.key}/${team.id}`" class="team-directory-card"><i><img v-if="team.logoUrl" :src="team.logoUrl" :alt="`โลโก้ ${team.name}`"><em v-else>{{initials(team.name)}}</em></i><span><strong>{{team.name}}</strong><small>ดูรายละเอียดทีม</small></span><b>›</b></RouterLink><p v-if="!states[division.key]?.groups[group].some(visible)" class="muted">ไม่พบทีม</p></div></article></div></section>
</main></div></template>
