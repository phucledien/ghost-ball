--!strict
return function(sim: any, P: any,advance: ((number) -> ())?)
 local clients: {[number]: any}={}
 local rejected: {[string]: number}={}
 local function reject(reason: string): boolean
  rejected[reason]=(rejected[reason] or 0)+1; return false
 end
 local function senderActor(id: number): any
  for _,a in sim.actors do if a.userId==id then return a end end
  return nil
 end
 local function receive(player: any,channel: any,p: any,now: number): boolean
  local id=player.UserId
  local c=clients[id]
  if not c then c={Move={},Action={},Sync={},seqMove=0,seqAction=0}; clients[id]=c end
  -- Rate limit before walking untrusted tables; every category uses a fixed bucket.
  local bucket=if channel=='Move' then c.Move elseif channel=='Action' then c.Action else c.Sync
  local rate=if channel=='Move' then 20 elseif channel=='Action' then 10 else 1
  if not P.bucket(bucket,now,rate,if rate==1 then 2 else 5) then return reject('rate') end
  local valid,reason=P.validate(channel,p)
  if not valid then return reject(reason) end
  if channel=='Ready' or channel=='SyncRequest' then
   if advance then advance(now) end; sim:resolve(now); return true
  end
  if p.matchId~=sim.matchId or p.roundId~=sim.roundId then return reject('epoch') end
  do
   local a=senderActor(id)
   if not a or not a.alive then return reject('spectator') end
  end
  local key=if channel=='Move' then 'seqMove' else 'seqAction'
  if p.seq<=c[key] then return reject('replay') end
  c[key]=p.seq
  -- Only bounded, validated, current-epoch, live-sender, non-replayed traffic
  -- may flush the simulation. sim:command still resolves the wall deadline first.
  if advance then advance(now) end
  sim:resolve(now)
  -- Advancement can replace the epoch and the entire sorted roster. Never reuse
  -- a pre-flush slot/reference, even if its numerical id still exists.
  if p.matchId~=sim.matchId or p.roundId~=sim.roundId then return reject('epoch') end
  local a=senderActor(id)
  if not a or not a.alive then return reject('spectator') end
  if not sim:command(a.id,if channel=='Move' then 'Move' else p.action,p,now) then return reject('illegal') end
  if channel=='Move' then a.moveSeq=p.seq else a.actionSeq=p.seq end
  return true
 end
 return {receive=receive,remove=function(id: number) clients[id]=nil end,
  diagnostics=function() local counts=rejected; rejected={}; return counts end}
end
