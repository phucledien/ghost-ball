--!strict
local Players=game:GetService('Players')
local RunService=game:GetService('RunService')
local root=game:GetService('ReplicatedStorage'):WaitForChild('GhostBall')
local shared=root:WaitForChild('Shared')
local R=require(shared.Rules); local M=require(shared.Math)
local move=require(shared.Movement)(R,M)
local Sim=require(shared.Sim)(R,M,move)
local sim=Sim.new(7321)
local bots=require(shared.Bots)(R,M)
local clock=require(shared.Clock)(sim,R,workspace:GetServerTimeNow())
local overruns=0
local function advance(now: number) if clock(now) then overruns+=1 end end
local gateway=require(script.Parent.InputGateway)(sim,require(shared.Protocol)(M),advance)
Players.CharacterAutoLoads=false
local function join(p: Player)
 local now=workspace:GetServerTimeNow(); advance(now); sim:join(p.UserId,p.DisplayName,now)
end
Players.PlayerAdded:Connect(join)
for _,p in Players:GetPlayers() do join(p) end
Players.PlayerRemoving:Connect(function(p)
 local now=workspace:GetServerTimeNow(); advance(now)
 sim:leave(p.UserId,now); gateway.remove(p.UserId)
end)
local input=root:WaitForChild('Input') :: RemoteEvent
local snapshot=root:WaitForChild('Snapshot') :: RemoteEvent
local event=root:WaitForChild('Event') :: RemoteEvent
input.OnServerEvent:Connect(function(p,channel,payload)
 local now=workspace:GetServerTimeNow()
 local ok=gateway.receive(p,channel,payload,now)
 if ok and (channel=='Ready' or channel=='SyncRequest') then snapshot:FireClient(p,sim:snapshot()) end
end)
local lastSnapshot,lastDiagnostic=0,0
RunService.Heartbeat:Connect(function()
 local now=workspace:GetServerTimeNow()
 -- Flush simulation before introducing current-time bot commands.
 advance(now)
 bots(sim,now)
 local changed=#sim.events>0
 for _,e in sim.events do event:FireAllClients(e) end
 table.clear(sim.events)
 if changed or now-lastSnapshot>=1/15 then
  snapshot:FireAllClients(sim:snapshot()); lastSnapshot=now
 end
 if now-lastDiagnostic>=10 then
  local counts=gateway.diagnostics()
  if next(counts) then warn('GhostBall rejected inputs',game:GetService('HttpService'):JSONEncode(counts)) end
  if overruns>0 or sim.faults>0 then warn('GhostBall overruns/faults',overruns,sim.faults) end
  lastDiagnostic=now
 end
end)
