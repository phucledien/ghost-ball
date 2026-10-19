--!strict
-- Local movement only; authoritative state always owns ball/actions/results.
return function(move: any)
 local predicted: any=nil
 local pending: {any}={}
 return {
  clear=function() predicted=nil; table.clear(pending) end,
  reconcile=function(a: any,holding: boolean)
   predicted=table.clone(a)
   local kept={}
   for _,p in pending do
    if p.seq>a.moveSeq then
     predicted.mx,predicted.mz=p.mx,p.mz; predicted.lastMove=p.now
     move(predicted,p.dt,p.now,holding); table.insert(kept,p)
    end
   end
   pending=kept
  end,
  step=function(a: any,input: any,seq: number,dt: number,now: number,holding: boolean): any
   if not predicted then predicted=table.clone(a) end
   predicted.mx,predicted.mz=input.mx,input.mz; predicted.lastMove=now
   move(predicted,dt,now,holding)
   table.insert(pending,{seq=seq,mx=input.mx,mz=input.mz,dt=dt,now=now})
   if #pending>120 then table.remove(pending,1) end
   return predicted
  end,
 }
end
