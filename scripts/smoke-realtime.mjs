import {io} from 'socket.io-client'

const baseUrl=process.env.BASE_URL||'http://127.0.0.1:4000'
const division=process.env.DIVISION||'SENIOR40'
if(process.env.ALLOW_DRAW_SMOKE_RESET!=='YES_I_UNDERSTAND')throw new Error('Refusing to reset draw data. Set ALLOW_DRAW_SMOKE_RESET=YES_I_UNDERSTAND only on the pre-production smoke-test database.')

const sockets=[io(baseUrl,{transports:['websocket','polling']}),io(baseUrl,{transports:['websocket','polling']})]
const headers={'content-type':'application/json','x-admin-user':'deployment-smoke'}
const waitFor=(socket,event,predicate)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off(event,listener);reject(new Error(`Timed out waiting for ${event}`))},12_000)
  const listener=value=>{if(predicate(value)){clearTimeout(timer);socket.off(event,listener);resolve(value)}}
  socket.on(event,listener)
})
const post=async(path,body)=>{
  const response=await fetch(`${baseUrl}${path}`,{method:'POST',headers,body:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok)throw new Error(data.message||`${path} failed`)
  return data
}

try{
  await Promise.all(sockets.map(socket=>new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)})))
  sockets.forEach(socket=>socket.emit('watch:division',division))
  const ready=sockets.map(socket=>waitFor(socket,'draw:state',state=>state.divisionKey===division&&state.drawnIds.length===0))
  await post('/api/draw/reset',{divisionKey:division})
  await Promise.all(ready)
  const spinning=sockets.map(socket=>waitFor(socket,'draw:spinning',event=>event.divisionKey===division&&event.teams.length>0&&event.durationMs+event.settleDurationMs>=4_000))
  const settling=sockets.map(socket=>waitFor(socket,'draw:settling',event=>event.divisionKey===division&&typeof event.targetTeamId==='string'))
  const updated=sockets.map(socket=>waitFor(socket,'draw:state',state=>state.divisionKey===division&&state.drawnIds.length===1))
  const startedAt=Date.now()
  const drawRequest=post('/api/draw/next',{divisionKey:division})
  const spinEvents=await Promise.all(spinning)
  await new Promise(resolve=>setTimeout(resolve,600))
  const duringSpin=await(await fetch(`${baseUrl}/api/draw/${division}`)).json()
  if(duringSpin.drawnIds.length!==0)throw new Error('The result was persisted before the wheel stopped')
  const settleEvents=await Promise.all(settling)
  const candidateIds=new Set(spinEvents[0].teams.map(team=>team.id))
  if(!settleEvents.every(event=>candidateIds.has(event.targetTeamId)))throw new Error('The wheel target was not one of the eligible candidates')
  await drawRequest
  if(Date.now()-startedAt<4_000)throw new Error('The draw completed before the ceremony wheel duration')
  await Promise.all(updated)
  const persisted=await(await fetch(`${baseUrl}/api/draw/${division}`)).json()
  if(persisted.drawnIds.length!==1)throw new Error('The draw update was not persisted')
  await post('/api/draw/reset',{divisionKey:division})
  console.log('PASS: two clients saw the wheel before one persisted reveal; smoke data was reset')
}finally{
  sockets.forEach(socket=>socket.close())
}
