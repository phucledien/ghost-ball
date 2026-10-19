--!strict
-- Wall-time driver shared with offline regression tests. Commands flush this clock first.
return function(sim: any,R: any,initial: number)
 local cursor=initial
 return function(now: number): boolean
  if now<cursor then return false end
  local before=sim.phase
  -- Do not replay contacts/actions after observing an expired wall deadline.
  sim:resolve(now)
  local elapsed=now-cursor
  local overrun=elapsed>8*R.step
  local begin=math.max(cursor,now-8*R.step)
  if before~=sim.phase or sim.phase~='play' then
   sim:step(now,0)
  else
   -- Distinct endpoints; a final partial step leaves snapshots at the exact wall time.
   local count=math.min(8,math.ceil((now-begin)/R.step))
   for i=1,count do
    local finish=if i==count then now else math.min(now,begin+R.step)
    sim:step(finish,finish-begin); begin=finish
   end
  end
  cursor=now
  return overrun
 end
end
