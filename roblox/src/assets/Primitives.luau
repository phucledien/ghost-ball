--!strict
local P={}
function P.part(name: string,size: Vector3,color: Color3,parent: Instance): Part
 local part=Instance.new('Part'); part.Name=name; part.Size=size; part.Color=color
 part.Anchored=true; part.CanCollide=false; part.CanTouch=false; part.CanQuery=false
 part.Material=Enum.Material.SmoothPlastic; part.TopSurface=Enum.SurfaceType.Smooth; part.BottomSurface=Enum.SurfaceType.Smooth
 part.Parent=parent; return part
end
function P.pitch(): Folder
 local f=Instance.new('Folder'); f.Name='LocalTrainingPitch'; f.Parent=workspace
 local field=P.part('Training Pitch 90x57',Vector3.new(90,0.3,57),Color3.fromRGB(29,69,65),f); field.Position=Vector3.new(0,-0.3,0)
 for i=-4,4 do
  local stripe=P.part('Turf',Vector3.new(9,0.02,57),Color3.fromRGB(32+2*(i%2),76,68),f)
  stripe.Position=Vector3.new(i*10,-0.135,0)
 end
 local white=Color3.fromRGB(165,193,166)
 for _,z in {-28.5,28.5} do local p=P.part('Touchline',Vector3.new(90,0.05,0.2),white,f); p.Position=Vector3.new(0,0,z) end
 for _,x in {-45,0,45} do local p=P.part('Line',Vector3.new(0.2,0.05,57),white,f); p.Position=Vector3.new(x,0,0) end
 for i=1,32 do
  local t=i*math.pi/16; local p=P.part('Center circle',Vector3.new(0.2,0.05,1.8),white,f)
  p.CFrame=CFrame.new(9*math.cos(t),0,9*math.sin(t))*CFrame.Angles(0,-t,0)
 end
 return f
end
return P
