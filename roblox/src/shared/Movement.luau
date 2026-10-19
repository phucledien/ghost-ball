--!strict
-- Shared numerical movement kernel. Injecting dependencies keeps it runnable in Luau CLI.
return function(R: any, M: any)
 return function(a: any, dt: number, now: number, holding: boolean)
  if now-a.lastMove > R.inputTimeout then a.mx,a.mz=0,0 end
  if now < a.dashUntil then
   a.vx,a.vz=a.dx*R.dashSpeed,a.dz*R.dashSpeed
  else
   local speed=R.run*(if holding then R.holderMultiplier else 1)*(if a.chargeAt then R.chargeMultiplier else 1)
   local tx,tz=a.mx*speed,a.mz*speed
   local vx,vz=tx-a.vx,tz-a.vz
   local dist=math.sqrt(vx*vx+vz*vz)
   if a.mx==0 and a.mz==0 then
    local decay=math.exp(-R.friction*dt); a.vx*=decay; a.vz*=decay
   elseif dist>0 then
    local k=math.min(1,R.acceleration*dt/dist); a.vx+=vx*k; a.vz+=vz*k
   end
  end
  local x,z=a.x+a.vx*dt,a.z+a.vz*dt
  a.x=math.clamp(x,-R.width/2+R.actorRadius,R.width/2-R.actorRadius)
  a.z=math.clamp(z,-R.depth/2+R.actorRadius,R.depth/2-R.actorRadius)
  if a.x~=x then a.vx=0 end; if a.z~=z then a.vz=0 end
 end
end
