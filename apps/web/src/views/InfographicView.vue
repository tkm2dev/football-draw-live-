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

watch(selectedDate,date=>router.replace({query:{date}}))
onMounted(async()=>{
  await s.loadOfficialSchedule()
  if(!dates.value.includes(selectedDate.value)&&dates.value.length)selectedDate.value=dates.value[0]
})
</script>

<template>
  <div :class="['infographic-page',{exporting:exportMode}]">
    <header class="infographic-toolbar">
      <div><RouterLink to="/matches">← กลับหน้าตารางแข่งขัน</RouterLink><h1>ภาพประชาสัมพันธ์รายวัน</h1><p>เลือกวันที่เพื่อดูโปรแกรมในรูปแบบโปสเตอร์</p></div>
      <nav aria-label="เลือกวันแข่งขัน"><button v-for="date in dates" :key="date" :class="{active:selectedDate===date}" type="button" @click="selectedDate=date">{{shortDate(date)}}</button></nav>
    </header>

    <main class="infographic-preview">
      <article id="matchday-poster" class="matchday-poster">
        <div class="poster-glow one"></div><div class="poster-glow two"></div>
        <header class="poster-header">
          <TournamentCrest/>
          <div class="poster-event"><small>FOOTBALL TOURNAMENT • MATCHDAY 01</small><b>การแข่งขันฟุตบอลเฉลิมพระเกียรติ</b><span>ครั้งที่ 13/2569 • อำเภอปลาปาก</span></div>
          <div class="poster-live"><i></i> OFFICIAL</div>
        </header>

        <section class="poster-title">
          <div><span></span><b>โปรแกรมการแข่งขัน</b><span></span></div>
          <h2>{{posterDate}}</h2>
          <p>{{matches.length}} MATCHES • 2 DIVISIONS • ONE GREAT DAY</p>
        </section>

        <section class="poster-schedule">
          <template v-for="(entry,index) in matches" :key="entry.id">
            <div v-if="index===2" class="poster-break"><span></span><b>พักเที่ยง • 11:40–13:00 น.</b><span></span></div>
            <article :class="['promo-match',divisionClass(entry)]">
              <div class="promo-time"><small>คู่ที่ {{entry.sequenceNo}}</small><b>{{time(entry.startsAt)}}</b><span>{{time(entry.endsAt)}} น.</span></div>
              <div class="promo-class"><b>{{entry.categoryLabel}}</b><span>สาย {{entry.groupLabel}}</span></div>
              <div class="promo-team home"><strong>{{entry.home.name}}</strong><i><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" :alt="`โลโก้ ${entry.home.name}`"><em v-else>{{initials(entry.home.name)}}</em></i></div>
              <div class="promo-vs"><small>VS</small></div>
              <div class="promo-team away"><i><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" :alt="`โลโก้ ${entry.away.name}`"><em v-else>{{initials(entry.away.name)}}</em></i><strong>{{entry.away.name}}</strong></div>
            </article>
          </template>
        </section>

        <footer class="poster-footer">
          <div class="poster-organizers"><span v-for="item in organizerLogos" :key="item.name"><i><img :src="item.logo" :alt="`โลโก้ ${item.name}`"></i><b>{{item.name}}</b></span></div>
          <div class="poster-follow"><small>ติดตามโปรแกรม ตารางคะแนน และผลการแข่งขัน</small><b>football.siteams.com</b></div>
        </footer>
      </article>
    </main>
  </div>
</template>
