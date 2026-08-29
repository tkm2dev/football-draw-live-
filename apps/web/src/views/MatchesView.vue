<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
import type {GroupCode,Match,Team} from '../lib/types'

interface MatchDraft{id:string;group:GroupCode;round:number;homeTeamCode:string;awayTeamCode:string;kickoffLocal:string;field:string;homeScore:number|null;awayScore:number|null;status:Match['status']}
const s=useTournamentStore()
const drafts=ref<MatchDraft[]>([])
const busy=ref(false)
const busyMatch=ref('')
const message=ref('')
const messageType=ref<'ok'|'error'>('ok')
const today=new Date()
const scheduleDate=ref(new Date(today.getTime()-today.getTimezoneOffset()*60_000).toISOString().slice(0,10))
const startTime=ref('09:00')
const slotMinutes=ref(40)
const defaultField=ref('สนามกลาง')
const logoEditor=ref(false)
const uploadingCode=ref('')
const groupCodes:GroupCode[]=['A','B','C','D']
const finishedCount=computed(()=>s.groupMatches.filter(match=>match.status==='FINISHED').length)

const localInput=(iso:string|null|undefined)=>{
  if(!iso)return''
  const date=new Date(iso)
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60_000)
  return local.toISOString().slice(0,16)
}
function syncDrafts(){drafts.value=[...s.groupMatches].sort((a,b)=>a.round-b.round||(a.group??'').localeCompare(b.group??'')).map(match=>({id:match.id,group:match.group!,round:match.round,homeTeamCode:match.home.id,awayTeamCode:match.away.id,kickoffLocal:localInput(match.kickoffAt),field:match.field||'',homeScore:match.homeScore,awayScore:match.awayScore,status:match.status}))}
watch(()=>s.matches,syncDrafts,{deep:true})
const teamsInGroup=(group:GroupCode)=>s.groups[group]
const team=(code:string):Team|undefined=>s.teams.find(item=>item.id===code)
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const score=(value:unknown)=>value===''||value===null||value===undefined?null:Number(value)

async function run(action:()=>Promise<void>,success:string){busy.value=true;message.value='';try{await action();message.value=success;messageType.value='ok'}catch(error){message.value=error instanceof Error?error.message:'เกิดข้อผิดพลาด';messageType.value='error'}finally{busy.value=false}}
async function changeDivision(){logoEditor.value=false;await run(async()=>{await s.setDivision(s.divisionKey);syncDrafts()},'โหลดข้อมูลการแข่งขันแล้ว')}
async function generate(){
  if(drafts.value.length&&!window.confirm('สร้างโปรแกรมใหม่จากผลแบ่งสาย? วันเวลาและสนามที่กรอกไว้จะถูกแทนที่'))return
  await run(async()=>{await s.generateMatches();syncDrafts()},'สร้างโปรแกรมรอบแบ่งกลุ่ม 12 นัดแล้ว')
}
function applyDatePlan(){
  if(!scheduleDate.value||!startTime.value){message.value='กรุณาเลือกวันที่และเวลาเริ่มแข่งขัน';messageType.value='error';return}
  const first=new Date(`${scheduleDate.value}T${startTime.value}:00`)
  if(Number.isNaN(first.getTime())){message.value='วันเวลาเริ่มแข่งขันไม่ถูกต้อง';messageType.value='error';return}
  drafts.value.forEach((draft,index)=>{draft.kickoffLocal=localInput(new Date(first.getTime()+index*Math.max(slotMinutes.value,1)*60_000).toISOString());if(defaultField.value.trim())draft.field=defaultField.value.trim()})
  message.value='จัดวันเวลาแบบต่อเนื่องให้แล้ว ตรวจสอบก่อนกดบันทึกโปรแกรม';messageType.value='ok'
}
async function saveSchedule(){
  await run(async()=>{
    await s.saveSchedule(drafts.value.map(draft=>({id:draft.id,homeTeamCode:draft.homeTeamCode,awayTeamCode:draft.awayTeamCode,kickoffAt:draft.kickoffLocal?new Date(draft.kickoffLocal).toISOString():null,field:draft.field})))
    syncDrafts()
  },'บันทึกวันเวลา สนาม และคู่แข่งขันครบแล้ว')
}
async function saveResult(draft:MatchDraft){
  busyMatch.value=draft.id;message.value=''
  try{
    const home=score(draft.homeScore),away=score(draft.awayScore)
    if(draft.status==='FINISHED'&&(home===null||away===null))throw new Error('กรุณากรอกสกอร์ทั้งสองทีมก่อนยืนยันว่าจบการแข่งขัน')
    await s.saveMatchResult(draft.id,home,away,draft.status)
    syncDrafts();message.value=`บันทึกผลสาย ${draft.group} นัดที่ ${draft.round} แล้ว`;messageType.value='ok'
  }catch(error){message.value=error instanceof Error?error.message:'บันทึกผลไม่สำเร็จ';messageType.value='error'}finally{busyMatch.value=''}
}
async function uploadLogo(code:string,event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(!file)return
  if(file.size>5*1024*1024){message.value='ไฟล์โลโก้ต้องไม่เกิน 5 MB';messageType.value='error';input.value='';return}
  uploadingCode.value=code;message.value=''
  try{await s.uploadTeamLogo(code,file);await s.loadTournament();syncDrafts();message.value='อัปเดตโลโก้ทีมแล้ว';messageType.value='ok'}catch(error){message.value=error instanceof Error?error.message:'อัปโหลดโลโก้ไม่สำเร็จ';messageType.value='error'}finally{uploadingCode.value='';input.value=''}
}

