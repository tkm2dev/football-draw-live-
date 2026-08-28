<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import TopBar from '../components/TopBar.vue'
import GroupCard from '../components/GroupCard.vue'
import TournamentCrest from '../components/TournamentCrest.vue'
import {useTournamentStore} from '../stores/tournament'

const store=useTournamentStore()
const busy=ref(false)
const message=ref('')
const statusLabel=computed(()=>({READY:'พร้อมเริ่ม',LIVE:'กำลังถ่ายทอดสด',COMPLETED:'จับครบแล้ว',LOCKED:'ผลอย่างเป็นทางการ'})[store.status])
const liveUrl=computed(()=>`/live/draw?division=${store.divisionKey}&projector=1`)
onMounted(async()=>{store.connect();await store.loadState()})
async function run(action:()=>Promise<void>){busy.value=true;message.value='';try{await action()}catch(error){message.value=error instanceof Error?error.message:'เกิดข้อผิดพลาด'}finally{busy.value=false}}
async function reset(){if(window.confirm('เริ่มพิธีใหม่? ผลแบ่งสายและตารางแข่งขันของรุ่นนี้จะถูกล้าง'))await run(store.reset)}
</script>

<template>
  <div class="page draw-control-page">
    <TopBar/>
    <main class="content admin-layout">
      <section class="admin-main">
        <header class="broadcast-toolbar">
          <div class="admin-heading">
            <TournamentCrest/>
            <div>
              <div class="eyebrow">OFFICIAL DRAW CONTROL • SESSION {{store.events[0]?.id || 'NEW'}}</div>
              <h1>ศูนย์ควบคุมการจับสลาก</h1>
              <p>ฟุตบอลเฉลิมพระเกียรติ ครั้งที่ 13/2569</p>
            </div>
          </div>
          <label class="division-select"><span>รุ่นการแข่งขัน</span><select v-model="store.divisionKey" :disabled="busy" @change="store.setDivision(store.divisionKey)"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></label>
        </header>

        <section class="control-status">
          <span :class="['status-pill',store.status.toLowerCase()]"><i></i>{{statusLabel}}</span>
          <div class="status-progress"><div><strong>{{store.drawnIds.length}}</strong><span>/ {{store.totalTeams}} ทีม</span></div><div class="progress"><i :style="{width:store.progress+'%'}"></i></div><b>{{store.progress}}%</b></div>
          <span class="connection" :class="{online:store.connected}"><i></i>{{store.connected?'LIVE LINK':'CONNECTING'}}</span>
        </section>

        <div v-if="store.divisionKey==='SENIOR40'" class="rule-banner"><span>◆</span><div><b>กติกาบังคับรุ่นอาวุโส</b><p>เพื่อนเยาวชน, ปตท.บายพาส นครพนม และ Safe House ต้องอยู่คนละสายเสมอ</p></div><strong>ENFORCED</strong></div>

        <section class="draw-stage broadcast-panel">
          <div class="draw-orb"><span>13</span><small>2569</small></div>
          <div class="draw-copy">
            <div class="eyebrow">{{store.currentReveal?'LATEST REVEAL':'READY FOR CEREMONY'}}</div>
            <Transition name="reveal" mode="out-in"><div :key="store.currentReveal?.team.id||'ready'"><h2>{{store.currentReveal?.team.name || 'พร้อมเริ่มพิธีจับสลาก'}}</h2><p v-if="store.currentReveal">ถูกจับเข้าสู่ <strong>สาย {{store.currentReveal.group}}</strong></p><p v-else>ผลทุกครั้งจะบันทึกลงฐานข้อมูลและ Audit Log โดยอัตโนมัติ</p></div></Transition>
          </div>
          <div class="draw-actions">
            <button class="btn gold big draw-primary" :disabled="busy || !store.remaining.length || store.locked" @click="run(store.drawNext)"><span>●</span>{{busy?'กำลังประมวลผล...':'จับทีมต่อไป'}}</button>
            <button class="btn rehearsal" :disabled="busy || !store.remaining.length || store.locked" @click="run(store.drawAll)">จบรอบอัตโนมัติ</button>
          </div>
        </section>
        <p v-if="message" class="error callout">{{message}}</p>

        <div class="group-grid control-groups"><GroupCard name="A" :teams="store.groups.A" :featured="store.currentReveal?.group==='A'"/><GroupCard name="B" :teams="store.groups.B" :featured="store.currentReveal?.group==='B'"/><GroupCard name="C" :teams="store.groups.C" :featured="store.currentReveal?.group==='C'"/><GroupCard name="D" :teams="store.groups.D" :featured="store.currentReveal?.group==='D'"/></div>
      </section>

      <aside class="control-rail">
        <section class="rail-card output-card"><div class="rail-icon">▣</div><div class="eyebrow">PROGRAM OUTPUT</div><h3>Live Draw 16:9</h3><p>สำหรับ Projector, TV หรือ OBS พร้อมโหมดเต็มจอ</p><a class="btn gold full" :href="liveUrl" target="_blank">เปิดจอถ่ายทอดสด ↗</a></section>
        <section class="rail-card security-card"><div class="eyebrow">RESULT SECURITY</div><h3>{{store.locked?'Official Result Locked':'ยืนยันผลอย่างเป็นทางการ'}}</h3><p>{{store.locked?'ระบบป้องกันการจับซ้ำและแก้ผลแล้ว':'ล็อกได้เมื่อจับครบ '+store.totalTeams+' ทีม'}}</p><button class="btn full" :class="{danger:store.locked}" :disabled="busy || (!store.locked && store.drawnIds.length<store.totalTeams)" @click="run(store.toggleLock)">{{store.locked?'ปลดล็อกผล':'ล็อกผลการจับสลาก'}}</button></section>
        <section class="rail-card timeline-card"><div class="timeline-head"><div><div class="eyebrow">AUDIT TIMELINE</div><h3>ประวัติการควบคุม</h3></div><span>{{store.events.length}}</span></div><div v-if="store.events.length" class="audit-timeline"><div v-for="event in store.events.slice(0,12)" :key="event.id" :class="['audit-event',event.eventType.toLowerCase()]"><i></i><div><time>{{new Date(event.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}}</time><p>{{event.message}}</p><small v-if="event.actor">โดย {{event.actor}}</small></div></div></div><p v-else class="muted">ยังไม่มีกิจกรรมในรอบนี้</p></section>
        <button class="btn danger-outline full" :disabled="busy || store.locked" @click="reset">เริ่มพิธีใหม่และล้างผล</button>
      </aside>
    </main>
  </div>
</template>
