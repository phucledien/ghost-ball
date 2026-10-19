--!strict
return function(P: any)
 local folder=Instance.new('Folder'); folder.Name='GhostBallEffects'; folder.Parent=workspace
 -- Fixed pool: no ever-growing per-event Instances/connections.
 local pool={}; local cursor=0
 for i=1,12 do
  local p=P.part('Pulse',Vector3.new(1,0.1,1),Color3.fromRGB(247,199,87),folder)
  p.Shape=Enum.PartType.Cylinder; p.Material=Enum.Material.Neon; p.Transparency=1
  pool[i]={part=p,at=-100,x=0,z=0}
 end
 return {
  emit=function(x: number,z: number,now: number)
   cursor=cursor%#pool+1; local p=pool[cursor]; p.at=now; p.x=x; p.z=z
  end,
  render=function(now: number,reduced: boolean)
   for _,p in pool do
    local t=(now-p.at)/0.4
    p.part.Transparency=if t>=0 and t<1 then 0.25+t*0.75 else 1
    local size=if reduced then 2 else 1+math.clamp(t,0,1)*6
    p.part.Size=Vector3.new(0.08,size,size)
    p.part.CFrame=CFrame.new(p.x*3,0.15,p.z*3)*CFrame.Angles(0,0,math.pi/2)
   end
  end,
 }
end
