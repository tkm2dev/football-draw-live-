<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
import type {GroupCode,Match,OfficialScheduleEntry,Team} from '../lib/types'

interface MatchDraft{id:string;sequenceNo:number;group:GroupCode;round:number;homeTeamCode:string;awayTeamCode:string;kickoffLocal:string;field:string;homeScore:number|null;awayScore:number|null;status:Match['status']}
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
const draggingCode=ref('')
const pasteTargetCode=ref('')
const groupCodes:GroupCode[]=['A','B','C','D']
const finishedCount=computed(()=>s.groupMatches.filter(match=>match.status==='FINISHED').length)
const officialDays=computed(()=>{
  const days=new Map<string,OfficialScheduleEntry[]>()
  for(const entry of s.scheduleEntries){const key=entry.startsAt.slice(0,10);days.set(key,[...(days.get(key)??[]),entry])}
  return[...days.entries()].map(([date,entries])=>({date,entries}))
})

const localInput=(iso:string|null|undefined)=>{
  if(!iso)return''
  const date=new Date(iso)
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60_000)
  return local.toISOString().slice(0,16)
}
function syncDrafts(){drafts.value=[...s.groupMatches].sort((a,b)=>(a.sequenceNo??999)-(b.sequenceNo??999)||a.round-b.round||(a.group??'').localeCompare(b.group??'')).map((match,index)=>({id:match.id,sequenceNo:match.sequenceNo??index+1,group:match.group!,round:match.round,homeTeamCode:match.home.id,awayTeamCode:match.away.id,kickoffLocal:localInput(match.kickoffAt),field:match.field||'',homeScore:match.homeScore,awayScore:match.awayScore,status:match.status}))}
watch(()=>s.matches,syncDrafts,{deep:true})
const teamsInGroup=(group:GroupCode)=>s.groups[group]
const team=(code:string):Team|undefined=>s.teams.find(item=>item.id===code)
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const score=(value:unknown)=>value===''||value===null||value===undefined?null:Number(value)

async function run(action:()=>Promise<void>,success:string){busy.value=true;message.value='';try{await action();message.value=success;messageType.value='ok'}catch(error){message.value=error instanceof Error?error.message:'เกิดข้อผิดพลาด';messageType.value='error'}finally{busy.value=false}}
async function changeDivision(){logoEditor.value=false;await run(async()=>{await s.setDivision(s.divisionKey);syncDrafts()},'โหลดข้อมูลการแข่งขันแล้ว')}
async function installOfficial(){
  if(s.scheduleEntries.length&&!window.confirm('ติดตั้งตารางทางการใหม่? โปรแกรมเดิมที่ยังไม่เริ่มแข่งจะถูกแทนที่'))return
  await run(async()=>{await s.installOfficialSchedule();syncDrafts()},'ติดตั้งตารางทางการครบ 39 คู่ และผูกรอบแบ่งกลุ่ม 24 คู่แล้ว')
}
const dateTitle=(date:string)=>new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'})
const timeOnly=(value:string)=>new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'})
const stageTitle=(entry:OfficialScheduleEntry)=>entry.stage==='GROUP'?`สาย ${entry.groupLabel}`:entry.stage==='QF'?`รอบ 8 ทีม ${entry.groupLabel}`:entry.stage==='SF'?'รอบรองชนะเลิศ':entry.stage==='FINAL'?'รอบชิงชนะเลิศ':'คู่พิเศษ'
const lunchBefore=(entries:OfficialScheduleEntry[],index:number)=>index>0&&new Date(entries[index].startsAt).getTime()-new Date(entries[index-1].endsAt).getTime()>=60*60_000
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
async function uploadLogoFile(code:string,file:File,input?:HTMLInputElement){
  if(!file)return
  if(file.size>5*1024*1024){message.value='ไฟล์โลโก้ต้องไม่เกิน 5 MB';messageType.value='error';if(input)input.value='';return}
  if(uploadingCode.value){message.value='กรุณารอให้อัปโหลดไฟล์ปัจจุบันเสร็จก่อน';messageType.value='error';return}
  uploadingCode.value=code;message.value=''
  try{await s.uploadTeamLogo(code,file);await Promise.all([s.loadTournament(),s.loadOfficialSchedule()]);syncDrafts();message.value=`อัปเดตโลโก้ ${team(code)?.name??'ทีม'} แล้ว`;messageType.value='ok'}catch(error){message.value=error instanceof Error?error.message:'อัปโหลดโลโก้ไม่สำเร็จ';messageType.value='error'}finally{uploadingCode.value='';if(input)input.value=''}
}
async function uploadLogo(code:string,event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(file)await uploadLogoFile(code,file,input)
}
function dragLogo(code:string,event:DragEvent){
  if(uploadingCode.value)return
  draggingCode.value=code
  if(event.dataTransfer)event.dataTransfer.dropEffect='copy'
}
function leaveLogo(code:string,event:DragEvent){
  const card=event.currentTarget as HTMLElement|null,related=event.relatedTarget
  if(card&&related instanceof Node&&card.contains(related))return
  if(draggingCode.value===code)draggingCode.value=''
}
async function dropLogo(code:string,event:DragEvent){
  draggingCode.value=''
  const file=event.dataTransfer?.files?.[0]
  if(!file){message.value='ไม่พบไฟล์ภาพที่ลากมาวาง';messageType.value='error';return}
  await uploadLogoFile(code,file)
}
async function pasteLogo(event:ClipboardEvent){
  if(!logoEditor.value||!pasteTargetCode.value||uploadingCode.value)return
  const items=Array.from(event.clipboardData?.items??[])
  const imageItem=items.find(item=>item.kind==='file'&&item.type.startsWith('image/'))
  const file=imageItem?.getAsFile()??Array.from(event.clipboardData?.files??[]).find(item=>item.type.startsWith('image/'))
  if(!file){message.value='ใน Clipboard ไม่มีไฟล์ภาพ กรุณาคัดลอกรูปก่อนแล้วลองวางใหม่';messageType.value='error';return}
  event.preventDefault()
  await uploadLogoFile(pasteTargetCode.value,file)
}

