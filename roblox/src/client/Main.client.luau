--!strict
local Players=game:GetService('Players'); local RunService=game:GetService('RunService')
local UIS=game:GetService('UserInputService'); local GuiService=game:GetService('GuiService')
local player=Players.LocalPlayer
local root=game:GetService('ReplicatedStorage'):WaitForChild('GhostBall')
local shared=root:WaitForChild('Shared'); local assets=root:WaitForChild('Assets')
local R=require(shared.Rules); local M=require(shared.Math)
local hud=require(script.Parent.HUD)(player)
local P=require(assets.Primitives); P.pitch()
local views=require(script.Parent.ActorView)(P)
local effects=require(script.Parent.Effects)(P)
local audio=require(script.Parent.Audio)(require(assets.AssetManifest),hud.diagnostic)
local camera=require(script.Parent.CameraController)(require(shared.CameraFit),R,hud)
local prediction=require(script.Parent.Prediction)(require(shared.Movement)(R,M))
local inputRemote=root:WaitForChild('Input') :: RemoteEvent
local snapshotRemote=root:WaitForChild('Snapshot') :: RemoteEvent
local eventRemote=root:WaitForChild('Event') :: RemoteEvent
local state: any=nil; local history: {any}={}; local localId: number?=nil
local actionSeq,moveSeq,lastMove=0,0,0
local sentMove={mx=0,mz=0,sentAt=0}
local reduced=false; local eventId=0; local lastCountdown=''
local input: any=nil
local function send(action: string)
 if not state then return end
 if action=='Cancel' then sentMove={mx=0,mz=0,sentAt=workspace:GetServerTimeNow()} end
 actionSeq+=1
 inputRemote:FireServer('Action',{matchId=state.matchId,roundId=state.roundId,seq=actionSeq,action=action,
  aimX=if input then input.ax else 1,aimZ=if input then input.az else 0})
end
input=require(script.Parent.InputController)(hud,send,function(pressed: boolean)
 if not state then return end
 if pressed then
  send(if state.ball.holderActorId==localId then 'Press' else 'Dash')
 else send('Release') end
end)
hud.mute.Activated:Connect(function() audio.toggle(); hud.mute.Text=if audio.muted then 'SOUND OFF' else 'SOUND ON' end)
hud.motion.Activated:Connect(function() reduced=not reduced; hud.motion.Text=if reduced then 'MOTION OFF' else 'MOTION ON' end)
hud.forfeit.Activated:Connect(function() send('Forfeit'); input.clear() end)
-- Retry until CoreGui is ready. Reset routes through the same idempotent forfeit path.
local reset=Instance.new('BindableEvent'); reset.Event:Connect(function() send('Forfeit'); input.clear() end)
task.spawn(function()
 for _=1,30 do
  local ok=pcall(function() game:GetService('StarterGui'):SetCore('ResetButtonCallback',reset) end)
  if ok then return end; task.wait(1)
 end
 warn('GhostBall could not bind Reset; use the Forfeit button')
end)
snapshotRemote.OnClientEvent:Connect(function(s)
 if s.protocolVersion~=R.protocol or s.configVersion~=R.version then hud.detail.Text='Build mismatch. Rejoin after updating.'; return end
 if state and (s.matchId<state.matchId or (s.matchId==state.matchId and s.revision<=state.revision)) then return end
 local epoch=not state or state.matchId~=s.matchId or state.roundId~=s.roundId
 if epoch then
  prediction.clear(); table.clear(history); input.clear(); sentMove={mx=0,mz=0,sentAt=0}
  if not state or state.matchId~=s.matchId then views.clear() end
 end
 state=s; localId=nil
 for _,a in s.actors do if a.userId==player.UserId then localId=a.id end end
 table.insert(history,s); if #history>6 then table.remove(history,1) end
 local a=if localId then s.actors[localId] else nil
 if a and a.alive and s.phase=='play' then prediction.reconcile(a,s.ball.holderActorId==localId,s.serverTime) else prediction.clear() end
end)
eventRemote.OnClientEvent:Connect(function(e)
 if e.eventId<=eventId then return end
 eventId=e.eventId
 if state and (e.matchId<state.matchId or (e.matchId==state.matchId and e.roundId<state.roundId)) then return end
 views.event(e)
 audio.play(e.type)
 if state and e.actorId and state.actors[e.actorId] then
  local a=state.actors[e.actorId]; effects.emit(a.x,a.z,e.serverTime)
 end
end)
local ball=P.part('Ghost Ball',Vector3.one*R.ballRadius*R.scale*2,Color3.fromRGB(255,225,134),workspace)
ball.Shape=Enum.PartType.Ball; ball.Material=Enum.Material.Neon
local function actorName(id: number?): string
 local a=if id and state then state.actors[id] else nil
 return if a then '#'..a.id..' '..a.name else '—'