onMounted(async()=>{s.connect();await Promise.all([s.loadState(),s.loadTournament()]);syncDrafts()})
</script>

<template>
  <div class="page match-management-page">
    <TopBar/>
    <main class="content match-management">
      <header class="match-management-head">
        <div><div class="eyebrow">MATCH OPERATIONS CENTER</div><h1>จัดโปรแกรมและบันทึกผลการแข่งขัน</h1><p>กำหนดวัน เวลา สนาม คู่แข่งขัน และบันทึกสกอร์จากหน้าจอเดียว</p></div>
        <label class="division-select"><span>รุ่นการแข่งขัน</span><select v-model="s.divisionKey" :disabled="busy" @change="changeDivision"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></label>
      </header>

      <section class="match-summary-strip">
        <div><small>DIVISION</small><strong>{{s.division.name}}</strong><span>{{s.division.subtitle}}</span></div>
        <div><small>GROUP MATCHES</small><strong>{{s.groupMatches.length}} / 12</strong><span>โปรแกรมรอบแบ่งกลุ่ม</span></div>
        <div><small>FINISHED</small><strong>{{finishedCount}} / 12</strong><span>ผลที่ยืนยันแล้ว</span></div>
        <div class="match-summary-actions"><button class="btn" :disabled="busy" @click="logoEditor=!logoEditor">แก้ไขโลโก้ทีม</button><button class="btn gold" :disabled="busy" @click="generate">{{drafts.length?'สร้างโปรแกรมใหม่':'สร้างโปรแกรม 12 นัด'}}</button></div>
      </section>

      <section v-if="logoEditor" class="match-logo-editor">
        <header><div><div class="eyebrow">TEAM BRANDING</div><h2>โลโก้ทีม — {{s.division.name}}</h2></div><button class="editor-close" @click="logoEditor=false">×</button></header>
        <div class="match-logo-grid"><label v-for="item in s.teams" :key="item.id" class="match-logo-item"><span><img v-if="item.logoUrl" :src="item.logoUrl" :alt="`โลโก้ ${item.name}`"><b v-else>{{initials(item.name)}}</b></span><strong>{{item.name}}</strong><em>{{uploadingCode===item.id?'กำลังอัปโหลด...':item.logoUrl?'เปลี่ยนโลโก้':'เพิ่มโลโก้'}}</em><input type="file" accept="image/png,image/jpeg,image/webp" :disabled="Boolean(uploadingCode)" @change="uploadLogo(item.id,$event)"></label></div>
      </section>

      <section v-if="drafts.length" class="schedule-planner">
        <div class="schedule-planner-copy"><div class="eyebrow">QUICK SCHEDULER</div><h2>จัดวันเวลาแข่งขันต่อเนื่อง</h2><p>เรียงการแข่งขันตามรอบ 1–3 และสาย A–D แล้วเว้นช่วงตามจำนวนที่กำหนด</p></div>
        <label><span>วันที่เริ่ม</span><input v-model="scheduleDate" type="date"></label>
        <label><span>เวลาเริ่ม</span><input v-model="startTime" type="time"></label>
        <label><span>ห่างกัน</span><div class="input-suffix"><input v-model.number="slotMinutes" type="number" min="1" max="240"><b>นาที</b></div></label>
        <label><span>สนามเริ่มต้น</span><input v-model="defaultField" maxlength="120" placeholder="ชื่อสนาม"></label>
        <button class="btn gold" @click="applyDatePlan">จัดเวลาให้อัตโนมัติ</button>
      </section>

      <p v-if="message" :class="['match-message',messageType]">{{message}}</p>
      <div v-if="!drafts.length" class="match-empty-state"><b>ยังไม่มีโปรแกรมการแข่งขัน</b><p>ผลแบ่งสายของรุ่นนี้ต้องครบและล็อกอย่างเป็นทางการแล้ว จากนั้นกด “สร้างโปรแกรม 12 นัด”</p><button class="btn gold" :disabled="busy" @click="generate">สร้างโปรแกรมจากผลแบ่งสาย</button></div>

      <section v-else class="match-table-card">
        <header><div><div class="eyebrow">OFFICIAL FIXTURES & RESULTS</div><h2>ตารางแข่งขันและบันทึกผล</h2></div><button class="btn gold" :disabled="busy" @click="saveSchedule">{{busy?'กำลังบันทึก...':'บันทึกโปรแกรมทั้งหมด'}}</button></header>
        <div class="match-table-scroll"><table class="match-operations-table"><thead><tr><th>ลำดับ</th><th>วันและเวลา</th><th>สาย/รอบ</th><th>ทีมเหย้า</th><th>ผล</th><th>ทีมเยือน</th><th>สนาม</th><th>สถานะ</th><th></th></tr></thead><tbody><tr v-for="(draft,index) in drafts" :key="draft.id" :class="draft.status.toLowerCase()"><td><b>{{index+1}}</b></td><td><input v-model="draft.kickoffLocal" type="datetime-local"></td><td><span class="match-group-chip">{{draft.group}}</span><small>รอบ {{draft.round}}</small></td><td><div class="match-team-select"><span><img v-if="team(draft.homeTeamCode)?.logoUrl" :src="team(draft.homeTeamCode)?.logoUrl" alt=""><b v-else>{{initials(team(draft.homeTeamCode)?.name||'?')}}</b></span><select v-model="draft.homeTeamCode"><option v-for="option in teamsInGroup(draft.group)" :key="option.id" :value="option.id" :disabled="option.id===draft.awayTeamCode">{{option.name}}</option></select></div></td><td><div class="score-inputs"><input v-model.number="draft.homeScore" type="number" min="0"><b>–</b><input v-model.number="draft.awayScore" type="number" min="0"></div></td><td><div class="match-team-select"><span><img v-if="team(draft.awayTeamCode)?.logoUrl" :src="team(draft.awayTeamCode)?.logoUrl" alt=""><b v-else>{{initials(team(draft.awayTeamCode)?.name||'?')}}</b></span><select v-model="draft.awayTeamCode"><option v-for="option in teamsInGroup(draft.group)" :key="option.id" :value="option.id" :disabled="option.id===draft.homeTeamCode">{{option.name}}</option></select></div></td><td><input v-model.trim="draft.field" maxlength="120" placeholder="สนาม"></td><td><select v-model="draft.status"><option value="SCHEDULED">รอแข่ง</option><option value="LIVE">กำลังแข่ง</option><option value="FINISHED">จบแล้ว</option></select></td><td><button class="mini save-result" :disabled="Boolean(busyMatch)" @click="saveResult(draft)">{{busyMatch===draft.id?'…':'บันทึกผล'}}</button></td></tr></tbody></table></div>
      </section>

      <section v-if="drafts.length" class="match-standings-preview"><header><div><div class="eyebrow">LIVE GROUP TABLES</div><h2>ตารางคะแนนล่าสุด</h2></div><RouterLink class="btn" to="/standings">เปิดหน้าตารางคะแนนเต็ม</RouterLink></header><div class="standings-grid"><article v-for="group in groupCodes" :key="group" class="table-card compact-table"><h3>สาย {{group}}</h3><table><thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ได้/เสีย</th><th>+/-</th><th>แต้ม</th></tr></thead><tbody><tr v-for="row in s.standings[group]" :key="row.team.id" :class="{qualify:row.rank<=2}"><td>{{row.rank}}</td><td><span class="standing-team"><img v-if="row.team.logoUrl" :src="row.team.logoUrl" alt=""><b>{{row.team.name}}</b></span></td><td>{{row.p}}</td><td>{{row.gf}}/{{row.ga}}</td><td>{{row.gd}}</td><td><strong>{{row.pts}}</strong></td></tr></tbody></table></article></div></section>
    </main>
  </div>
</template>
