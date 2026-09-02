<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import TopBar from '../components/TopBar.vue'
import {useTournamentStore} from '../stores/tournament'
import type {DivisionKey,OfficialScheduleEntry} from '../lib/types'

const s=useTournamentStore()
const division=ref<DivisionKey>('PUBLIC')

const stageRows=(stage:OfficialScheduleEntry['stage'])=>s.scheduleEntries
  .filter(item=>item.divisionKey===division.value&&item.stage===stage)
  .sort((a,b)=>a.sequenceNo-b.sequenceNo)

const quarterFinals=computed(()=>{
  const rows=stageRows('QF')
  if(rows.length!==4)return rows
  // The official crossing is QF 1 + QF 3 and QF 2 + QF 4.
  // Reordering them keeps each feeder pair beside its semifinal.
  return [rows[0],rows[2],rows[1],rows[3]]
})
const semiFinals=computed(()=>stageRows('SF'))
const finals=computed(()=>stageRows('FINAL'))
const finished=computed(()=>s.scheduleEntries.filter(item=>item.divisionKey===division.value&&item.status==='FINISHED').length)
const champion=computed(()=>{
  const final=finals.value[0]
  if(!final||final.status!=='FINISHED'||final.homeScore===null||final.awayScore===null||final.homeScore===final.awayScore)return null
  return final.homeScore>final.awayScore?final.home:final.away
})

const dateTime=(value:string)=>new Date(value).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'})
const teamUrl=(entry:OfficialScheduleEntry,side:'home'|'away')=>entry[side].id?`/teams/${entry.divisionKey}/${entry[side].id}`:''
const initials=(name:string)=>name.trim().split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()
const isWinner=(entry:OfficialScheduleEntry,side:'home'|'away')=>{
  if(entry.status!=='FINISHED'||entry.homeScore===null||entry.awayScore===null||entry.homeScore===entry.awayScore)return false
  return side==='home'?entry.homeScore>entry.awayScore:entry.awayScore>entry.homeScore
}
const statusLabel=(entry:OfficialScheduleEntry)=>entry.status==='FINISHED'?'จบการแข่งขัน':entry.status==='LIVE'?'กำลังแข่งขัน':'รอการแข่งขัน'

onMounted(()=>s.loadOfficialSchedule())
</script>

