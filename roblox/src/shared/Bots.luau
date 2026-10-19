--!strict
return function(R: any,M: any)
 return function(sim: any,now: number)
  if sim.phase~='play' then return end
  for _,a in sim:living() do
   if not a.bot or now<a.nextThink then continue end
   a.nextThink=now+0.2
   local b=sim.ball; local mx,mz,ax,az=0,0,a.ax,a.az
   if b.holderActorId==a.id then
    local target=nil; local score=-math.huge
    for _,other in sim:living() do
     if other.id~=a.id and other.id~=b.previousHolderActorId then
      local distance=math.sqrt((other.x-a.x)^2+(other.z-a.z)^2)
      local value=-math.abs(distance-7)+sim:random()*2
      if value>score then target=other; score=value end
     end
    end
    if target then
     ax,az=M.unit(target.x-a.x+(sim:random()-0.5)*0.35,target.z-a.z+(sim:random()-0.5)*0.35)
     mx,mz=ax,az
    end
    sim:command(a.id,'Move',{moveX=mx,moveZ=mz,aimX=ax,aimZ=az},now)
    if a.chargeAt then
     if now-a.chargeAt>=0.2+0.35*sim:random() or sim.deadline-now<0.5 then
      sim:command(a.id,'Release',{aimX=ax,aimZ=az},now)
     end
    elseif sim:random()<0.8 then sim:command(a.id,'Press',{},now) end
   else
    local holder=sim:actor(b.holderActorId)
    if holder then mx,mz=M.unit(a.x-holder.x,a.z-holder.z)
    else
     local toward=sim.deadline-now<3 and b.lastKickerActorId==a.id
     local danger=(b.x-a.x)^2+(b.z-a.z)^2<16
     if toward or not danger then mx,mz=M.unit(b.x-a.x,b.z-a.z)
     else mx,mz=M.unit(a.x-b.x,a.z-b.z) end
    end
    -- Steer inward near bounds rather than pinning a fleeing bot in a corner.
    if math.abs(a.x)>R.width/2-2 then mx=-math.sign(a.x)*0.8 end
    if math.abs(a.z)>R.depth/2-2 then mz=-math.sign(a.z)*0.8 end
    mx,mz=M.clampAxis(mx,mz)
    sim:command(a.id,'Move',{moveX=mx,moveZ=mz,aimX=mx,aimZ=mz},now)
    if sim:random()<0.08 then sim:command(a.id,'Dash',{},now) end
   end
  end
 end
end
