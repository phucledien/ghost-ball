--!strict
return function(R: any,M: any,move: any,Sim: any,P: any,Gateway: any,bots: any)
local passed=0
local function test(name: string,fn: () -> ())
 local ok,err=pcall(fn)
 if not ok then error('FAIL '..name..': '..tostring(err)) end
 passed+=1; print('PASS',name)
end
local function near(a: number,b: number,epsilon: number?) assert(math.abs(a-b)<(epsilon or 1e-7),tostring(a)..' ~= '..b) end
local function play(seed: number?): any
 local s=Sim.new(seed or 123); s:join(101,'Human',0); s:step(0,R.step)
 s:resolve(5); s:resolve(6.6); assert(s.phase=='play')
 return s
end
local function action(s: any,seq: number,kind: string): any
 return {matchId=s.matchId,roundId=s.roundId,seq=seq,action=kind,aimX=1,aimZ=0}
end
local function neutral(s: any,seq: number): any
 return {matchId=s.matchId,roundId=s.roundId,seq=seq,moveX=0,moveZ=0,aimX=1,aimZ=0}
end
test('frozen numerical baseline and unit conversion',function()
 assert(table.isfrozen(R)); assert(R.width*R.scale==90 and R.depth*R.scale==57)
 near(R.run,6.2); near(R.acceleration,42); near(R.chargeMultiplier,0.85)
 near(R.windup+R.strike+R.follow+R.recover,0.4)
end)
test('held/flight/loose responsibility 100 fixtures each',function()
 for _,state in {'held','flight','loose'} do
  for i=1,100 do
   local s=play(i); s:serve(2); s.ball.state=state; s.ball.lastKickerActorId=3; s.ball.lastTouchActorId=4
   if state~='held' then s.ball.holderActorId=nil end
   s:resolve(s.deadline)
   assert(not s.actors[if state=='held' then 2 else 3].alive)
   local n=#s:living(); s:resolve(s.now); assert(#s:living()==n)
  end
 end
end)
test('deadline beats predeadline release whose strike is late',function()
 for _,offset in {-R.step,0,R.step} do
  local s=play(); s:serve(1); local deadline=s.deadline
  assert(s:command(1,'Press',{},deadline-1))
  s:command(1,'Release',{aimX=1,aimZ=0},deadline-R.windup+offset)
  s:step(deadline,R.step)
  assert(not s.actors[1].alive and s.phase=='elimination')
  for _,e in s.events do assert(e.type~='pass') end
 end
 local s=play(); s:serve(1); local d=s.deadline
 assert(s:command(1,'Press',{},d-1)); assert(s:command(1,'Release',{},d-R.windup-R.step))
 s:step(d-R.step,R.step); assert(s.ball.state=='flight'); s:resolve(d); assert(not s.actors[1].alive)
end)
test('catch before/at/after buzzer and dash cooldown boundaries',function()
 for _,delta in {-R.step,0,R.step} do
  local s=play(); s:serve(1)
  for _,a in s.actors do a.x=12; a.z=8 end
  s.actors[2].x=0; s.actors[2].z=0
  local b=s.ball; b.state='flight'; b.holderActorId=nil; b.lastKickerActorId=1
  b.x=0; b.z=0; b.y=R.ballRadius; b.vx=0; b.vz=0; b.vy=0
  s:step(s.deadline+delta,R.step)
  if delta<0 then
   assert(b.holderActorId==2); s:resolve(s.deadline); assert(not s.actors[2].alive)
  else assert(not s.actors[1].alive and s.actors[2].alive and b.holderActorId==nil) end
 end
 for _,delta in {-1e-6,0,1e-6} do
  local s=play(); s:serve(2); local t=s.now
  assert(s:command(1,'Dash',{},t))
  assert(s:command(1,'Dash',{},t+R.dashCooldown+delta)==(delta>=0))
 end
end)
test('catch lock and charge/strike boundaries',function()
 for _,delta in {-1e-6,0,1e-6} do
  local s=play(); s:serve(1); local start=s.now+R.catchLock+delta
  assert(s:command(1,'Press',{},start)==(delta>=0))
 end
 for _,held in {0,0.55,2} do
  local s=play(); s:serve(1); local start=s.now+0.5
  assert(s:command(1,'Press',{},start)); assert(s:command(1,'Release',{},start+held))
  local strike=s.actors[1].passAt
  s:step(strike-1e-6,0); assert(s.ball.state=='held')
  s:step(strike,0); assert(s.ball.state=='flight')
  near(math.sqrt(s.ball.vx^2+s.ball.vz^2),16*(1+0.6*math.min(held/0.55,1)))
  local count=0; for _,e in s.events do if e.type=='pass' then count+=1 end end; assert(count==1)
 end
end)
test('self and previous-holder immunity just before/at/after; regrab',function()
 local s=play(); s:serve(2); s.ball.previousHolderActorId=1
 local t=s.now+0.5; s:command(2,'Press',{},t); s:command(2,'Release',{},t); s:step(t+0.09,0)
 for _,delta in {-1e-6,0,1e-6} do
  assert(s:canCatch(s.actors[2],s.now+0.3+delta)==(delta>=0))
  assert(s:canCatch(s.actors[1],s.now+0.9+delta)==(delta>=0))
 end
 s.ball.x=s.actors[2].x; s.ball.z=s.actors[2].z; s.ball.y=0.32
 s.ball.vx=0; s.ball.vy=0; s.ball.vz=0; s.ball.state='loose'
 s:step(s.now+0.31,R.step); assert(s.ball.holderActorId==2)
end)
test('earliest swept catch, stable ties, max-charge speed and height',function()
 near(M.sweep(-2,0,4,0,0,0,0.75) :: number,0.3125)
 local s=play(); s:serve(1)
 for _,a in s.actors do a.x=12; a.z=8 end
 s.actors[2].x=0; s.actors[2].z=0; s.actors[3].x=0; s.actors[3].z=0
 local b=s.ball; b.state='flight'; b.holderActorId=nil; b.lastKickerActorId=1
 b.x=-1; b.z=0; b.y=0.4; b.vx=25.6; b.vz=0; b.vy=0
 s:step(s.now+R.step,R.step); assert(b.holderActorId==2)
 local t=play(); t:serve(1); t.ball.state='flight'; t.ball.holderActorId=nil; t.ball.lastKickerActorId=1
 t.ball.y=5; t.ball.x=t.actors[2].x; t.ball.z=t.actors[2].z
 t:step(t.now+R.step,R.step); assert(t.ball.holderActorId==nil)
end)
test('dash, diagonal speed, timeout and 1000 bounded commands',function()
 local s=play(); s:serve(2); local a=s.actors[1]; local t=s.now
 s:command(1,'Move',{moveX=1,moveZ=1,aimX=1,aimZ=0},t)
 near(math.sqrt(a.mx*a.mx+a.mz*a.mz),1)
 assert(s:command(1,'Dash',{},t)); assert(not s:command(1,'Dash',{},t+0.1))
 near(a.dashUntil,t+0.14); near(a.dashReady,t+1.6)
 assert(s:command(1,'Dash',{},t+1.6))
 move(a,1/60,t+2,false); assert(a.mx==0 and a.mz==0)
 for i=1,1000 do
  local x,z=M.unit(math.sin(i*7),math.cos(i*11))
  a.mx,a.mz=x,z; a.lastMove=t+i/60; move(a,1/60,a.lastMove,false)
  assert(math.abs(a.x)<=15-0.45 and math.abs(a.z)<=9.5-0.45)
 end
end)
test('roster freeze, late join, forfeit, duplicate reset and reconnect',function()
 for _,phase in {'countdown','intro','play','elimination','intermission','result'} do
  local s=play(); s.phase=phase; s.deadline=100
  s:join(202,'Late',s.now); assert(#s.actors==8 and s.actors[2].userId==nil)
 end
 local s=play(); s:serve(1); local d=s.deadline
 s:forfeit(1,s.now+1); assert(not s.actors[1].alive); assert(s.ball.holderActorId==2); assert(s.deadline==d)
 local n=#s.events; s:forfeit(1,s.now); assert(#s.events==n)
 s:join(101,'Rejoin',s.now); assert(not s.actors[1].alive)
 s:leave(101,s.now); assert(s.phase=='waiting' and #s.actors==0)
end)
test('kicker leave re-serves; expired leave resolves culprit first',function()
 local s=play(); s:join(202,'Other',s.now); s:serve(1)
 s.ball.state='flight'; s.ball.holderActorId=nil; s.ball.lastKickerActorId=1
 local d=s.deadline; s:forfeit(1,s.now+0.1); assert(s.ball.holderActorId==2 and s.deadline==d)
 local t=play(); t:serve(1); t:leave(101,t.deadline)
 local eliminations=0
 for _,e in t.events do if e.type=='elimination' then eliminations+=1; assert(e.actorId==1) end end
 assert(eliminations==1 and t.phase=='waiting')
end)
test('one survivor, zero survivor cancellation, no duplicate result',function()
 local s=play()
 for i=1,7 do s:forfeit(i,s.now) end
 assert(s.phase=='result' and s.winner==8)
 local n=#s.events; s:forfeit(7,s.now); s:resolve(s.now); assert(#s.events==n)
 local z=play(); for _,a in z.actors do a.alive=false end
 z:finishIfNeeded(); assert(z.phase=='result' and z.winner==nil)
end)
test('fault repair preserves deadline and culprit',function()
 for _,value in {0/0,math.huge,10000} do
  local s=play(); s:serve(2); s.ball.state='flight'; s.ball.holderActorId=nil; s.ball.lastKickerActorId=3
  local d=s.deadline; s.ball.x=value; s:step(s.now+0.01,R.step)
  assert(s.faults==1 and s:responsible()==3 and s.deadline==d and M.finite(s.ball.x))
 end
end)
test('100 hostile payloads per schema category cause no state mutation',function()
 local categories={
  function(s: any): any return 'invalid' end,
  function(s: any): any local p=neutral(s,1); p.moveX=0/0; return p end,
  function(s: any): any local p=neutral(s,1); p.moveZ=math.huge; return p end,
  function(s: any): any local p=neutral(s,1); p.extra={nested={}}; return p end,
  function(s: any): any local p=neutral(s,1); p.moveX=2; return p end,
  function(s: any): any local p=neutral(s,1); p.actorId=2; return p end,
  function(s: any): any local p=neutral(s,1); p.matchId=999; return p end,
  function(s: any): any local p=neutral(s,1); p.roundId=0; return p end,
  function(s: any): any local p=neutral(s,1); p.seq=-1; return p end,
 }
 for _,make in categories do for _=1,100 do
  local s=play(); local gateway=Gateway(s,P); local revision=s.revision
  assert(not gateway.receive({UserId=101},'Move',make(s),s.now)); assert(s.revision==revision)
 end end
 for i=1,100 do
  local s=play(); local gateway=Gateway(s,P)
  assert(not gateway.receive({UserId=999},'Action',action(s,i,'Forfeit'),s.now))
  assert(not gateway.receive({UserId=101},'Action',action(s,i,'Win'),s.now))
  local recursive=neutral(s,i); recursive.moveX=recursive
  assert(not gateway.receive({UserId=101},'Move',recursive,s.now))
 end
end)
test('100 impossible possession/cooldown and replay actions each',function()
 for i=1,100 do
  local s=play(); s:serve(2); local g=Gateway(s,P); local player={UserId=101}
  assert(not g.receive(player,'Action',action(s,1,'Press'),s.now))
  assert(g.receive(player,'Action',action(s,2,'Dash'),s.now))
  assert(not g.receive(player,'Action',action(s,3,'Dash'),s.now))
  assert(not g.receive(player,'Action',action(s,2,'Dash'),s.now))
  local holder=s.actors[2]; local lock=holder.lockUntil
  assert(not s:command(2,'Press',{},lock-1e-6))
 end
end)
test('per-channel replay gate, identity, impossible action and rate burst isolation',function()
 local s=play(); s:serve(2); local g=Gateway(s,P); local p={UserId=101}
 assert(g.receive(p,'Move',neutral(s,100),s.now))
 assert(not g.receive(p,'Move',neutral(s,100),s.now))
 assert(g.receive(p,'Action',action(s,1,'Dash'),s.now))
 assert(not g.receive(p,'Action',action(s,2,'Dash'),s.now))
 assert(not g.receive(p,'Action',action(s,3,'Press'),s.now))
 local b={}; local accepted=0
 for i=1,1000 do if P.bucket(b,i/100,20,5) then accepted+=1 end end
 assert(accepted<=205 and accepted>=200)
 local s2=play(); s2.actors[2].userId=202; s2.actors[2].bot=false
 local gateway=Gateway(s2,P)
 local accepted1,accepted2=0,0; local base=s2.now
 for i=1,1000 do
  local now=base+i*0.01
  if gateway.receive({UserId=101},'Move',neutral(s2,i),now) then accepted1+=1 end
  if i%5==0 and gateway.receive({UserId=202},'Move',neutral(s2,i),now) then accepted2+=1 end
 end
 print("RATE",accepted1,accepted2); assert(accepted1<=205 and accepted2==200)
end)
test('freeze, snapshot isolation, identical seeded replay and bounded stall resolution',function()
 local s=play(); local snap=s:snapshot(); snap.actors[1].x=999
 assert(s.actors[1].x~=999 and snap.ball.stateRevision==s.revision)
 local x=s.actors[1].x; s.phase='intro'; s.deadline=s.now+100
 s:step(s.now+1,R.step); assert(s.actors[1].x==x)
 assert(not s:command(1,'Dash',{},s.now))
 s.phase='play'; s:serve(1); s.deadline=s.now+0.1
 s:step(s.now+30,R.step); assert(s.phase=='elimination' and not s.actors[1].alive)
 local a,b=play(91),play(91)
 for i=1,3000 do
  local now=6.6+i*R.step
  bots(a,now); bots(b,now); a:step(now,R.step); b:step(now,R.step)
  assert(a.phase==b.phase and a:responsible()==b:responsible())
  for j,v in a.actors do near(v.x,b.actors[j].x); near(v.z,b.actors[j].z) end
  table.clear(a.events); table.clear(b.events)
 end
end)
test('8 seeds x 1+7 and 2+6: 20 matches each (320 offline matches)',function()
 local results=0; local totalPasses=0
 for humans=1,2 do for seed=1,8 do
  local s=Sim.new(seed*991); s:join(101,'A',0); if humans==2 then s:join(202,'B',0) end
  local wins=0; local lastMatch=0; local now=0
  while wins<20 and now<6000 do
   now+=R.step
   bots(s,now); s:step(now,R.step)
   for _,e in s.events do
    if e.type=='pass' then totalPasses+=1 end
    if e.type=='victory' then
     assert(e.matchId~=lastMatch); lastMatch=e.matchId; wins+=1; results+=1
     assert(#s:living()==1)
    end
   end
   table.clear(s.events)
   if s.phase=='play' then
    local a=s:actor(s:responsible()); assert(a and a.alive)
    assert(M.finite(s.ball.x) and math.abs(s.ball.x)<=R.width/2)
   end
  end
  assert(wins==20,'deadlock seed '..seed); assert(s.faults==0)
 end end
 assert(results==320 and totalPasses>0); print('MATCHES',results,'PASSES',totalPasses)
end)
print('ALL PASS',passed,'pure test groups; no client/device runtime QA')

end