<template>
  <div class="page rounds-page">
    <TopBar/>
    <main class="content rounds-content">
      <header class="hub-heading rounds-heading">
        <div>
          <div class="eyebrow">TOURNAMENT BRACKET</div>
          <h1>แผนผังรอบการแข่งขัน</h1>
          <p>ติดตามเส้นทางของแต่ละทีม ตั้งแต่รอบ 8 ทีมจนถึงแชมป์ของการแข่งขัน</p>
        </div>
        <div class="public-division-switch rounds-division-switch">
          <small>เลือกรุ่นการแข่งขัน</small>
          <div>
            <button :class="{active:division==='PUBLIC'}" type="button" @click="division='PUBLIC'">
              <span>รุ่นประชาชน</span><small>PUBLIC DIVISION</small>
            </button>
            <button :class="{active:division==='SENIOR40'}" type="button" @click="division='SENIOR40'">
              <span>รุ่นอาวุโส 40+</span><small>SENIOR 40+ DIVISION</small>
            </button>
          </div>
        </div>
      </header>

      <section class="rounds-summary">
        <div><small>DIVISION</small><b>{{division==='PUBLIC'?'รุ่นประชาชน':'รุ่นอาวุโส 40+'}}</b></div>
        <div><small>QUALIFIERS</small><b>8 ทีม</b></div>
        <div><small>RESULTS</small><b>{{finished}} นัด</b></div>
      </section>

      <div class="bracket-swipe-hint">เลื่อนซ้าย–ขวาเพื่อดูแผนผังทั้งหมด</div>
      <section class="bracket-viewport" aria-label="แผนผังการแข่งขันรอบน็อกเอาต์">
        <div class="knockout-tree">
          <header class="tree-stage-title qf-title"><small>QUARTER FINALS</small><h2>รอบ 8 ทีม</h2><span>4 คู่</span></header>
          <header class="tree-stage-title sf-title"><small>SEMI FINALS</small><h2>รอบรองชนะเลิศ</h2><span>2 คู่</span></header>
          <header class="tree-stage-title final-title"><small>FINAL</small><h2>รอบชิงชนะเลิศ</h2><span>1 คู่</span></header>

          <div class="tree-stage qf-stage">
            <article v-for="entry in quarterFinals" :key="entry.id" :class="['tree-match',entry.status.toLowerCase()]">
              <div class="bracket-fixture-meta"><b>คู่ที่ {{entry.sequenceNo}}</b><time>{{dateTime(entry.startsAt)}}</time></div>
              <div :class="['bracket-team',{winner:isWinner(entry,'home')}]">
                <i><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" :alt="`โลโก้ ${entry.home.name}`"><em v-else>{{initials(entry.home.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'home')" :to="teamUrl(entry,'home')">{{entry.home.name}}</RouterLink><b v-else>{{entry.home.name}}</b>
                <strong>{{entry.homeScore??'-'}}</strong>
              </div>
              <div :class="['bracket-team',{winner:isWinner(entry,'away')}]">
                <i><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" :alt="`โลโก้ ${entry.away.name}`"><em v-else>{{initials(entry.away.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'away')" :to="teamUrl(entry,'away')">{{entry.away.name}}</RouterLink><b v-else>{{entry.away.name}}</b>
                <strong>{{entry.awayScore??'-'}}</strong>
              </div>
              <footer>{{statusLabel(entry)}}</footer>
            </article>
          </div>

          <div class="tree-connectors qf-connectors" aria-hidden="true"><i></i><i></i></div>

          <div class="tree-stage sf-stage">
            <article v-for="entry in semiFinals" :key="entry.id" :class="['tree-match',entry.status.toLowerCase()]">
              <div class="bracket-fixture-meta"><b>คู่ที่ {{entry.sequenceNo}}</b><time>{{dateTime(entry.startsAt)}}</time></div>
              <div :class="['bracket-team',{winner:isWinner(entry,'home')}]">
                <i><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" :alt="`โลโก้ ${entry.home.name}`"><em v-else>{{initials(entry.home.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'home')" :to="teamUrl(entry,'home')">{{entry.home.name}}</RouterLink><b v-else>{{entry.home.name}}</b>
                <strong>{{entry.homeScore??'-'}}</strong>
              </div>
              <div :class="['bracket-team',{winner:isWinner(entry,'away')}]">
                <i><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" :alt="`โลโก้ ${entry.away.name}`"><em v-else>{{initials(entry.away.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'away')" :to="teamUrl(entry,'away')">{{entry.away.name}}</RouterLink><b v-else>{{entry.away.name}}</b>
                <strong>{{entry.awayScore??'-'}}</strong>
              </div>
              <footer>{{statusLabel(entry)}}</footer>
            </article>
          </div>

          <div class="tree-connectors final-connectors" aria-hidden="true"><i></i></div>

          <div class="tree-stage final-stage">
            <div class="final-crown"><span>★</span><b>CHAMPIONSHIP</b><span>★</span></div>
            <article v-for="entry in finals" :key="entry.id" :class="['tree-match',entry.status.toLowerCase()]">
              <div class="bracket-fixture-meta"><b>คู่ที่ {{entry.sequenceNo}}</b><time>{{dateTime(entry.startsAt)}}</time></div>
              <div :class="['bracket-team',{winner:isWinner(entry,'home')}]">
                <i><img v-if="entry.home.logoUrl" :src="entry.home.logoUrl" :alt="`โลโก้ ${entry.home.name}`"><em v-else>{{initials(entry.home.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'home')" :to="teamUrl(entry,'home')">{{entry.home.name}}</RouterLink><b v-else>{{entry.home.name}}</b>
                <strong>{{entry.homeScore??'-'}}</strong>
              </div>
              <div :class="['bracket-team',{winner:isWinner(entry,'away')}]">
                <i><img v-if="entry.away.logoUrl" :src="entry.away.logoUrl" :alt="`โลโก้ ${entry.away.name}`"><em v-else>{{initials(entry.away.name)}}</em></i>
                <RouterLink v-if="teamUrl(entry,'away')" :to="teamUrl(entry,'away')">{{entry.away.name}}</RouterLink><b v-else>{{entry.away.name}}</b>
                <strong>{{entry.awayScore??'-'}}</strong>
              </div>
              <footer>{{statusLabel(entry)}}</footer>
            </article>
            <div :class="['champion-podium',{decided:champion}]">
              <span class="champion-trophy">🏆</span>
              <small>{{champion?'CHAMPION':'ROAD TO CHAMPION'}}</small>
              <b>{{champion?.name||'รอผู้ชนะรอบชิงชนะเลิศ'}}</b>
            </div>
          </div>
        </div>
      </section>
      <p class="bracket-note">ชื่อทีมและผลการแข่งขันจะอัปเดตในแผนผังอัตโนมัติหลังแอดมินบันทึกผลแต่ละรอบ</p>
    </main>
  </div>
</template>