onMounted(async()=>{window.addEventListener('paste',pasteLogo);s.connect();await Promise.all([s.loadState(),s.loadTournament(),s.loadOfficialSchedule()]);syncDrafts()})
onBeforeUnmount(()=>window.removeEventListener('paste',pasteLogo))
</script>

<template>
  <div class="page match-management-page">
    <TopBar admin/>
    <main class="content match-management">
      <header class="match-management-head">
        <div><div class="eyebrow">MATCH OPERATIONS CENTER</div><h1>จัดโปรแกรมและบันทึกผลการแข่งขัน</h1><p>กำหนดวัน เวลา สนาม คู่แข่งขัน และบันทึกสกอร์จากหน้าจอเดียว</p></div>
        <label class="division-select"><span>รุ่นการแข่งขัน</span><select v-model="s.divisionKey" :disabled="busy" @change="changeDivision"><option value="PUBLIC">รุ่นประชาชน</option><option value="SENIOR40">รุ่นอาวุโส 40+</option></select></label>
      </header>

      <section class="match-summary-strip">
        <div><small>DIVISION</small><strong>{{s.division.name}}</strong><span>{{s.division.subtitle}}</span></div>
        <div><small>GROUP MATCHES</small><strong>{{s.groupMatches.length}} / 12</strong><span>โปรแกรมรอบแบ่งกลุ่ม</span></div>
        <div><small>FINISHED</small><strong>{{finishedCount}} / 12</strong><span>ผลที่ยืนยันแล้ว</span></div>
        <div class="match-summary-actions"><button class="btn" :disabled="busy" @click="logoEditor=!logoEditor">แก้ไขโลโก้ทีม</button><button class="btn gold" :disabled="busy" @click="installOfficial">{{s.scheduleEntries.length?'ติดตั้งตารางทางการใหม่':'ใช้ตารางทางการ 39 คู่'}}</button></div>
      </section>

      <section v-if="logoEditor" class="match-logo-editor">
        <header><div><div class="eyebrow">TEAM BRANDING</div><h2>โลโก้ทีม — {{s.division.name}}</h2><p>คลิกเลือกไฟล์ ลากไฟล์มาวาง หรือชี้เมาส์บนทีมแล้วกด Ctrl+V / ⌘+V เพื่อวางรูปจาก Clipboard • PNG, JPG, WebP ไม่เกิน 5 MB</p></div><button class="editor-close" @click="logoEditor=false">×</button></header>
        <div class="match-logo-grid"><label v-for="item in s.teams" :key="item.id" tabindex="0" :class="['match-logo-item',{dragging:draggingCode===item.id,uploading:uploadingCode===item.id,'paste-target':pasteTargetCode===item.id}]" @mouseenter="pasteTargetCode=item.id" @mouseleave="pasteTargetCode===item.id&&(pasteTargetCode='')" @focusin="pasteTargetCode=item.id" @focusout="pasteTargetCode===item.id&&(pasteTargetCode='')" @dragenter.prevent="dragLogo(item.id,$event)" @dragover.prevent="dragLogo(item.id,$event)" @dragleave.prevent="leaveLogo(item.id,$event)" @drop.prevent="dropLogo(item.id,$event)"><span><img v-if="item.logoUrl" :src="item.logoUrl" :alt="`โลโก้ ${item.name}`"><b v-else>{{initials(item.name)}}</b></span><strong>{{item.name}}</strong><em>{{uploadingCode===item.id?'กำลังอัปโหลด...':pasteTargetCode===item.id?'พร้อมวางรูปด้วย Ctrl+V / ⌘+V':item.logoUrl?'ลาก วาง หรือคลิกเพื่อเปลี่ยน':'ลาก วาง หรือคลิกเพื่อเพิ่ม'}}</em><div v-if="draggingCode===item.id" class="logo-drop-overlay"><b>วางไฟล์ที่นี่</b><small>อัปเดตโลโก้ {{item.name}}</small></div><input type="file" accept="image/png,image/jpeg,image/webp" :aria-label="`อัปโหลดโลโก้ ${item.name}`" :disabled="Boolean(uploadingCode)" @change="uploadLogo(item.id,$event)"></label></div>
      </section>

      <section v-if="officialDays.length" class="official-schedule-card">
        <header><div><div class="eyebrow">OFFICIAL TOURNAMENT SCHEDULE</div><h2>ตารางแข่งขันรวมทั้ง 2 รุ่น — 39 คู่</h2><p>รอบแบ่งกลุ่ม 24 คู่ • รอบ 8 ทีม 8 คู่ • รอบรอง 4 คู่ • รอบชิง 2 คู่ • คู่พิเศษ 1 คู่</p></div><span class="official-badge">ยืนยันตามกำหนดการ</span></header>
        <div v-for="day in officialDays" :key="day.date" class="official-day">
          <h3>{{dateTitle(day.date)}}</h3>
          <div class="official-table-scroll"><table class="official-schedule-table"><thead><tr><th>คู่ที่</th><th>รุ่น</th><th>สาย/รอบ</th><th>เวลา</th><th>คู่แข่งขัน</th><th>ผล</th><th>สถานะ</th></tr></thead><tbody>
            <template v-for="(entry,index) in day.entries" :key="entry.id"><tr v-if="lunchBefore(day.entries,index)" class="lunch-row"><td colspan="7">พักเที่ยง</td></tr><tr :class="[entry.status.toLowerCase(),{'special-row':entry.stage==='SPECIAL'}]"><td><b>{{entry.sequenceNo}}</b></td><td><span :class="['division-chip',entry.divisionKey?.toLowerCase()||'special']">{{entry.categoryLabel}}</span></td><td>{{stageTitle(entry)}}</td><td><time>{{timeOnly(entry.startsAt)}}–{{timeOnly(entry.endsAt)}}</time></td><td><div class="official-versus"><span><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" alt=""><b>{{entry.home.name}}</b></span><strong>VS</strong><span><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" alt=""><b>{{entry.away.name}}</b></span></div></td><td><b v-if="entry.homeScore!==null&&entry.awayScore!==null" class="official-score">{{entry.homeScore}}–{{entry.awayScore}}</b><span v-else>—</span></td><td><span class="schedule-status">{{entry.status==='FINISHED'?'จบแล้ว':entry.status==='LIVE'?'กำลังแข่ง':'รอแข่ง'}}</span></td></tr></template>
          </tbody></table></div>
        </div>
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
      <div v-if="!drafts.length" class="match-empty-state"><b>ยังไม่มีโปรแกรมการแข่งขัน</b><p>ผลแบ่งสายทั้งสองรุ่นต้องครบและล็อกอย่างเป็นทางการแล้ว จากนั้นติดตั้งตาราง 39 คู่ตามกำหนดการ</p><button class="btn gold" :disabled="busy" @click="installOfficial">ใช้ตารางทางการ 39 คู่</button></div>

      <section v-else class="match-table-card">
        <header><div><div class="eyebrow">OFFICIAL FIXTURES & RESULTS</div><h2>ตารางแข่งขันและบันทึกผล</h2></div><button class="btn gold" :disabled="busy" @click="saveSchedule">{{busy?'กำลังบันทึก...':'บันทึกโปรแกรมทั้งหมด'}}</button></header>
        <div class="match-table-scroll"><table class="match-operations-table"><thead><tr><th>คู่ที่</th><th>วันและเวลา</th><th>สาย/รอบ</th><th>ทีมเหย้า</th><th>ผล</th><th>ทีมเยือน</th><th>สนาม</th><th>สถานะ</th><th></th></tr></thead><tbody><tr v-for="draft in drafts" :key="draft.id" :class="draft.status.toLowerCase()"><td><b>{{draft.sequenceNo}}</b></td><td><input v-model="draft.kickoffLocal" type="datetime-local"></td><td><span class="match-group-chip">{{draft.group}}</span><small>รอบ {{draft.round}}</small></td><td><div class="match-team-select"><span><img v-if="team(draft.homeTeamCode)?.logoUrl" :src="team(draft.homeTeamCode)?.logoUrl" alt=""><b v-else>{{initials(team(draft.homeTeamCode)?.name||'?')}}</b></span><select v-model="draft.homeTeamCode"><option v-for="option in teamsInGroup(draft.group)" :key="option.id" :value="option.id" :disabled="option.id===draft.awayTeamCode">{{option.name}}</option></select></div></td><td><div class="score-inputs"><input v-model.number="draft.homeScore" type="number" min="0"><b>–</b><input v-model.number="draft.awayScore" type="number" min="0"></div></td><td><div class="match-team-select"><span><img v-if="team(draft.awayTeamCode)?.logoUrl" :src="team(draft.awayTeamCode)?.logoUrl" alt=""><b v-else>{{initials(team(draft.awayTeamCode)?.name||'?')}}</b></span><select v-model="draft.awayTeamCode"><option v-for="option in teamsInGroup(draft.group)" :key="option.id" :value="option.id" :disabled="option.id===draft.homeTeamCode">{{option.name}}</option></select></div></td><td><input v-model.trim="draft.field" maxlength="120" placeholder="สนาม"></td><td><select v-model="draft.status"><option value="SCHEDULED">รอแข่ง</option><option value="LIVE">กำลังแข่ง</option><option value="FINISHED">จบแล้ว</option></select></td><td><button class="mini save-result" :disabled="Boolean(busyMatch)" @click="saveResult(draft)">{{busyMatch===draft.id?'…':'บันทึกผล'}}</button></td></tr></tbody></table></div>
      </section>

      <section v-if="drafts.length" class="match-standings-preview"><header><div><div class="eyebrow">LIVE GROUP TABLES</div><h2>ตารางคะแนนล่าสุด</h2></div><RouterLink class="btn" to="/standings">เปิดหน้าตารางคะแนนเต็ม</RouterLink></header><div class="standings-grid"><article v-for="group in groupCodes" :key="group" class="table-card compact-table"><h3>สาย {{group}}</h3><table><thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ได้/เสีย</th><th>+/-</th><th>แต้ม</th></tr></thead><tbody><tr v-for="row in s.standings[group]" :key="row.team.id" :class="{qualify:row.rank<=2}"><td>{{row.rank}}</td><td><span class="standing-team"><img v-if="row.team.logoUrl" :src="row.team.logoUrl" alt=""><b>{{row.team.name}}</b></span></td><td>{{row.p}}</td><td>{{row.gf}}/{{row.ga}}</td><td>{{row.gd}}</td><td><strong>{{row.pts}}</strong></td></tr></tbody></table></article></div></section>
    </main>
  </div>
</template>
