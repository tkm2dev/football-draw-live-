<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
</script>
<template><div class="page"><TopBar/><main class="dashboard"><section class="hero"><div class="trophy">🏆</div><div><div class="eyebrow">TOURNAMENT CONTROL CENTER</div><h2>ระบบจัดการแข่งขันฟุตบอลแบบ Live</h2><p>จับสลากแบ่งสาย → ตารางแข่งขัน → ตารางคะแนน → รอบน็อกเอาต์</p><div class="actions"><RouterLink class="btn gold" to="/draw/admin">เริ่มจับสลาก</RouterLink><RouterLink class="btn" to="/live/draw">เปิดจอ Live</RouterLink></div></div></section><section class="cards"><article><b>12 ทีม</b><span>ต่อรุ่น</span></article><article><b>4 สาย</b><span>A–D</span></article><article><b>3 ทีม</b><span>ต่อสาย</span></article><article><b>LIVE</b><span>Socket.IO</span></article></section></main></div></template>
