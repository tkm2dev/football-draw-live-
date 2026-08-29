<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
import type {GroupCode} from '../lib/types'
const s=useTournamentStore()
const busy=ref(false)
const message=ref('')
const groups:GroupCode[]=['A','B','C','D']
const finished=computed(()=>s.groupMatches.filter(match=>match.status==='FINISHED').length)
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
async function changeDivision(){busy.value=true;try{await s.setDivision(s.divisionKey)}finally{busy.value=false}}
async function knockout(){busy.value=true;message.value='';try{await s.generateKnockout();message.value='สร้างรอบ 8 ทีมแล้ว'}catch(error){message.value=error instanceof Error?error.message:'สร้างรอบ 8 ทีมไม่สำเร็จ'}finally{busy.value=false}}
onMounted(async()=>{s.connect();await Promise.all([s.loadState(),s.loadTournament()])})
</script>
<template>
  <div class="page standings-page"><TopBar/><main class="content standings-content">
    <header class="standings-head"><div><div class="eyebrow">OFFICIAL GROUP TABLES</div><h1>ตารางคะแนนการแข่งขัน</h1><p>อัปเดตอัตโนมัติจากผลการแข่งขันที่ยืนยันว่าจบแล้ว</p></div><div class="standings-actions"><label class="division-select"><span>รุ่นการแข่งขัน</span><select v-model="s.divisionKey" :disabled="busy" @change="changeDivision"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></label><button class="btn gold" :disabled="busy||finished<12" @click="knockout">สร้างรอบ 8 ทีม</button></div></header>
    <section class="standings-summary"><div><small>DIVISION</small><b>{{s.division.name}}</b></div><div><small>RESULTS</small><b>{{finished}} / 12 นัด</b></div><div><small>QUALIFY</small><b>อันดับ 1–2</b></div></section>
    <p v-if="message" class="match-message ok">{{message}}</p>
    <div class="standings-full-grid"><section v-for="group in groups" :key="group" class="standing-board"><header><span>GROUP</span><b>{{group}}</b><small>อันดับ 1–2 เข้ารอบ</small></header><div class="standing-scroll"><table><thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th><th>ได้</th><th>เสีย</th><th>+/-</th><th>แต้ม</th></tr></thead><tbody><tr v-for="row in s.standings[group]" :key="row.team.id" :class="{qualify:row.rank<=2}"><td><b>{{row.rank}}</b></td><td><span class="standing-team-full"><i><img v-if="row.team.logoUrl" :src="row.team.logoUrl" :alt="`โลโก้ ${row.team.name}`"><em v-else>{{initials(row.team.name)}}</em></i><strong>{{row.team.name}}</strong></span></td><td>{{row.p}}</td><td>{{row.w}}</td><td>{{row.d}}</td><td>{{row.l}}</td><td>{{row.gf}}</td><td>{{row.ga}}</td><td :class="{positive:row.gd>0,negative:row.gd<0}">{{row.gd>0?'+':''}}{{row.gd}}</td><td><mark>{{row.pts}}</mark></td></tr></tbody></table></div></section></div>
  </main></div>
</template>
