<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import {useRoute} from 'vue-router'
import TopBar from '../components/TopBar.vue'
import {api} from '../stores/tournament'
import type {DivisionKey,DrawState,GroupCode,Match,OfficialScheduleEntry,Standing,Team} from '../lib/types'

const route=useRoute(),loading=ref(true),notFound=ref(false)
const state=ref<DrawState|null>(null),matches=ref<Match[]>([]),tables=ref<Record<GroupCode,Standing[]>|null>(null),schedule=ref<OfficialScheduleEntry[]>([])
const division=computed(()=>(route.params.division==='PUBLIC'?'PUBLIC':route.params.division==='SENIOR40'?'SENIOR40':null) as DivisionKey|null)
const code=computed(()=>String(route.params.code||''))
const team=computed<Team|undefined>(()=>state.value?.teams.find(item=>item.id===code.value))
const group=computed<GroupCode|undefined>(()=>(['A','B','C','D'] as GroupCode[]).find(group=>state.value?.groups[group].some(item=>item.id===code.value)))
const standing=computed(()=>group.value?tables.value?.[group.value].find(row=>row.team.id===code.value):undefined)
const fixtures=computed(()=>schedule.value.filter(entry=>entry.home.id===code.value||entry.away.id===code.value).sort((a,b)=>a.sequenceNo-b.sequenceNo))
const finished=computed(()=>fixtures.value.filter(item=>item.status==='FINISHED'))
const form=computed(()=>finished.value.map(item=>{const home=item.home.id===code.value,own=home?item.homeScore:item.awayScore,other=home?item.awayScore:item.homeScore;return own===other?'D':(own??0)>(other??0)?'W':'L'}))
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
const dateTime=(value:string)=>new Date(value).toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'})
const stage=(entry:OfficialScheduleEntry)=>entry.stage==='GROUP'?`รอบแบ่งกลุ่ม • สาย ${entry.groupLabel}`:entry.stage==='QF'?'รอบ 8 ทีม':entry.stage==='SF'?'รอบรองชนะเลิศ':entry.stage==='FINAL'?'รอบชิงชนะเลิศ':'คู่พิเศษ'
const opponent=(entry:OfficialScheduleEntry)=>entry.home.id===code.value?entry.away:entry.home
onMounted(async()=>{if(!division.value){notFound.value=true;loading.value=false;return}try{const [draw,tournament,official]=await Promise.all([fetch(`${api}/api/draw/${division.value}`).then(r=>r.json()),fetch(`${api}/api/tournament/${division.value}`).then(r=>r.json()),fetch(`${api}/api/schedule`).then(r=>r.json())]);state.value=draw;matches.value=tournament.matches??[];tables.value=tournament.standings;schedule.value=official;notFound.value=!draw.teams.some((item:Team)=>item.id===code.value)}catch{notFound.value=true}finally{loading.value=false}})
</script>

<template><div class="page team-detail-page"><TopBar/><main class="content team-detail-content"><div v-if="loading" class="public-empty">กำลังโหลดรายละเอียดทีม...</div><div v-else-if="notFound||!team" class="public-empty"><b>ไม่พบข้อมูลทีม</b><RouterLink class="btn gold" to="/teams">กลับไปหน้าทีมทั้งหมด</RouterLink></div><template v-else>
  <RouterLink class="back-link" to="/teams">‹ ทีมทั้งหมด</RouterLink>
  <header class="team-profile"><div class="team-profile-logo"><img v-if="team.logoUrl" :src="team.logoUrl" :alt="`โลโก้ ${team.name}`"><b v-else>{{initials(team.name)}}</b></div><div><div class="eyebrow">OFFICIAL TEAM PROFILE</div><h1>{{team.name}}</h1><p>{{division==='PUBLIC'?'รุ่นประชาชน':'รุ่นอาวุโส 40+'}} • สาย {{group}}</p></div><div class="team-rank"><small>อันดับล่าสุด</small><b>{{standing?.rank??'-'}}</b><span>สาย {{group}}</span></div></header>
  <section class="team-stat-strip"><div><small>แข่ง</small><b>{{standing?.p??0}}</b></div><div><small>ชนะ</small><b>{{standing?.w??0}}</b></div><div><small>เสมอ</small><b>{{standing?.d??0}}</b></div><div><small>แพ้</small><b>{{standing?.l??0}}</b></div><div><small>ได้ / เสีย</small><b>{{standing?.gf??0}} / {{standing?.ga??0}}</b></div><div><small>คะแนน</small><b>{{standing?.pts??0}}</b></div></section>
  <section class="team-fixtures-section"><header><div><div class="eyebrow">MATCHES</div><h2>โปรแกรมและผลการแข่งขัน</h2></div><div class="form-guide"><span v-for="(item,index) in form" :key="index" :class="item.toLowerCase()">{{item}}</span></div></header><div class="team-fixtures"><article v-for="entry in fixtures" :key="entry.id" :class="entry.status.toLowerCase()"><div class="team-fixture-meta"><b>คู่ที่ {{entry.sequenceNo}}</b><span>{{stage(entry)}}</span><time>{{dateTime(entry.startsAt)}}</time></div><div class="team-fixture-opponent"><span class="opponent-logo"><img v-if="opponent(entry).logoUrl" :src="opponent(entry).logoUrl" alt=""><b v-else>{{initials(opponent(entry).name)}}</b></span><div><small>พบกับ</small><strong>{{opponent(entry).name}}</strong></div><b v-if="entry.homeScore!==null&&entry.awayScore!==null" class="team-fixture-score">{{entry.homeScore}}–{{entry.awayScore}}</b><span v-else class="vs-chip">VS</span></div><footer>{{entry.field}} • {{entry.status==='FINISHED'?'จบการแข่งขัน':entry.status==='LIVE'?'กำลังแข่งขัน':'รอแข่งขัน'}}</footer></article><p v-if="!fixtures.length" class="muted">ยังไม่มีโปรแกรมการแข่งขันของทีมนี้</p></div></section>
</template></main></div></template>
