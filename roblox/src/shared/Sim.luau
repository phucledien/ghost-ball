--!strict
-- Pure server simulation. No Instances, physics, remotes or wall-clock reads.
return function(R: any, M: any, move: any)
 local S: any = {}; S.__index=S
 function S.new(seed: number)
  return setmetatable({seed=seed,phase='waiting',deadline=0,now=0,matchId=0,roundId=0,
   revision=0,eventId=0,events={},actors={},connected={},ball={},winner=nil,faults=0},S)
 end
 function S.random(self: any): number
  self.seed=(self.seed*48271)%2147483647; return self.seed/2147483647
 end
 function S.emit(self: any, kind: string, id: number?)
  self.eventId+=1; self.revision+=1
  table.insert(self.events,{type=kind,actorId=id,eventId=self.eventId,matchId=self.matchId,
   roundId=self.roundId,revision=self.revision,serverTime=self.now,ballId=1})
 end
 function S.living(self: any): {any}
  local list={}; for _,a in self.actors do if a.alive then table.insert(list,a) end end
  return list
 end
 function S.actor(self: any, id: number?): any
  if id==nil then return nil end
  return self.actors[id]
 end
 function S.responsible(self: any): number?
  return if self.ball.state=='held' then self.ball.holderActorId else self.ball.lastKickerActorId
 end
 function S.phaseTo(self: any, phase: string,duration: number)
  self.phase=phase; self.deadline=self.now+duration
  for _,a in self.actors do
   a.mx,a.mz,a.vx,a.vz=0,0,0,0; a.chargeAt=nil; a.passAt=nil
  end
  self:emit('phase')
 end
 function S.serve(self: any, id: number)
  local a=self.actors[id]
  self.ball={ballId=1,state='held',holderActorId=id,previousHolderActorId=nil,
   lastKickerActorId=nil,lastTouchActorId=id,x=a.x,y=R.ballRadius,z=a.z,
   vx=0,vy=0,vz=0,immune={}}
  a.lockUntil=self.now+R.catchLock
  self:emit('serve',id)
 end
 function S.start(self: any)
  self.matchId+=1; self.roundId=0; self.winner=nil; self.actors={}
  local users: {any}={}; for id,name in self.connected do table.insert(users,{id=id,name=name}) end
  table.sort(users,function(a: any,b: any) return a.id<b.id end)
  for id=1,R.slots do
   local u=users[id]
   self.actors[id]={id=id,userId=if u then u.id else nil,name=if u then u.name else 'Nova Bot '..id,
    bot=u==nil,alive=true,x=0,z=0,vx=0,vz=0,mx=0,mz=0,ax=1,az=0,
    lastMove=self.now,lockUntil=0,dashUntil=0,dashReady=0,dx=1,dz=0,recoverUntil=0,
    moveSeq=0,actionSeq=0,nextThink=0}
  end
  self:phaseTo('countdown',R.countdown)
 end
 function S.newRound(self: any)
  self.roundId+=1
  local list=self:living()
  for i,a in list do
   local angle=2*math.pi*(i-1)/#list
   a.x,a.z=math.cos(angle)*R.width*0.3,math.sin(angle)*R.depth*0.3
   a.vx,a.vz,a.mx,a.mz=0,0,0,0; a.dashReady=0; a.dashUntil=0
   a.chargeAt=nil; a.passAt=nil; a.recoverUntil=0; a.lockUntil=0
   a.ax,a.az=M.unit(-a.x,-a.z)
  end
  self:serve(list[math.floor(self:random()*#list)+1].id)
  self:phaseTo('intro',if self.roundId==1 then R.firstIntro else R.intro)
 end
 function S.finishIfNeeded(self: any): boolean
  local list=self:living()
  if #list<=1 then
   self.winner=if #list==1 then list[1].id else nil
   self:phaseTo('result',R.result)
   if self.winner then self:emit('victory',self.winner) end
   return true
  end
  return false
 end
 function S.resolve(self: any, now: number)
  self.now=now
  if self.phase=='waiting' then return end
  if now < self.deadline then return end
  if self.phase=='countdown' or self.phase=='intermission' then self:newRound()
  elseif self.phase=='intro' then self:phaseTo('play',R.round)
  elseif self.phase=='play' then
   local id=self:responsible(); local a=self:actor(id)
   if not a or not a.alive then
    self.faults+=1; a=self:living()[1]; id=if a then a.id else nil
   end
   if a then a.alive=false; self:emit('elimination',id) end
   self:phaseTo('elimination',R.elimination)
  elseif self.phase=='elimination' then
   if not self:finishIfNeeded() then self:phaseTo('intermission',R.intermission) end
  elseif self.phase=='result' then
   self:phaseTo('waiting',0)
  end
 end
 function S.join(self: any, userId: number,name: string,now: number)
  self:resolve(now); self.connected[userId]=string.sub(name,1,32)
  -- Roster is frozen until a fresh match, including reconnects.
 end
 function S.forfeit(self: any, id: number,now: number)
  self:resolve(now)
  local a=self:actor(id)
  if not a or not a.alive or self.phase=='result' or self.phase=='waiting' then return end
  local responsible=self:responsible()==id
  a.alive=false; a.mx,a.mz=0,0; a.chargeAt=nil; a.passAt=nil
  self:emit('forfeit',id)
  if self:finishIfNeeded() then return end
  if responsible then
   local list=self:living(); local chosen=list[1]
   for _,v in list do if v.id>id then chosen=v; break end end
   self:serve(chosen.id)
  end
 end
 function S.leave(self: any, userId: number,now: number)
  self:resolve(now)
  self.connected[userId]=nil
  for _,a in self.actors do if a.userId==userId then self:forfeit(a.id,now) end end
  if next(self.connected)==nil then
   self.actors={}; self.ball={}; self.winner=nil; self:phaseTo('waiting',0)
  end
 end
 function S.command(self: any, id: number,kind: string,p: any,now: number): boolean
  self:resolve(now)
  local a=self:actor(id)
  if not a or not a.alive then return false end
  if kind=='Forfeit' then self:forfeit(id,now); return true end
  if self.phase~='play' then return false end
  if kind=='Move' then
   a.mx,a.mz=M.clampAxis(p.moveX,p.moveZ); a.lastMove=now
   if p.aimX*p.aimX+p.aimZ*p.aimZ>1e-6 then a.ax,a.az=M.unit(p.aimX,p.aimZ) end
   return true
  end
  if kind=='Cancel' then a.chargeAt=nil; a.mx,a.mz=0,0; a.passAt=nil; return true end
  local holding=self.ball.holderActorId==id and self.ball.state=='held'
  if kind=='Press' then
   if not holding or now<a.lockUntil or now<a.recoverUntil or a.passAt or a.chargeAt then return false end
   a.chargeAt=now; return true
  elseif kind=='Release' then
   if not holding or not a.chargeAt or now<a.lockUntil or a.passAt then return false end
   if p.aimX and p.aimX*p.aimX+p.aimZ*p.aimZ>1e-6 then a.ax,a.az=M.unit(p.aimX,p.aimZ) end
   a.passPower=math.clamp((now-a.chargeAt)/R.fullCharge,0,1)
   a.chargeAt=nil; a.passAt=now+R.windup; a.recoverUntil=now+R.windup+R.strike+R.follow+R.recover
   return true
  elseif kind=='Dash' then
   if holding or now<a.dashReady or now<a.recoverUntil then return false end
   a.dx,a.dz=M.unit(a.mx,a.mz)
   if a.dx==0 and a.dz==0 then a.dx,a.dz=a.ax,a.az end
   a.dashUntil=now+R.dashDuration; a.dashReady=now+R.dashCooldown
   self:emit('dash',id); return true
  end
  return false
 end
 function S.canCatch(self: any, a: any,now: number): boolean
  return a.alive and now >= (self.ball.immune[a.id] or 0)
 end
 function S.launch(self: any, a: any)
  a.passAt=nil
  local b=self.ball
  if b.state~='held' or b.holderActorId~=a.id then return end
  local ax,az=a.ax,a.az
  local best: any=nil; local bestAngle=-1
  for _,target in self:living() do
   if target.id~=a.id and target.id~=b.previousHolderActorId then
    local dx,dz=target.x-a.x,target.z-a.z
    local dist=math.sqrt(dx*dx+dz*dz)
    local ux,uz=M.unit(dx,dz); local dot=ux*ax+uz*az
    if dist<=R.aimRange and dot>=math.cos(R.aimCone) and dot>bestAngle then best=target; bestAngle=dot end
   end
  end
  local speed=R.passSpeed*(1+(R.chargeBoost-1)*a.passPower)
  if best then
   local t=math.sqrt((best.x-a.x)^2+(best.z-a.z)^2)/speed*R.lead
   ax,az=M.unit(best.x+best.vx*t-a.x,best.z+best.vz*t-a.z)
  end
  local previous=b.previousHolderActorId
  b.state='flight'; b.holderActorId=nil; b.lastKickerActorId=a.id; b.lastTouchActorId=a.id
  b.x,b.z=a.x+ax*(R.actorRadius+R.ballRadius),a.z+az*(R.actorRadius+R.ballRadius)
  b.y=R.ballRadius; b.vx,b.vz=ax*speed,az*speed; b.vy=math.sqrt(2*R.gravity*R.apex)
  b.immune={[a.id]=self.now+R.ownImmunity}
  if previous and previous~=a.id then b.immune[previous]=self.now+R.returnImmunity end
  self:emit('pass',a.id)
 end
 function S.repair(self: any)
  local b=self.ball
  local valid=M.finite(b.x) and M.finite(b.y) and M.finite(b.z) and M.finite(b.vx) and M.finite(b.vy) and M.finite(b.vz)
  if valid and math.abs(b.x)<=R.width/2+1 and math.abs(b.z)<=R.depth/2+1 then return end
  self.faults+=1
  local a=self:actor(self:responsible()) or self:living()[1]
  if not a then return end
  b.state='held'; b.holderActorId=a.id; b.x,b.z=a.x,a.z; b.y=R.ballRadius
  b.vx,b.vy,b.vz=0,0,0; self:emit('fault',a.id)
 end
 function S.ballStep(self: any, dt: number)
  local b=self.ball
  self:repair()
  if b.state=='held' then
   local a=self:actor(b.holderActorId); b.x,b.z=a.x,a.z; b.y=R.ballRadius; return
  end
  -- Small bounded substeps allow height and wall changes without tunneling.
  local n=math.ceil(dt/(1/240)); local h=dt/n
  for sub=1,n do
   local x,z,y=b.x,b.z,b.y; local dx,dz=b.vx*h,b.vz*h
   local ny=math.max(R.ballRadius,y+b.vy*h-0.5*R.gravity*h*h)
   local bestT=math.huge; local best: any=nil
   for _,a in self:living() do
    local ox,oz=a.oldX or a.x,a.oldZ or a.z
    local adx,adz=(a.x-ox)/n,(a.z-oz)/n
    local cx,cz=ox+adx*(sub-1),oz+adz*(sub-1)
    local t=M.sweep(x,z,dx-adx,dz-adz,cx,cz,R.pickup)
    if t and y+(ny-y)*t<=R.catchHeight and self:canCatch(a,self.now-dt+sub*h) and t<bestT then best=a; bestT=t end
   end
   if best then
    b.state='held'; b.holderActorId=best.id; b.lastTouchActorId=best.id
    b.previousHolderActorId=b.lastKickerActorId
    b.x,b.z,b.y=best.x,best.z,R.ballRadius; b.vx,b.vy,b.vz=0,0,0
    best.lockUntil=self.now+R.catchLock; self:emit('catch',best.id); return
   end
   b.x,b.z,b.y=x+dx,z+dz,ny
   b.vy-=R.gravity*h
   if ny<=R.ballRadius then
    if b.vy < -R.floorThreshold then
     b.vy=-b.vy*R.floorRebound
     if b.state=='flight' then b.state='loose'; b.vx*=R.firstLandingMultiplier; b.vz*=R.firstLandingMultiplier end
    else b.vy=0 end
   end
   if b.state=='loose' and ny<=R.ballRadius+0.01 then
    local decay=math.exp(-R.looseFriction*h); b.vx*=decay; b.vz*=decay
   end
   local hw,hd=R.width/2-R.ballRadius,R.depth/2-R.ballRadius
   if math.abs(b.x)>hw then b.x=math.clamp(b.x,-hw,hw); b.vx=-b.vx*R.rebound end
   if math.abs(b.z)>hd then b.z=math.clamp(b.z,-hd,hd); b.vz=-b.vz*R.rebound end
  end
 end
 function S.step(self: any, now: number,dt: number)
  self:resolve(now)
  if self.phase=='waiting' then if next(self.connected) then self:start() end; return end
  if self.phase~='play' then return end
  for _,a in self:living() do
   if a.chargeAt and now-a.lastMove>R.inputTimeout then a.chargeAt=nil end
   a.oldX,a.oldZ=a.x,a.z
   move(a,dt,now,self.ball.holderActorId==a.id)
  end
  for _,a in self:living() do
   if a.passAt and now>=a.passAt then self:launch(a) end
  end
  self:ballStep(dt); self.revision+=1
 end
 function S.snapshot(self: any): any
  local actors={}
  for i,a in self.actors do actors[i]=table.clone(a) end
  local b=table.clone(self.ball); b.stateRevision=self.revision; b.matchId=self.matchId; b.roundId=self.roundId
  if b.immune then b.immune=table.clone(b.immune) end
  return {protocolVersion=R.protocol,configVersion=R.version,matchId=self.matchId,roundId=self.roundId,
   revision=self.revision,serverTime=self.now,deadline=self.deadline,phase=self.phase,
   actors=actors,ball=b,winner=self.winner,responsible=self:responsible(),faults=self.faults}
 end
 return S
end
