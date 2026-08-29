<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import {useRoute} from 'vue-router'
import TopBar from '../components/TopBar.vue'
import GroupCard from '../components/GroupCard.vue'
import TournamentCrest from '../components/TournamentCrest.vue'
import {useTournamentStore} from '../stores/tournament'

const store=useTournamentStore()
const route=useRoute()
const busy=ref(false)
const message=ref('')
const editingTeams=ref(false)
const teamDraft=ref<Array<{code:string;name:string;logoUrl?:string;separate:boolean}>>([])
const uploadingCode=ref('')
const statusLabel=computed(()=>({READY:'พร้อมเริ่ม',LIVE:'กำลังถ่ายทอดสด',COMPLETED:'จับครบแล้ว',LOCKED:'ผลอย่างเป็นทางการ'})[store.status])
const liveUrl=computed(()=>`/live/draw?division=${store.divisionKey}&projector=1`)
const canEditTeams=computed(()=>!store.locked)
const drawStarted=computed(()=>store.drawnIds.length>0)
const selectedSeparateCount=computed(()=>teamDraft.value.filter(team=>team.separate).length)
const advancedSetup=computed(()=>route.query.setup==='rules')
onMounted(async()=>{store.connect();await store.loadState()})
async function run(action:()=>Promise<void>){busy.value=true;message.value='';try{await action()}catch(error){message.value=error instanceof Error?error.message:'เกิดข้อผิดพลาด'}finally{busy.value=false}}
async function reset(){if(window.confirm('เริ่มพิธีใหม่? ผลแบ่งสายและตารางแข่งขันของรุ่นนี้จะถูกล้าง'))await run(store.reset)}
async function changeDivision(){editingTeams.value=false;await store.setDivision(store.divisionKey)}
function openTeamEditor(){
  teamDraft.value=store.teams.map(team=>({code:team.id,name:team.name,logoUrl:team.logoUrl,separate:store.separateTeamCodes.includes(team.id)}))
  editingTeams.value=true
}
async function saveTeamConfiguration(){
  if(advancedSetup.value&&store.divisionKey==='SENIOR40'&&selectedSeparateCount.value!==3){message.value='กรุณาเลือกทีมบังคับแยกสายให้ครบ 3 ทีม';return}
  await run(async()=>{
    const rules=advancedSetup.value&&store.divisionKey==='SENIOR40'?teamDraft.value.filter(team=>team.separate).map(team=>team.code):store.separateTeamCodes
    await store.saveTeamConfiguration(teamDraft.value.map(({code,name})=>({code,name})),rules)
    editingTeams.value=false
  })
}
async function uploadLogo(team:{code:string;logoUrl?:string},event:Event){
  const input=event.target as HTMLInputElement
  const file=input.files?.[0]
  if(!file)return
  if(file.size>5*1024*1024){message.value='ไฟล์โลโก้ต้องไม่เกิน 5 MB';input.value='';return}
  uploadingCode.value=team.code;message.value=''
  try{
    const state=await store.uploadTeamLogo(team.code,file)
    team.logoUrl=state.teams.find(item=>item.id===team.code)?.logoUrl
  }catch(error){message.value=error instanceof Error?error.message:'อัปโหลดโลโก้ไม่สำเร็จ'}finally{uploadingCode.value='';input.value=''}
}
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
          <label class="division-select"><span>รุ่นการแข่งขัน</span><select v-model="store.divisionKey" :disabled="busy" @change="changeDivision"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></label>
        </header>

        <section class="control-status">
          <span :class="['status-pill',store.status.toLowerCase()]"><i></i>{{statusLabel}}</span>
          <div class="status-progress"><div><strong>{{store.drawnIds.length}}</strong><span>/ {{store.totalTeams}} ทีม</span></div><div class="progress"><i :style="{width:store.progress+'%'}"></i></div><b>{{store.progress}}%</b></div>
          <span class="connection" :class="{online:store.connected}"><i></i>{{store.connected?'LIVE LINK':'CONNECTING'}}</span>
        </section>

        <section v-if="editingTeams" class="team-editor-panel">
          <header><div><div class="eyebrow">{{advancedSetup?'DRAW SETUP':'TEAM CONFIGURATION'}}</div><h2>{{advancedSetup?'ตั้งค่าการจับสลาก':'แก้ไขรายชื่อและโลโก้ทีม'}}</h2><p>{{advancedSetup?'ตั้งค่ากติกาก่อนเริ่มพิธี':'แก้ไขชื่อและโลโก้ทีมได้ตามข้อมูลล่าสุด'}} การเปลี่ยนแปลงทุกครั้งจะถูกเก็บใน Audit Log</p></div><button class="editor-close" title="ปิด" @click="editingTeams=false">×</button></header>
          <div v-if="advancedSetup&&store.divisionKey==='SENIOR40'" :class="['constraint-counter',{valid:selectedSeparateCount===3}]"><b>{{selectedSeparateCount}} / 3</b><span>{{drawStarted?'เริ่มจับแล้ว — แก้ชื่อได้ แต่เปลี่ยนการตั้งค่าไม่ได้':'เลือก 3 ทีมสำหรับเงื่อนไขการแข่งขัน'}}</span></div>
          <div class="team-editor-grid">
            <label v-for="(team,index) in teamDraft" :key="team.code" class="team-edit-row">
              <span class="team-edit-number">{{index+1}}</span>
              <span class="logo-upload" :class="{uploading:uploadingCode===team.code,ready:team.logoUrl}"><img v-if="team.logoUrl" :src="team.logoUrl" alt=""><b v-else>{{uploadingCode===team.code?'…':'＋'}}</b><input type="file" accept="image/png,image/jpeg,image/webp" :disabled="Boolean(uploadingCode)" :aria-label="`อัปโหลดโลโก้ ${team.name}`" @change="uploadLogo(team,$event)"><em>{{team.logoUrl?'เปลี่ยน':'โลโก้'}}</em></span>
              <span class="team-edit-fields"><small>{{team.code.toUpperCase()}}</small><input v-model.trim="team.name" maxlength="120" placeholder="ชื่อทีม"></span>
              <span v-if="advancedSetup&&store.divisionKey==='SENIOR40'" class="constraint-check"><input v-model="team.separate" type="checkbox" :disabled="drawStarted||(!team.separate&&selectedSeparateCount>=3)"><i></i><em>ตั้งค่า</em></span>
            </label>
          </div>
          <footer><button class="btn" :disabled="busy" @click="editingTeams=false">ยกเลิก</button><button class="btn gold" :disabled="busy||(advancedSetup&&store.divisionKey==='SENIOR40'&&selectedSeparateCount!==3)" @click="saveTeamConfiguration">{{busy?'กำลังบันทึก...':advancedSetup?'บันทึกการตั้งค่า':'บันทึกรายชื่อทีม'}}</button></footer>
        </section>

        <section class="draw-stage broadcast-panel">
          <div class="draw-orb"><span>13</span><small>2569</small></div>
          <div class="draw-copy">
            <div class="eyebrow">{{store.currentReveal?'LATEST REVEAL':'READY FOR CEREMONY'}}</div>
            <Transition name="reveal" mode="out-in"><div :key="store.currentReveal?.team.id||'ready'"><h2>{{store.currentReveal?.team.name || 'พร้อมเริ่มพิธีจับสลาก'}}</h2><p v-if="store.currentReveal">ถูกจับเข้าสู่ <strong>สาย {{store.currentReveal.group}}</strong></p><p v-else>ผลทุกครั้งจะบันทึกลงฐานข้อมูลและ Audit Log โดยอัตโนมัติ</p></div></Transition>
          </div>
          <div class="draw-actions">
            <button class="btn gold big draw-primary" :disabled="busy || !store.remaining.length || store.locked" @click="run(store.drawNext)"><span>●</span>{{busy?'กำลังหมุนวงล้อ...':'หมุนวงล้อทีมต่อไป'}}</button>
            <button class="btn rehearsal" :disabled="busy || !store.remaining.length || store.locked" @click="run(store.drawAll)">จบรอบอัตโนมัติ</button>
          </div>
        </section>
        <p v-if="message" class="error callout">{{message}}</p>

        <div class="group-grid control-groups"><GroupCard name="A" :teams="store.groups.A" :featured="store.currentReveal?.group==='A'"/><GroupCard name="B" :teams="store.groups.B" :featured="store.currentReveal?.group==='B'"/><GroupCard name="C" :teams="store.groups.C" :featured="store.currentReveal?.group==='C'"/><GroupCard name="D" :teams="store.groups.D" :featured="store.currentReveal?.group==='D'"/></div>
      </section>

      <aside class="control-rail">
        <section class="rail-card team-management-card"><div class="rail-icon">✎</div><div class="eyebrow">TEAM MANAGEMENT</div><h3>{{advancedSetup?'ตั้งค่าการจับสลาก':'รายชื่อและโลโก้ทีม'}}</h3><p>{{advancedSetup?'ตั้งค่ากติกาภายในก่อนเริ่มพิธี':'แก้ไขชื่อและโลโก้ของทีมทั้ง 12 ทีม'}}</p><button class="btn full" :disabled="busy||!canEditTeams" @click="openTeamEditor">{{advancedSetup?'เปิดการตั้งค่า':'แก้ไขข้อมูลทีม'}}</button><small v-if="drawStarted&&!store.locked">เริ่มพิธีแล้ว: ยังแก้ไขชื่อและโลโก้ทีมได้</small><small v-if="store.locked">ยืนยันผลแล้ว กรุณาปลดล็อกก่อนแก้ไขข้อมูลทีม</small></section>
        <section class="rail-card output-card"><div class="rail-icon">▣</div><div class="eyebrow">PROGRAM OUTPUT</div><h3>Live Draw 16:9</h3><p>สำหรับ Projector, TV หรือ OBS พร้อมโหมดเต็มจอ</p><a class="btn gold full" :href="liveUrl" target="_blank">เปิดจอถ่ายทอดสด ↗</a></section>
        <section class="rail-card security-card"><div class="eyebrow">RESULT SECURITY</div><h3>{{store.locked?'Official Result Locked':'ยืนยันผลอย่างเป็นทางการ'}}</h3><p>{{store.locked?'ระบบป้องกันการจับซ้ำและแก้ผลแล้ว':'ล็อกได้เมื่อจับครบ '+store.totalTeams+' ทีม'}}</p><button class="btn full" :class="{danger:store.locked}" :disabled="busy || (!store.locked && store.drawnIds.length<store.totalTeams)" @click="run(store.toggleLock)">{{store.locked?'ปลดล็อกผล':'ล็อกผลการจับสลาก'}}</button></section>
        <section class="rail-card timeline-card"><div class="timeline-head"><div><div class="eyebrow">AUDIT TIMELINE</div><h3>ประวัติการควบคุม</h3></div><span>{{store.events.length}}</span></div><div v-if="store.events.length" class="audit-timeline"><div v-for="event in store.events.slice(0,12)" :key="event.id" :class="['audit-event',event.eventType.toLowerCase()]"><i></i><div><time>{{new Date(event.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}}</time><p>{{event.message}}</p><small v-if="event.actor">โดย {{event.actor}}</small></div></div></div><p v-else class="muted">ยังไม่มีกิจกรรมในรอบนี้</p></section>
        <button class="btn danger-outline full" :disabled="busy || store.locked" @click="reset">เริ่มพิธีใหม่และล้างผล</button>
      </aside>
    </main>
  </div>
</template>