end
RunService.RenderStepped:Connect(function(dt)
 camera()
 local c=workspace.CurrentCamera; if not c then return end
 local portrait=c.ViewportSize.Y>c.ViewportSize.X
 hud.rotate.Visible=portrait
 local a=if state and localId then state.actors[localId] else nil
 local enabled=state and state.phase=='play' and a and a.alive and not portrait and not hud.help.Visible and not GuiService.MenuIsOpen and UIS:GetFocusedTextBox()==nil
 input.setEnabled(enabled==true); input.update(a)
 enabled=input.enabled
 hud.joystick.Visible=UIS.TouchEnabled; hud.primary.Visible=UIS.TouchEnabled
 if not state then return end
 local now=workspace:GetServerTimeNow()
 -- Predict the interval with the input already sent before its start. A new
 -- Move at this endpoint applies to future frames, never retroactively to dt.
 local predicted=nil
 if enabled then predicted=prediction.step(a,sentMove,moveSeq,math.min(dt,0.05),now,state.ball.holderActorId==localId) end
 if enabled and now-lastMove>=1/20 then
  moveSeq+=1; lastMove=now; sentMove={mx=input.mx,mz=input.mz,sentAt=now}
  inputRemote:FireServer('Move',{matchId=state.matchId,roundId=state.roundId,seq=moveSeq,
   moveX=input.mx,moveZ=input.mz,aimX=input.ax,aimZ=input.az})
 end
 local before,after=history[1],history[#history]
 local targetTime=now-0.1
 for i=1,#history-1 do
  if history[i].serverTime<=targetTime then before=history[i]; after=history[i+1] end
 end
 local alpha=if after.serverTime>before.serverTime then math.clamp((targetTime-before.serverTime)/(after.serverTime-before.serverTime),0,1) else 1
 for _,actor in state.actors do
  local x,z=actor.x,actor.z
  if actor.id==localId and predicted then x,z=predicted.x,predicted.z
  elseif before.actors[actor.id] and after.actors[actor.id] then
   local p,q=before.actors[actor.id],after.actors[actor.id]; x=p.x+(q.x-p.x)*alpha; z=p.z+(q.z-p.z)*alpha
  end
  views.pose(actor,x,z,now,localId,reduced)
 end
 local b=state.ball
 ball.Transparency=if b.x then 0 else 1
 if b.x then
  local x,y,z=b.x,b.y,b.z
  if b.state=='held' and state.actors[b.holderActorId] then
   local holder=state.actors[b.holderActorId]
   x,z=holder.x+holder.ax*0.7,holder.z+holder.az*0.7
   if predicted and holder.id==localId then x,z=predicted.x+holder.ax*0.7,predicted.z+holder.az*0.7 end
  elseif before.ball.state==b.state and after.ball.state==b.state and before.ball.x and after.ball.x then
   x=before.ball.x+(after.ball.x-before.ball.x)*alpha
   y=before.ball.y+(after.ball.y-before.ball.y)*alpha
   z=before.ball.z+(after.ball.z-before.ball.z)*alpha
  end
  ball.Position=Vector3.new(x*3,y*3,z*3)
 end
 local alive=0; for _,v in state.actors do if v.alive then alive+=1 end end
 local remaining=math.max(0,state.deadline-now)
 local title=string.upper(state.phase)..' · '..string.format('%.1f',remaining)..'s · '..alive..' ALIVE'
 if state.phase=='result' then title=if state.winner then actorName(state.winner)..' WINS' else 'MATCH CANCELLED' end
 local spectator=not a or not a.alive
 hud.status.Text='GHOST BALL · '..title..(if spectator then '\nSPECTATING · next match joins automatically' else '\nYOU: #'..a.id)
 hud.detail.Text='HOLDER: '..actorName(b.holderActorId)..'\nOUT IF BUZZER: '..actorName(state.responsible)
 if enabled and a then
  local charge=if a.chargeAt then math.clamp((now-a.chargeAt)/R.fullCharge,0,1) else 0
  hud.primary.Text=if b.holderActorId==localId then 'A · PASS\n'..math.floor(charge*100)..'% CHARGE' else 'A · DASH\n'..string.format('%.1fs',math.max(0,a.dashReady-now))
 end
 local countKey=state.matchId..':'..state.roundId..':'..state.phase..':'..math.ceil(remaining)
 if (state.phase=='countdown' or state.phase=='play') and remaining<=3 and remaining>0 and lastCountdown~=countKey then audio.play('countdown'); lastCountdown=countKey end
 effects.render(now,reduced)
end)
inputRemote:FireServer('Ready',{protocolVersion=R.protocol})
task.spawn(function()
 while not state do task.wait(1); inputRemote:FireServer('SyncRequest',{protocolVersion=R.protocol}) end
end)
