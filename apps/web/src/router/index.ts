import{createRouter,createWebHistory}from'vue-router'
import DrawAdminView from'../views/DrawAdminView.vue'
import LiveDrawView from'../views/LiveDrawView.vue'
import MatchesView from'../views/MatchesView.vue'
import StandingsView from'../views/StandingsView.vue'
import BracketView from'../views/BracketView.vue'
import PublicView from'../views/PublicView.vue'
import TeamDirectoryView from'../views/TeamDirectoryView.vue'
import TeamDetailView from'../views/TeamDetailView.vue'
import ResultsView from'../views/ResultsView.vue'
import InfographicView from'../views/InfographicView.vue'

export default createRouter({history:createWebHistory(),routes:[
  {path:'/',redirect:'/matches'},
  {path:'/matches',component:PublicView},
  {path:'/teams',component:TeamDirectoryView},
  {path:'/teams/:division/:code',component:TeamDetailView},
  {path:'/standings',component:StandingsView},
  {path:'/rounds',component:BracketView},
  {path:'/results',component:ResultsView},
  {path:'/infographic',component:InfographicView},
  {path:'/admin/results',component:MatchesView},
  {path:'/draw/admin',component:DrawAdminView},
  {path:'/live/draw',component:LiveDrawView},
  {path:'/groups',redirect:'/teams'},
  {path:'/bracket',redirect:'/rounds'},
  {path:'/public',redirect:'/matches'},
]})
