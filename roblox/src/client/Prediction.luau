--!strict
-- Snapshot time covers motion; sequence acknowledges an input change, not a frame.
return function(move: any)
 local predicted: any=nil
 local pending: {any}={}
 local snapshotTime=-math.huge
 local acknowledged=0
 local activeSeq=0
 local simulatedTime=-math.huge
 local function integrate(a: any,p: any,begin: number,holding: boolean)
  a.mx,a.mz=p.mx,p.mz; a.lastMove=p.inputAt
  move(a,p.finish-begin,p.finish,holding)
 end
 return {
  clear=function()
   predicted=nil; table.clear(pending); snapshotTime=-math.huge; acknowledged=0; activeSeq=0; simulatedTime=-math.huge
  end,
  reconcile=function(a: any,holding: boolean,time: number)
   if time<snapshotTime or a.moveSeq<acknowledged then return end
   snapshotTime=time; acknowledged=a.moveSeq; predicted=table.clone(a)
   local kept={}
   for _,p in pending do
    -- The entire prefix through serverTime is already represented, even if unacked.
    -- Conversely an acked input may still have genuinely later locally predicted motion.
    if p.finish>time then
     local begin=math.max(p.begin,time)
     if p.seq<acknowledged then
      p.seq=acknowledged; p.mx,p.mz=a.mx,a.mz; p.inputAt=a.lastMove
     end
     p.begin=begin; integrate(predicted,p,begin,holding); table.insert(kept,p)
    end
   end
   pending=kept; activeSeq=if #kept>0 then kept[#kept].seq else acknowledged
   simulatedTime=math.max(time,simulatedTime)
  end,
  step=function(a: any,input: any,seq: number,dt: number,now: number,holding: boolean): any
   if not predicted then predicted=table.clone(a); activeSeq=a.moveSeq end
   local begin=math.max(now-math.max(0,dt),snapshotTime,simulatedTime)
   local inputAt=input.sentAt or now
   local function append(finish: number,mx: number,mz: number,at: number,label: number)
    if finish<=begin then return end
    local p={seq=label,mx=mx,mz=mz,inputAt=at,begin=begin,finish=finish}
    integrate(predicted,p,begin,holding); table.insert(pending,p); begin=finish
   end
   -- A command sent during/at this frame cannot own the earlier part of dt.
   if now>begin and inputAt>begin then
    append(math.min(now,inputAt),predicted.mx,predicted.mz,predicted.lastMove,activeSeq)
   end
   if now>begin then append(now,input.mx,input.mz,inputAt,seq); activeSeq=seq end
   if now==inputAt and input.mx~=nil and seq>activeSeq then
    predicted.mx,predicted.mz=input.mx,input.mz; predicted.lastMove=inputAt; activeSeq=seq
   end
   simulatedTime=math.max(simulatedTime,now)
   -- Bound speculative replay during an outage. Reconciliation replaces the baseline.
   while #pending>120 do table.remove(pending,1) end
   return predicted
  end,
 }
end
