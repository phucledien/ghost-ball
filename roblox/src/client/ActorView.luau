--!strict
return function(P: any)
 local folder=Instance.new('Folder'); folder.Name='GhostBallActors'; folder.Parent=workspace
 local views: {[number]: any}={}
 local palette={Color3.fromRGB(247,199,87),Color3.fromRGB(99,216,232),Color3.fromRGB(240,122,136),Color3.fromRGB(173,152,238),Color3.fromRGB(143,214,157),Color3.fromRGB(244,170,108),Color3.fromRGB(146,180,238),Color3.fromRGB(224,160,215)}
 local V: any={}
 function V.clear() for _,v in views do v.model:Destroy() end; table.clear(views) end
 function V.pose(a: any,x: number,z: number,now: number,localId: number?,reduced: boolean)
  local v=views[a.id]
  if not v then
   local model=Instance.new('Model'); model.Name='Nova_'..a.id; model.Parent=folder
   local color=palette[a.id]; local kit=Color3.fromRGB(24,35,56)
   v={model=model,parts={},cue='',cueAt=0}; views[a.id]=v
   for _,def in {
    {'Torso',Vector3.new(1.6,1.7,0.8),kit}, {'Head',Vector3.new(1.05,1.05,1),Color3.fromRGB(207,166,128)},
    {'Hair',Vector3.new(1.2,0.4,1.1),Color3.fromRGB(225,215,192)},
    {'LeftArm',Vector3.new(0.5,1.5,0.6),color},{'RightArm',Vector3.new(0.5,1.5,0.6),color},
    {'LeftLeg',Vector3.new(0.65,1.4,0.65),kit},{'RightLeg',Vector3.new(0.65,1.4,0.65),kit},
    {'Stripe',Vector3.new(0.3,1.5,0.04),color},
   } do v.parts[def[1]]=P.part(def[1],def[2],def[3],model) end
   local label=Instance.new('BillboardGui'); label.Size=UDim2.fromOffset(160,40); label.StudsOffset=Vector3.new(0,1.5,0); label.AlwaysOnTop=true
   label.Adornee=v.parts.Head; label.Parent=model
   local t=Instance.new('TextLabel'); t.Size=UDim2.fromScale(1,1); t.BackgroundTransparency=1; t.TextColor3=color; t.TextStrokeTransparency=0.25
   t.Font=Enum.Font.GothamBold; t.TextSize=13; t.Text='#'..a.id..' '..a.name; t.Parent=label
   if localId==a.id then local h=Instance.new('Highlight'); h.FillTransparency=1; h.OutlineColor=Color3.new(1,0.85,0.3); h.Parent=model end
  end
  local speed=math.sqrt(a.vx*a.vx+a.vz*a.vz)
  local run=if reduced then 0 else math.sin(now*17)*math.min(speed/6.2,1)*0.65
  local kick=if a.passAt or (v.cue=='pass' and now-v.cueAt<0.3) then 1 else 0
  local catch=if v.cue=='catch' and now-v.cueAt<0.25 then 0.7 else 0
  local win=if v.cue=='victory' then 2.5 else 0
  local dash=if now<a.dashUntil then -0.35 else 0
  local root=CFrame.new(x*3,0,z*3)*CFrame.Angles(0,math.atan2(-a.ax,-a.az),0)
  if not a.alive then root*=CFrame.Angles(0,0,math.rad(75)) end
  local function pose(name: string,pos: Vector3,rx: number)
   local p=v.parts[name]; p.CFrame=root*CFrame.new(pos)*CFrame.Angles(rx,0,0); p.Transparency=if a.alive then 0 else 0.6
  end
  pose('Torso',Vector3.new(0,2.2,0),dash)
  pose('Head',Vector3.new(0,3.55,0),0); pose('Hair',Vector3.new(0,4.05,0),0)
  pose('LeftArm',Vector3.new(-1.1,2.3,0),-run-catch-win); pose('RightArm',Vector3.new(1.1,2.3,0),run-catch-win)
  pose('LeftLeg',Vector3.new(-0.45,0.7,0),run); pose('RightLeg',Vector3.new(0.45,0.7,-kick*0.5),-run-kick)
  pose('Stripe',Vector3.new(0,2.2,-0.43),dash)
 end
 function V.event(e: any)
  local v=views[e.actorId]; if v then v.cue=e.type; v.cueAt=e.serverTime end
 end
 return V
end
