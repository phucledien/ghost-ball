--!strict
-- GBQA regression assertions. Engine behavior is covered separately by handler stand-ins.
return function(R: any,M: any,move: any,Sim: any,P: any,Gateway: any,Clock: any,Prediction: any,Fit: any)
 local passed,failed=0,0
 local function test(name: string,fn: () -> ())
  local ok,err=pcall(fn)
  if ok then passed+=1; print('PASS',name) else failed+=1; print('FAIL '..name..': '..tostring(err)) end
 end
 local function near(a: number,b: number) assert(math.abs(a-b)<1e-7,tostring(a)..' ~= '..b) end
 local function play(): any
  local s=Sim.new(123); s:join(101,'A',0); s:join(202,'B',0); s:step(0,R.step); s:resolve(5); s:resolve(6.6)
  for _,a in s.actors do a.x=12; a.z=8 end
  s.actors[1].x,s.actors[1].z,s.actors[1].ax,s.actors[1].az=0,0,1,0
  s:serve(1); return s
 end
 local function flight(s: any,x: number,z: number,vx: number,vz: number)
  local b=s.ball; b.state='flight'; b.holderActorId=nil; b.lastKickerActorId=1
  b.x,b.z,b.y,b.vx,b.vz,b.vy=x,z,R.ballRadius,vx,vz,0; b.immune[1]=math.huge
 end
 local function event(s: any,kind: string): any
  for _,e in s.events do if e.type==kind then return e end end
  error('Missing '..kind)
 end
 test('GBQA-01 strike at endpoint and midpoint integrates only post-strike duration',function()
  for _,fraction in {0,0.5,1} do
   local s=play(); local t=s.now+0.5
   assert(s:command(1,'Press',{},t)); assert(s:command(1,'Release',{},t))
   local strike=s.actors[1].passAt; local finish=strike+(1-fraction)*R.step
   s:step(finish,R.step)
   near(s.ball.x,R.actorRadius+R.ballRadius+R.passSpeed*(finish-strike))
   near(event(s,'pass').serverTime,strike); near(s.ball.immune[1],strike+R.ownImmunity)
  end
 end)
 test('GBQA-01/02 exact-strike birth overlap catches immediately with immunity/height gates',function()
  for _,offset in {0.5,-1e-4} do
   for _,immune in {false,true} do
    local s=play(); s.actors[2].x,s.actors[2].z=1,0; local d=s.deadline
    local strike=if offset<0 then d+offset else s.now+offset+R.windup
    local press=if offset<0 then d-0.6 else s.now+offset
    s:command(1,'Press',{},press); s:command(1,'Release',{},strike-R.windup)
    if immune then s.ball.previousHolderActorId=2 end
    s:step(s.actors[1].passAt,R.step)
    if immune then
     assert(s.ball.state=='flight' and s.ball.holderActorId==nil)
     near(s.ball.x,R.actorRadius+R.ballRadius)
     if offset<0 then s:resolve(d); assert(not s.actors[1].alive and s.actors[2].alive) end
    else
     assert(s.ball.holderActorId==2); near(event(s,'catch').serverTime,strike)
     if offset<0 then s:resolve(d); assert(s.actors[1].alive and not s.actors[2].alive) end
    end
   end
  end
  for _,height in {R.catchHeight-1e-6,R.catchHeight,R.catchHeight+1e-6} do
   local s=play(); s.actors[2].x,s.actors[2].z=0,0; flight(s,0,0,0,0)
   s.ball.y=height; s:step(s.now,0)
   assert((s.ball.holderActorId==2)==(height<=R.catchHeight))
  end
  for _,expiry in {-1e-6,0,1e-6} do
   local s=play(); s.actors[2].x,s.actors[2].z=0,0; flight(s,0,0,0,0)
   s.ball.immune[2]=s.now+expiry; s:step(s.now,0)
   assert((s.ball.holderActorId==2)==(expiry<=0))
  end
 end)
 test('GBQA-01 moving holder launches from strike position, not interval endpoint',function()
  local s=play(); local t=s.now+0.5
  s:command(1,'Press',{},t); s:command(1,'Release',{},t)
  local a=s.actors[1]; a.mx=1; a.lastMove=t; local strike=a.passAt
  local expected=table.clone(a); move(expected,R.step/2,strike,true)
  s:step(strike+R.step/2,R.step)
  near(s.ball.x,expected.x+R.actorRadius+R.ballRadius+R.passSpeed*R.step/2)
 end)
 test('GBQA-01 exact wrong-loser reproduction: 0.1ms flight before buzzer',function()
  local s=play(); s.actors[2].x=1.75; s.actors[2].z=0; local d=s.deadline
  s:command(1,'Press',{},d-0.6); s:command(1,'Release',{},d-R.windup-0.0001)
  s:step(s.actors[1].passAt,R.step)
  near(s.ball.x,R.actorRadius+R.ballRadius); assert(s.ball.holderActorId==nil)
  s:resolve(d); assert(not s.actors[1].alive and s.actors[2].alive)
 end)
 test('GBQA-01 clock catch-up has distinct endpoints, partial step and no duplicate integration',function()
  local s=play(); local t=s.now+0.5
  s:command(1,'Press',{},t); s:command(1,'Release',{},t)
  local strike=s.actors[1].passAt; local begin=strike-R.step*1.5
  local clock=Clock(s,R,begin)
  assert(not clock(strike+R.step*2.25))
  near(event(s,'pass').serverTime,strike)
  near(s.ball.x,R.actorRadius+R.ballRadius+R.passSpeed*R.step*2.25)
  local x=s.ball.x; clock(strike+R.step*2.25); near(s.ball.x,x)
  near(s:snapshot().serverTime,strike+R.step*2.25)
 end)
 test('GBQA-01 catch before/at/after buzzer, stalls and overdue strikes keep deadline first',function()
  for _,offset in {-1e-5,0,1e-5} do
   local s=play(); s.actors[2].x,s.actors[2].z=0,0
   local d=s.deadline; local begin=d-4*R.step; local contact=d+offset
   flight(s,-R.pickup-R.passSpeed*(contact-begin),0,R.passSpeed,0)
   local clock=Clock(s,R,begin)
   clock(contact+0.5e-5)
   if offset<0 then
    assert(s.ball.holderActorId==2); near(event(s,'catch').serverTime,contact)
    s:resolve(d); assert(not s.actors[2].alive)
   else assert(not s.actors[1].alive and s.actors[2].alive and s.ball.holderActorId==nil) end
  end
  local s=play(); local d=s.deadline
  s:command(1,'Press',{},d-0.2); s:command(1,'Release',{},d-0.01)
  local clock=Clock(s,R,d-0.01); assert(clock(d+1))
  assert(not s.actors[1].alive and s.ball.state=='held')
  for _,e in s.events do assert(e.type~='pass') end
  local t=play(); local begin=t.now
  t:command(1,'Press',{},begin+0.5); t:command(1,'Release',{},begin+0.5)
  local drive=Clock(t,R,begin+0.5); assert(drive(begin+1))
  -- Dropped time cannot become retroactive ball flight or immunity.
  near(event(t,'pass').serverTime,begin+1-8*R.step)
 end)
 test('GBQA-02 glancing chord ends before own/return immunity expiry',function()
  for _,duration in {R.ownImmunity,R.returnImmunity} do
   local s=play(); local a=s.actors[2]; a.x,a.z=0,0.7499999
   flight(s,-0.001,0,25.6,0); local start=s.now
   s.ball.immune[2]=start+0.002
   -- Same expiry semantics for kicker and previous-holder immunity.
   s.ball.lastKickerActorId=if duration==R.ownImmunity then 2 else 1
   s.ball.previousHolderActorId=if duration==R.returnImmunity then 2 else nil
   s:step(start+1/240,1/240); assert(s.ball.holderActorId==nil)
  end
 end)
 test('GBQA-02 crossing, initial overlap and moving actor retain genuine expiry catches',function()
  for _,initial in {false,true} do
   for _,moving in {false,true} do
    for _,expiry in {0.001,0.002,0.003} do
     local s=play(); local a=s.actors[2]; a.x,a.z=0,0
     a.vx,a.mx,a.lastMove=if moving then 6 else 0,if moving then 1 else 0,s.now
     flight(s,if initial then 0 else -0.751,0,25.6,0)
     local start=s.now; s.ball.immune[2]=start+expiry
     s:step(start+1/240,1/240)
     assert(s.ball.holderActorId==2); near(event(s,'catch').serverTime,start+expiry)
     near(a.lockUntil,start+expiry+R.catchLock)
    end
   end
  end
 end)
 test('GBQA-02 eligibility at exit boundaries and moving glancing contact',function()
  -- Sweep helper must expose exit even when initially overlapping.
  local enter,leave=M.sweepInterval(0,0,2,0,0,0,0.75); near(enter,0); near(leave,0.375)
  for _,offset in {-1e-6,0,1e-6} do
   local s=play(); local a=s.actors[2]; a.x,a.z=0,0
   flight(s,0,0,25.6,0); local h=1/240; local start=s.now
   -- Small radius makes an entry AND exit occur in one substep.
   local exit=0.05/25.6
   -- Direct temporal interval assertion covers equality without floating world-clock subtraction.
   local t=M.catchTime(0,exit/h,R.ballRadius,0,R.gravity,R.catchHeight,h,exit+offset)
   assert((t~=nil)==(offset<=0))
   s.ball.immune[2]=start+0.001
   a.z=0.7499999; a.vx=25.6; a.mx=0; a.lastMove=start
   -- Moving away faster than the tiny chord: no retrospective catch at end.
   s:step(start+h,h); assert(s.ball.holderActorId==nil)
  end
 end)
 test('GBQA-02 descending height eligibility inside overlap, ascending eligibility ends',function()
  local s=play(); s.actors[2].x,s.actors[2].z=0,0; flight(s,0,0,0,0)
  local start=s.now; s.ball.y=R.catchHeight+0.001; s.ball.vy=-1
  s:step(start+1/240,1/240); assert(s.ball.holderActorId==2)
  local hit=event(s,'catch').serverTime-start
  near(R.catchHeight+0.001-hit-0.5*R.gravity*hit*hit,R.catchHeight)
  -- Immunity expires after rising above catch height: reject despite initial overlap.
  local t=play(); t.actors[2].x,t.actors[2].z=0,0; flight(t,0,0,0,0)
  t.ball.y=R.catchHeight-0.001; t.ball.vy=1; t.ball.immune[2]=t.now+0.003
  t:step(t.now+1/240,1/240); assert(t.ball.holderActorId==nil)
 end)
 local function actor(): any
  return {x=0,z=0,vx=0,vz=0,mx=0,mz=0,lastMove=0,moveSeq=0,dashUntil=0,dx=1,dz=0}
 end
 test('GBQA-07 same-time snapshot prunes covered motion regardless of seq label',function()
  for _,seq in {1,2} do
   local a=actor(); local p=Prediction(move); local t=R.step
   p.step(a,{mx=1,mz=0,sentAt=0},seq,t,t,false)
   a.mx=1; a.moveSeq=1; move(a,t,t,false)
   p.reconcile(a,false,t)
   local got=p.step(a,{mx=1,mz=0,sentAt=0},seq,0,t,false)
   near(got.x,a.x); near(got.vx,a.vx)
  end
 end)
 test('GBQA-07 newly sent changes apply only at/after their real send time',function()
  local a=actor(); local p=Prediction(move)
  p.reconcile(a,false,0)
  local got=p.step(a,{mx=1,mz=0,sentAt=R.step},1,R.step,R.step,false)
  near(got.x,0); near(got.vx,0)
  got=p.step(a,{mx=1,mz=0,sentAt=R.step},1,R.step,2*R.step,false)
  local expected=actor(); expected.mx=1; expected.lastMove=R.step; move(expected,R.step,2*R.step,false)
  near(got.x,expected.x)
  -- Stop halfway through the next frame: moving prefix, neutral suffix.
  move(expected,R.step/2,2.5*R.step,false); expected.mx=0; expected.lastMove=2.5*R.step
  move(expected,R.step/2,3*R.step,false)
  got=p.step(a,{mx=0,mz=0,sentAt=2.5*R.step},2,R.step,3*R.step,false)
  near(got.x,expected.x); near(got.vx,expected.vx)
 end)
 test('GBQA-07 partial/delayed acknowledgments retain only genuinely later intervals',function()
  local a=actor(); local p=Prediction(move)
  for i=1,4 do p.step(a,{mx=1,mz=0,sentAt=0},1,R.step,i*R.step,false) end
  a.mx=1; a.moveSeq=1; move(a,R.step,R.step,false)
  local expected=table.clone(a)
  for i=2,4 do move(expected,R.step,i*R.step,false) end
  p.reconcile(a,false,R.step)
  local got=p.step(a,{mx=1,mz=0,sentAt=0},1,0,4*R.step,false)
  near(got.x,expected.x); near(got.vx,expected.vx)
  -- Snapshot cuts through a stored frame; replay only its uncovered suffix.
  local b=actor(); local q=Prediction(move)
  q.step(b,{mx=1,mz=0,sentAt=0},1,0.04,0.04,false)
  b.mx=1; b.moveSeq=1; move(b,0.02,0.02,false)
  local want=table.clone(b); move(want,0.02,0.04,false)
  q.reconcile(b,false,0.02); near(q.step(b,{},1,0,0.04,false).x,want.x)
 end)
 test('GBQA-07 stopping/direction changes, unacked prefix and out-of-order snapshots',function()
  local a=actor(); local p=Prediction(move)
  for i,mx in {1,1,0,-1,-1} do
   p.step(a,{mx=mx,mz=0,sentAt=(i-1)*R.step},i,R.step,i*R.step,false)
  end
  a.mx=1; a.moveSeq=1; move(a,R.step,R.step,false)
  local expected=table.clone(a)
  for i,mx in {1,1,0,-1,-1} do
   if i>1 then expected.mx=mx; expected.lastMove=(i-1)*R.step; move(expected,R.step,i*R.step,false) end
  end
  p.reconcile(a,false,R.step)
  local got=p.step(a,{},5,0,5*R.step,false); near(got.x,expected.x); near(got.vx,expected.vx)
  -- Newer time supersedes locally integrated motion even with a partial ack.
  local snapshot=table.clone(expected); snapshot.moveSeq=3
  p.reconcile(snapshot,false,5*R.step); near(p.step(a,{},5,0,5*R.step,false).x,expected.x)
  local stale=actor(); stale.x=100; stale.moveSeq=2
  p.reconcile(stale,false,4*R.step); near(p.step(a,{},5,0,5*R.step,false).x,expected.x)
 end)
 test('GBQA-07 acknowledged continued input keeps original timeout and source actor immutable',function()
  local a=actor(); local p=Prediction(move); local copy=table.clone(a)
  for i=1,20 do p.step(a,{mx=1,mz=0,sentAt=0},1,R.step,i*R.step,false) end
  for k,v in copy do assert(a[k]==v) end
  a.mx=1; a.moveSeq=1; move(a,R.step,R.step,false)
  p.reconcile(a,false,R.step)
  local got=p.step(a,{},1,0,20*R.step,false)
  assert(got.mx==0 and got.lastMove==0) -- Prediction must not refresh stale input each frame.
 end)
 test('GBQA-06 perspective bounds with HUD/safe margins at all supported sizes',function()
  for _,size in {{844,390},{1280,720},{1920,1080}} do
   for _,safe in {{left=0,right=0,top=0,bottom=0},{left=44,right=44,top=36,bottom=21}} do
    local w,h=size[1],size[2]; local f=Fit.fit(w,h,safe,R)
    local minX,maxX,minY,maxY=math.huge,-math.huge,math.huge,-math.huge
    -- Independently project the 8 enclosing corners, all actor feet, and the exact QA ball.
    local points=Fit.bounds(R)
    table.insert(points,{x=44.04,y=0.96,z=27.54}); table.insert(points,{x=43.65,y=0,z=27.15})
    for _,point in points do
     local x,y,z=point.x-f.targetX,point.y-f.targetY,point.z-f.targetZ
     local cp,sp,cy,sy=math.cos(Fit.pitch),math.sin(Fit.pitch),math.cos(Fit.yaw),math.sin(Fit.yaw)
     local depth=f.distance-(cp*sy*x+sp*y+cp*cy*z)
     local nx=(cy*x-sy*z)/(depth*math.tan(math.rad(Fit.fov/2))*w/h)
     local ny=(-sp*sy*x+cp*y-sp*cy*z)/(depth*math.tan(math.rad(Fit.fov/2)))
     local px,py=(nx+1)*w/2,(1-ny)*h/2
     assert(depth>0 and px>=f.left-1e-7 and px<=f.right+1e-7 and py>=f.top-1e-7 and py<=f.bottom+1e-7)
     minX,maxX,minY,maxY=math.min(minX,px),math.max(maxX,px),math.min(minY,py),math.max(maxY,py)
    end
    print('FRAME analytic',w,h,'safe',safe.top,safe.bottom,'distance',f.distance,'pixels',minX,maxX,minY,maxY)
   end
  end
 end)
 test('clock/gateway rejected traffic never flushes; valid peer and deadline progress',function()
  local s=play(); local flushes=0; local drive=Clock(s,R,s.now)
  local g=Gateway(s,P,function(now: number) flushes+=1; drive(now) end)
  local function payload(seq: number): any
   return {matchId=s.matchId,roundId=s.roundId,seq=seq,moveX=1,moveZ=0,aimX=1,aimZ=0}
  end
  local t=s.now+0.01
  for i=1,1000 do assert(not g.receive({UserId=999},'Move',{nested={}},t)) end
  near(flushes,0)
  assert(g.receive({UserId=202},'Move',payload(1),t)); near(flushes,1)
  for i=2,6 do g.receive({UserId=101},'Move',payload(i),t) end
  local count=flushes
  for i=7,1000 do assert(not g.receive({UserId=101},'Move',payload(i),t)) end
  near(flushes,count)
  assert(g.receive({UserId=202},'Move',payload(2),t+0.05)); near(flushes,count+1)
  assert(s.actors[2].x>12)
  local before=flushes
  assert(not g.receive({UserId=202},'Move',payload(2),t+0.1)); near(flushes,before)
  local stale=payload(3); stale.roundId-=1
  assert(not g.receive({UserId=202},'Move',stale,t+0.15)); near(flushes,before)
  local d=s.deadline
  g.receive({UserId=202},'Move',payload(4),d)
  assert(not s.actors[1].alive and s.actors[2].alive)
 end)
 local function packet(s: any,seq: number,kind: string): any
  if kind=='Move' then return {matchId=s.matchId,roundId=s.roundId,seq=seq,moveX=1,moveZ=0,aimX=1,aimZ=0} end
  return {matchId=s.matchId,roundId=s.roundId,seq=seq,action=kind,aimX=1,aimZ=0}
 end
 test('GBQA-08 result transition revalidates epoch for every command and reordered/unchanged roster',function()
  local cases=0
  for _,delta in {-1e-6,0,1e-6} do for _,roster in {'unchanged','join50','leave101','join50leave101','join303'} do
   for _,kind in {'Move','Press','Release','Dash','Cancel','Forfeit'} do
    local s=play()
    for _,id in {1,3,4,5,6,7,8} do s:forfeit(id,s.now) end
    assert(s.phase=='result' and s.winner==2)
    if roster=='join50' or roster=='join50leave101' then s:join(50,'Late',s.now) end
    if roster=='join303' then s:join(303,'Late',s.now) end
    if roster=='leave101' or roster=='join50leave101' then s:leave(101,s.now) end
    local epoch=s.matchId; local deadline=s.deadline; local flushes=0; local drive=Clock(s,R,s.now)
    local g=Gateway(s,P,function(now: number) flushes+=1; drive(now) end)
    local payload=packet(s,1,kind); local channel=if kind=='Move' then 'Move' else 'Action'
    local accepted=g.receive({UserId=202},channel,payload,deadline+delta)
    assert(flushes==1) -- initially valid requests may become stale during a legitimate flush
    local counts=g.diagnostics()
    if delta<0 then
     assert(s.matchId==epoch and accepted==(kind=='Forfeit'))
     assert((counts.illegal or 0)==(if kind=='Forfeit' then 0 else 1) and counts.epoch==nil)
     assert(s.actors[2].alive) -- Forfeit is an accepted no-op during result
    else
     assert(s.matchId==epoch+1 and not accepted and counts.epoch==1)
     for _,actor in s.actors do
      assert(actor.alive and actor.mx==0 and actor.mz==0 and actor.moveSeq==0 and actor.actionSeq==0)
     end
     -- Same old epoch is now rejected at the cheap gate without another flush.
     payload.seq=2; assert(not g.receive({UserId=202},channel,payload,deadline+delta))
     assert(flushes==1 and g.diagnostics().epoch==1)
     -- A fresh new-epoch peer may forfeit only itself; identity comes from this roster.
     local peer=s.actors[1].userId; local fresh=packet(s,3,'Forfeit')
     assert(g.receive({UserId=peer},'Action',fresh,deadline+delta+0.001))
     for _,actor in s.actors do assert(actor.alive==(actor.userId~=peer)) end
     assert(flushes==2 and next(g.diagnostics())==nil)
    end
    assert(next(g.diagnostics())==nil) -- rejection reporting drains exactly once
    cases+=1
   end
  end end
  print('GATEWAY result boundary cases',cases)
 end)
 test('GBQA-08 live sender is resolved afresh after replacement or leave even within same epoch',function()
  for _,depart in {false,true} do
   local s=play(); local old=s.actors[2]; local g=Gateway(s,P,function(now: number)
    if depart then s:leave(202,now) else
     local moved=table.clone(old); moved.id=3
     local vacated=table.clone(s.actors[3]); vacated.id=2
     s.actors[2]=vacated; s.actors[3]=moved
    end
   end)
   local payload=packet(s,1,'Move'); local ok=g.receive({UserId=202},'Move',payload,s.now+0.01)
   if depart then assert(not ok and g.diagnostics().spectator==1)
   else
    assert(ok and s.actors[3].userId==202 and s.actors[3].mx==1 and s.actors[3].moveSeq==1)
    assert(s.actors[2].mx==0 and old.mx==0 and old.moveSeq==0)
   end
  end
 end)
 test('GBQA-08 pre-gate invalid traffic never flushes; post-flush stale traffic counts rejection',function()
  local s=play(); local flushes=0
  local g=Gateway(s,P,function(now: number) flushes+=1; s:resolve(now) end)
  local t=s.now+0.01; local payload=packet(s,1,'Move')
  assert(not g.receive({UserId=202},'Unknown',{},t)); assert(flushes==0 and g.diagnostics().schema==1)
  local stale=table.clone(payload); stale.matchId-=1
  assert(not g.receive({UserId=202},'Move',stale,t)); assert(flushes==0 and g.diagnostics().epoch==1)
  assert(g.receive({UserId=202},'Move',payload,t)); assert(flushes==1)
  assert(not g.receive({UserId=202},'Move',payload,t)); assert(flushes==1 and g.diagnostics().replay==1)
  assert(not g.receive({UserId=999},'Move',payload,t)); assert(flushes==1 and g.diagnostics().spectator==1)
  for seq=2,3 do local p=packet(s,seq,'Move'); assert(g.receive({UserId=202},'Move',p,t)) end
  local before=flushes
  local accepted=0
  for seq=4,103 do if g.receive({UserId=202},'Move',packet(s,seq,'Move'),t) then accepted+=1 end end
  assert(accepted==0 and flushes==before and g.diagnostics().rate==100)
  -- Rejection traffic did not consume a legitimate peer's independent bucket.
  assert(g.receive({UserId=101},'Move',packet(s,1,'Move'),t)); assert(flushes==before+1)
 end)
 print('GBQA SUMMARY',passed,'pass',failed,'fail; offline only')
 assert(failed==0,'GBQA regression failures: '..failed)
end
