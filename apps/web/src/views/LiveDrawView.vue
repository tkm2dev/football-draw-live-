<script setup lang="ts">
import { onMounted } from 'vue'
import GroupCard from '../components/GroupCard.vue'
import { useTournamentStore } from '../stores/tournament'
const s=useTournamentStore();onMounted(async()=>{s.connect();await s.loadState()})
</script>
<template><div class="live"><div class="lights"></div><div class="stadium-glow"></div>
<section class="live-head"><div class="cup">🏆</div><div><div class="champion-kicker">ROYAL HONOR FOOTBALL 2026</div><div class="live-title">ฟุตบอลเฉลิมพระเกียรติ</div><div class="live-sub">ครั้งที่ 13/2569</div><div class="division">{{s.division.name}} <span>({{s.division.subtitle}})</span> • รับ 12 ทีม</div></div></section>
<section class="reveal" :class="{idle:!s.currentReveal}"><span>{{s.currentReveal?'⚽ ผลการจับสลากล่าสุด':'🎱 LIVE DRAW'}}</span><strong>{{s.currentReveal?s.currentReveal.team.name:'กำลังรอการจับสลาก'}}</strong><b>{{s.currentReveal?'สาย '+s.currentReveal.group:s.drawnIds.length+' / 12 ทีม'}}</b></section>
<div class="live-progress"><i :style="{width:s.progress+'%'}"></i></div>
<div class="group-grid live-grid"><GroupCard name="A" :teams="s.groups.A"/><GroupCard name="B" :teams="s.groups.B"/><GroupCard name="C" :teams="s.groups.C"/><GroupCard name="D" :teams="s.groups.D"/></div>
<footer class="live-footer"><span>LIVE • PLAPAK DISTRICT</span><strong>{{s.locked?'ผลการจับสลากอย่างเป็นทางการ':'จับสลากแบบ Real-time'}}</strong><span>{{s.drawnIds.length}}/12</span></footer>
</div></template>
