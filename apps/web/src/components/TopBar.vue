<script setup lang="ts">
import TournamentCrest from './TournamentCrest.vue'
defineProps<{admin?:boolean}>()
</script>
<template>
  <header class="topbar public-topbar">
    <RouterLink class="brand" to="/matches"><TournamentCrest/><div><b>FOOTBALL TOURNAMENT</b><small>เฉลิมพระเกียรติ ครั้งที่ 13/2569</small></div></RouterLink>
    <nav>
      <RouterLink to="/matches">ตารางแข่งขัน</RouterLink>
      <RouterLink to="/teams">ทีมและสาย</RouterLink>
      <RouterLink to="/standings">ตารางคะแนน</RouterLink>
      <RouterLink to="/rounds">รอบการแข่งขัน</RouterLink>
      <RouterLink to="/results">ผลการแข่งขัน</RouterLink>
    </nav>
    <span v-if="admin" class="admin-chip">ADMIN</span>
  </header>
</template>
