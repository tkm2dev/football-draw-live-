<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import TournamentCrest from '../components/TournamentCrest.vue'
import {useTournamentStore} from '../stores/tournament'
import type {OfficialScheduleEntry} from '../lib/types'

const s=useTournamentStore()
const route=useRoute()
const router=useRouter()
const selectedDate=ref(typeof route.query.date==='string'?route.query.date:'2026-09-06')
const exportMode=computed(()=>route.query.export==='1')
const timeZone='Asia/Bangkok'
const organizerLogos=[
  {name:'เทศบาลตำบลปลาปาก',logo:'/assets/organizers/pla-pak-municipality.png'},
  {name:'สภ.ปลาปาก',logo:'/assets/organizers/pla-pak-police.png'},
  {name:'เพื่อนเยาวชน',logo:'/assets/organizers/peuan-yaowachon-academy.png'},
  {name:'ธ.ก.ส.',logo:'/assets/organizers/baac.png'},
]

const localDate=(value:string)=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value))
  const valueOf=(type:string)=>parts.find(part=>part.type===type)?.value||''
  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`
}
const dates=computed(()=>[...new Set(s.scheduleEntries.map(item=>localDate(item.startsAt)))].sort())
const matches=computed(()=>s.scheduleEntries.filter(item=>localDate(item.startsAt)===selectedDate.value).sort((a,b)=>a.sequenceNo-b.sequenceNo))
const posterDate=computed(()=>new Date(`${selectedDate.value}T12:00:00+07:00`).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone}))
const shortDate=(value:string)=>new Date(`${value}T12:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone})
const time=(value:string)=>new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone})
const initials=(name:string)=>name.trim().split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()
const divisionClass=(entry:OfficialScheduleEntry)=>entry.divisionKey==='SENIOR40'?'senior':'public'
const groupClass=(entry:OfficialScheduleEntry)=>`group-${(entry.groupLabel||'other').toLowerCase()}`
const breakAfter=(index:number)=>{
  const current=matches.value[index]
  const next=matches.value[index+1]
  if(!current||!next)return ''
  const gap=new Date(next.startsAt).getTime()-new Date(current.endsAt).getTime()
  return gap>=45*60*1000?`${time(current.endsAt)}–${time(next.startsAt)} น.`:''
}

watch(selectedDate,date=>router.replace({query:{...route.query,date}}))
onMounted(async()=>{
  await s.loadOfficialSchedule()
  if(!dates.value.includes(selectedDate.value)&&dates.value.length)selectedDate.value=dates.value[0]
})
</script>

<template>
  <div :class="['infographic-page',{exporting:exportMode}]">
    <header class="infographic-toolbar">
      <div><RouterLink to="/matches">← กลับหน้าตารางแข่งขัน</RouterLink><h1>ภาพประชาสัมพันธ์รายวัน</h1><p>เลือกวันที่เพื่อดูโปรแกรมในรูปแบบโปสเตอร์</p></div>
      <div class="infographic-tools">
        <nav aria-label="เลือกวันแข่งขัน"><button v-for="date in dates" :key="date" :class="{active:selectedDate===date}" type="button" @click="selectedDate=date">{{shortDate(date)}}</button></nav>
        <div v-if="selectedDate==='2026-09-06'" class="infographic-downloads">
          <a href="/infographics/program-2026-09-06-landscape.png" target="_blank" rel="noopener">เปิดโปสเตอร์แนวนอน</a>
          <a href="/downloads/team-logos-20-teams.zip" download>ดาวน์โหลดโลโก้ 20 ทีม</a>
        </div>
      </div>
    </header>

    <main class="infographic-preview">
      <article id="matchday-poster" :class="['matchday-poster',{dense:matches.length>8}]">
        <div class="poster-glow one"></div><div class="poster-glow two"></div>
        <header class="poster-hero">
          <div class="poster-ball" aria-hidden="true">⚽</div>
          <div class="poster-event">
            <small>ตารางการแข่งขันฟุตบอล</small>
            <b>เฉลิมพระเกียรติ ครั้งที่</b>
            <strong>13</strong>
          </div>
          <div class="poster-royal">
            <TournamentCrest/>
            <span>ด้วยสำนึกในพระมหากรุณาธิคุณ</span>
            <b>“กีฬา สร้างคน สร้างสังคม”</b>
            <small>ปลาปาก...ร่วมใจ สู่อนาคตที่ดีกว่า</small>
          </div>
          <div class="poster-date"><b>{{posterDate}}</b></div>
          <div class="poster-location"><span>●</span> สนามฟุตบอล อ.ปลาปาก จ.นครพนม</div>
        </header>

        <div class="poster-table-head" aria-hidden="true">
          <b>คู่ที่</b><b>รุ่น</b><b>สาย</b><b>เวลา</b><b>ทีมแข่งขัน</b>
        </div>

        <section class="poster-schedule">
          <template v-for="(entry,index) in matches" :key="entry.id">
            <article :class="['promo-match',divisionClass(entry)]">
              <div class="promo-number">{{entry.sequenceNo}}</div>
              <div class="promo-class"><b>{{entry.categoryLabel}}</b></div>
              <div :class="['promo-group',groupClass(entry)]">{{entry.groupLabel||'—'}}</div>
              <div class="promo-time"><b>{{time(entry.startsAt)}} - {{time(entry.endsAt)}}</b></div>
              <div class="promo-team home"><strong>{{entry.home.name}}</strong><i><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" :alt="`โลโก้ ${entry.home.name}`"><em v-else>{{initials(entry.home.name)}}</em></i></div>
              <div class="promo-vs"><small>VS</small></div>
              <div class="promo-team away"><i><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" :alt="`โลโก้ ${entry.away.name}`"><em v-else>{{initials(entry.away.name)}}</em></i><strong>{{entry.away.name}}</strong></div>
            </article>
            <div v-if="breakAfter(index)" class="poster-break"><span></span><b>พักเที่ยง <small>{{breakAfter(index)}}</small></b><span></span></div>
          </template>
        </section>

        <footer class="poster-footer">
          <div class="academy-brand"><img src="/assets/organizers/peuan-yaowachon-academy.png" alt="เพื่อนเยาวชน Academy"><b>เพื่อนเยาวชน <em>ACADEMY</em></b></div>
          <div class="poster-motto"><b>“มากกว่าการแข่งขัน คือ...มิตรภาพ”</b><span>FOOTBALL FOR A BETTER TOMORROW</span></div>
          <div class="poster-follow"><b>football.siteams.com</b><span>อ.ปลาปาก จ.นครพนม</span></div>
          <div class="poster-organizers"><span v-for="item in organizerLogos" :key="item.name"><img :src="item.logo" :alt="`โลโก้ ${item.name}`"></span></div>
        </footer>
      </article>
    </main>
  </div>
</template>
