<script setup lang="ts">
import {computed,onMounted} from 'vue'
import GroupCard from '../components/GroupCard.vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
import type {DivisionKey,OfficialScheduleEntry} from '../lib/types'
const s=useTournamentStore()
const results=computed(()=>s.matches.filter(match=>match.status==='FINISHED').slice(-8).reverse())
const scheduleDays=computed(()=>{
  const days=new Map<string,OfficialScheduleEntry[]>()
  for(const entry of s.scheduleEntries){const key=entry.startsAt.slice(0,10);days.set(key,[...(days.get(key)??[]),entry])}
  return[...days.entries()].map(([date,entries])=>({date,entries}))
})
const dateTitle=(date:string)=>new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'})
const timeOnly=(value:string)=>new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'})
const stageTitle=(entry:OfficialScheduleEntry)=>entry.stage==='GROUP'?`สาย ${entry.groupLabel}`:entry.stage==='QF'?`รอบ 8 ทีม ${entry.groupLabel}`:entry.stage==='SF'?'รอบรองชนะเลิศ':entry.stage==='FINAL'?'รอบชิงชนะเลิศ':'คู่พิเศษ'
const lunchBefore=(entries:OfficialScheduleEntry[],index:number)=>index>0&&new Date(entries[index].startsAt).getTime()-new Date(entries[index-1].endsAt).getTime()>=60*60_000
const selectDivision=(key:DivisionKey)=>key!==s.divisionKey&&s.setDivision(key)
onMounted(()=>{s.connect();Promise.all([s.loadState(),s.loadTournament(),s.loadOfficialSchedule()])})
</script>

<template>
  <div class="public-page"><TopBar/>
    <header class="public-hero"><div class="cup">🏆</div><div><small>OFFICIAL TOURNAMENT CENTER</small><h1>ฟุตบอลเฉลิมพระเกียรติ</h1><p>ครั้งที่ 13/2569 • ตารางแข่งขันอย่างเป็นทางการ</p></div><div class="public-division-switch" role="group" aria-label="เลือกผลแบ่งสาย"><small>เลือกผลแบ่งสาย</small><div><button :class="{active:s.divisionKey==='PUBLIC'}" :aria-pressed="s.divisionKey==='PUBLIC'" @click="selectDivision('PUBLIC')"><span>รุ่นประชาชน</span><small>ภายในอำเภอปลาปาก</small></button><button :class="{active:s.divisionKey==='SENIOR40'}" :aria-pressed="s.divisionKey==='SENIOR40'" @click="selectDivision('SENIOR40')"><span>รุ่นอาวุโส 40+</span><small>OPEN</small></button></div></div></header>
    <main class="public-content">
      <section><div class="section-title"><h2>ผลแบ่งสาย — {{s.division.name}}</h2><span>OFFICIAL</span></div><div class="group-grid"><GroupCard name="A" :teams="s.groups.A" :division="s.divisionKey"/><GroupCard name="B" :teams="s.groups.B" :division="s.divisionKey"/><GroupCard name="C" :teams="s.groups.C" :division="s.divisionKey"/><GroupCard name="D" :teams="s.groups.D" :division="s.divisionKey"/></div></section>

      <section class="public-official-schedule">
        <div class="section-title"><div><h2>ตารางแข่งขันรวมทั้ง 2 รุ่น</h2><p>แสดงรอบแบ่งกลุ่ม รอบน็อกเอาต์ รอบชิงชนะเลิศ และคู่พิเศษในหน้าเดียว</p></div><span>39 MATCHES</span></div>
        <div v-if="scheduleDays.length" class="public-schedule-days">
          <article v-for="day in scheduleDays" :key="day.date" class="public-schedule-day">
            <h3>{{dateTitle(day.date)}}</h3>
            <div class="public-schedule-scroll"><table><thead><tr><th>คู่</th><th>รุ่น</th><th>รอบ</th><th>เวลา</th><th>คู่แข่งขัน</th><th>ผล</th></tr></thead><tbody>
              <template v-for="(entry,index) in day.entries" :key="entry.id"><tr v-if="lunchBefore(day.entries,index)" class="lunch-row"><td colspan="6">พักเที่ยง</td></tr><tr :class="{'special-row':entry.stage==='SPECIAL'}"><td><b>{{entry.sequenceNo}}</b></td><td><span :class="['division-chip',entry.divisionKey?.toLowerCase()||'special']">{{entry.categoryLabel}}</span></td><td>{{stageTitle(entry)}}</td><td><time>{{timeOnly(entry.startsAt)}}–{{timeOnly(entry.endsAt)}}</time></td><td><div class="public-schedule-versus"><RouterLink v-if="entry.home.id" :to="`/teams/${entry.divisionKey}/${entry.home.id}`"><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" alt=""><b>{{entry.home.name}}</b></RouterLink><span v-else><b>{{entry.home.name}}</b></span><strong>VS</strong><RouterLink v-if="entry.away.id" :to="`/teams/${entry.divisionKey}/${entry.away.id}`"><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" alt=""><b>{{entry.away.name}}</b></RouterLink><span v-else><b>{{entry.away.name}}</b></span></div></td><td><strong v-if="entry.homeScore!==null&&entry.awayScore!==null" class="official-score">{{entry.homeScore}}–{{entry.awayScore}}</strong><span v-else>—</span></td></tr></template>
            </tbody></table></div>
          </article>
        </div>
        <p v-else class="muted">กำลังเตรียมตารางการแข่งขันอย่างเป็นทางการ</p>
      </section>

      <section><div class="section-title"><h2>ผลการแข่งขันล่าสุด — {{s.division.name}}</h2></div><div class="score-cards public-results"><article v-for="match in results" :key="match.id"><small>{{match.stage}} {{match.group?'• สาย '+match.group:''}}</small><div><b>{{match.home.name}}</b><strong>{{match.homeScore}} - {{match.awayScore}}</strong><b>{{match.away.name}}</b></div></article><p v-if="!results.length" class="muted">ยังไม่มีผลการแข่งขัน</p></div></section>
    </main>
  </div>
</template>
