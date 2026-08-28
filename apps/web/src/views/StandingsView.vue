<script setup lang="ts">
import {onMounted} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
const s=useTournamentStore()
onMounted(()=>s.loadTournament())
</script>
<template><div class="page"><TopBar/><main class="content"><div class="toolbar"><div><div class="eyebrow">GROUP TABLES</div><h2>ตารางคะแนน — {{s.division.name}}</h2></div><button class="btn gold" @click="s.generateKnockout">สร้างรอบ 8 ทีม</button></div><div class="standings-grid"><section v-for="g in ['A','B','C','D']" :key="g" class="table-card"><h3>สาย {{g}}</h3><table><thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>+/-</th><th>แต้ม</th></tr></thead><tbody><tr v-for="r in s.standings[g as 'A']" :key="r.team.id" :class="{qualify:r.rank<=2}"><td>{{r.rank}}</td><td>{{r.team.name}}</td><td>{{r.p}}</td><td>{{r.gd}}</td><td><b>{{r.pts}}</b></td></tr></tbody></table></section></div></main></div></template>
