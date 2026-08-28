import {io} from 'socket.io-client'

const baseUrl=process.env.BASE_URL||'http://127.0.0.1:4000'
const division=process.env.DIVISION||'SENIOR40'
if(process.env.ALLOW_DRAW_SMOKE_RESET!=='YES_I_UNDERSTAND')throw new Error('Refusing to reset draw data. Set ALLOW_DRAW_SMOKE_RESET=YES_I_UNDERSTAND only on the pre-production smoke-test database.')

const sockets=[io(baseUrl,{transports:['websocket','polling']}),io(baseUrl,{transports:['websocket','polling']})]
const headers={'content-type':'application/json','x-admin-user':'deployment-smoke'}
const waitFor=(socket,predicate)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off('draw:state',listener);reject(new Error('Timed out waiting for realtime draw state'))},10_000)
  const listener=state=>{if(predicate(state)){clearTimeout(timer);socket.off('draw:state',listener);resolve(state)}}
  socket.on('draw:state',listener)
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
  const ready=sockets.map(socket=>waitFor(socket,state=>state.divisionKey===division&&state.drawnIds.length===0))
  await post('/api/draw/reset',{divisionKey:division})
  await Promise.all(ready)
  const updated=sockets.map(socket=>waitFor(socket,state=>state.divisionKey===division&&state.drawnIds.length===1))
  await post('/api/draw/next',{divisionKey:division})
  await Promise.all(updated)
  const persisted=await(await fetch(`${baseUrl}/api/draw/${division}`)).json()
  if(persisted.drawnIds.length!==1)throw new Error('The draw update was not persisted')
  await post('/api/draw/reset',{divisionKey:division})
  console.log('PASS: two realtime clients received the persisted admin draw update; smoke data was reset')
}finally{
  sockets.forEach(socket=>socket.close())
}
