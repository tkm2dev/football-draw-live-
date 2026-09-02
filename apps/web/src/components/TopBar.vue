<script setup lang="ts">
import TournamentCrest from './TournamentCrest.vue'
defineProps<{admin?:boolean}>()
const organizers=[
  {name:'เทศบาลตำบลปลาปาก',role:'หน่วยงานผู้จัด',logo:'/assets/organizers/pla-pak-municipality.png'},
  {name:'สภ.ปลาปาก',role:'ทีมงานผู้จัด',logo:'/assets/organizers/pla-pak-police.png'},
  {name:'เพื่อนเยาวชน',role:'ทีมงานการแข่งขัน',logo:'/assets/organizers/peuan-yaowachon-academy.png'},
  {name:'ธ.ก.ส.',role:'ผู้สนับสนุนการแข่งขัน',logo:'/assets/organizers/baac.png'},
]
</script>
<template>
  <header class="topbar public-topbar">
    <RouterLink class="brand" to="/matches"><TournamentCrest/><div><b>FOOTBALL TOURNAMENT</b><small>เฉลิมพระเกียรติ ครั้งที่ 13/2569</small></div></RouterLink>
    <nav>
      <RouterLink to="/matches">ตารางแข่งขัน</RouterLink>
      <RouterLink to="/teams">ทีมและสาย</RouterLink>
      <RouterLink to="/standings">ตารางคะแนน</RouterLink>
      <RouterLink to="/rounds">รอบการแข่งขัน</RouterLink>
      <RouterLink to="/results">ผลการแข่งขัน</RouterLink>
    </nav>
    <span v-if="admin" class="admin-chip">ADMIN</span>
  </header>
  <section v-if="!admin" class="organizer-strip" aria-label="ทีมงานผู้จัดและผู้สนับสนุนการแข่งขัน">
    <div class="organizer-inner"><div class="organizer-title"><small>ORGANIZERS &amp; SUPPORTERS</small><b>ทีมงานผู้จัดและผู้สนับสนุน</b></div><div class="organizer-list"><figure v-for="item in organizers" :key="item.name"><span><img :src="item.logo" :alt="`โลโก้ ${item.name}`"></span><figcaption><strong>{{item.name}}</strong><small>{{item.role}}</small></figcaption></figure></div></div>
  </section>
</template>
