<script setup lang="ts">
import TournamentCrest from './TournamentCrest.vue'
</script>
<template>
  <header class="topbar">
    <RouterLink class="brand" to="/"><TournamentCrest/><div><b>FOOTBALL DRAW LIVE</b><small>เฉลิมพระเกียรติ 13/2569</small></div></RouterLink>
    <nav><RouterLink to="/draw/admin">จับสลาก</RouterLink><RouterLink to="/groups">แบ่งสาย</RouterLink><RouterLink to="/matches">ตารางแข่ง</RouterLink><RouterLink to="/standings">คะแนน</RouterLink><RouterLink to="/bracket">น็อกเอาต์</RouterLink><RouterLink to="/public">Public</RouterLink></nav>
    <a class="live-chip" href="/live/draw" target="_blank">● LIVE</a>
  </header>
</template>
