<script setup lang="ts">
import {onMounted} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
const s=useTournamentStore()
onMounted(()=>s.loadTournament())
</script>
<template><div class="page"><TopBar/><main class="content"><div class="toolbar"><div><div class="eyebrow">MATCH CENTER</div><h2>ตารางการแข่งขัน</h2></div><button class="btn gold" @click="s.generateMatches">สร้าง 12 นัดรอบแบ่งกลุ่ม</button></div><div v-if="!s.groupMatches.length" class="notice">ยังไม่มีตารางแข่งขัน — จับสลากครบ 12 ทีมก่อนแล้วกดสร้างตาราง</div><div class="match-grid"><article v-for="m in s.groupMatches" :key="m.id" class="score-editor"><header><span>สาย {{m.group}} • นัด {{m.round}}</span><b>{{m.status}}</b></header><div class="teams-score"><strong>{{m.home.name}}</strong><input type="number" min="0" v-model.number="m.homeScore"><em>:</em><input type="number" min="0" v-model.number="m.awayScore"><strong>{{m.away.name}}</strong></div><div class="match-meta"><input v-model="m.field" placeholder="สนาม"><input type="datetime-local" v-model="m.kickoffAt"></div><button class="btn full" @click="s.saveScore(m)">บันทึกผลการแข่งขัน</button></article></div></main></div></template>
