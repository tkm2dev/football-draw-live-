<script setup lang="ts">
import { onMounted,ref } from 'vue'
import TopBar from '../components/TopBar.vue'
import GroupCard from '../components/GroupCard.vue'
import { useTournamentStore } from '../stores/tournament'
const s=useTournamentStore();const busy=ref(false);const message=ref('')
onMounted(async()=>{s.connect();await s.loadState()})
async function run(fn:()=>Promise<void>){busy.value=true;message.value='';try{await fn()}catch(e:any){message.value=e.message}finally{busy.value=false}}
</script>
<template><div class="page"><TopBar/><main class="content admin-layout">
<section class="admin-main">
  <div class="toolbar"><div><div class="eyebrow">LIVE TOURNAMENT CONTROL</div><h2>ศูนย์ควบคุมการจับสลาก</h2><p class="muted">ฟุตบอลเฉลิมพระเกียรติ ครั้งที่ 13/2569</p></div><select v-model="s.divisionKey" @change="s.setDivision(s.divisionKey)"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></div>
  <div class="status-strip"><span :class="['status-pill',s.status.toLowerCase()]">● {{s.status}}</span><strong>{{s.drawnIds.length}} / 12 ทีม</strong><div class="progress"><i :style="{width:s.progress+'%'}"></i></div><span>{{s.progress}}%</span></div>
  <div class="notice" v-if="s.divisionKey==='SENIOR40'"><b>กติกาพิเศษ:</b> เพื่อนเยาวชน / ปตท.บายพาส นครพนม / Safe House ต้องอยู่คนละสาย</div>
  <div class="draw-stage">
    <div class="draw-orb">⚽</div><div class="draw-copy"><div class="eyebrow">CURRENT REVEAL</div><h3>{{s.currentReveal ? s.currentReveal.team.name : 'พร้อมเริ่มพิธีจับสลาก'}}</h3><p v-if="s.currentReveal">เข้าสู่ <strong>สาย {{s.currentReveal.group}}</strong></p><p v-else>เลือก “จับทีมต่อไป” เพื่อสุ่มทีละทีมแบบ Live</p></div>
    <div class="draw-actions"><button class="btn gold big" :disabled="busy || !s.remaining.length || s.locked" @click="run(s.drawNext)">{{busy?'กำลังสุ่ม...':'🎱 จับทีมต่อไป'}}</button><button class="btn" :disabled="busy || !s.remaining.length || s.locked" @click="run(s.drawAll)">สุ่มให้ครบ 12 ทีม</button></div>
  </div>
  <p class="error" v-if="message">{{message}}</p>
  <div class="group-grid"><GroupCard name="A" :teams="s.groups.A"/><GroupCard name="B" :teams="s.groups.B"/><GroupCard name="C" :teams="s.groups.C"/><GroupCard name="D" :teams="s.groups.D"/></div>
</section>
<aside class="control-rail">
  <div class="rail-card"><div class="eyebrow">LIVE OUTPUT</div><h3>จอถ่ายทอดสด</h3><p>เปิดหน้าจอ Live บน TV / Projector / OBS</p><a class="btn gold full" href="/live/draw" target="_blank">เปิด Live Screen ↗</a></div>
  <div class="rail-card"><div class="eyebrow">DRAW SECURITY</div><h3>{{s.locked?'ผลถูกล็อกแล้ว':'ล็อกผลหลังจับครบ'}}</h3><p>ป้องกันการสุ่มซ้ำหรือแก้ผลโดยไม่ตั้งใจ</p><button class="btn full" :class="{danger:s.locked}" @click="s.toggleLock">{{s.locked?'🔓 ปลดล็อก':'🔒 ล็อกผล'}}</button></div>
  <div class="rail-card"><div class="eyebrow">AUDIT LOG</div><h3>ประวัติล่าสุด</h3><div class="audit" v-if="s.events.length"><div v-for="e in s.events.slice(0,7)" :key="e.at"><time>{{new Date(e.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}}</time><span>{{e.message}}</span></div></div><p v-else class="muted">ยังไม่มีการจับสลาก</p></div>
  <button class="btn danger full" :disabled="busy" @click="run(s.reset)">เริ่มการจับสลากใหม่</button>
</aside>
</main></div></template>
