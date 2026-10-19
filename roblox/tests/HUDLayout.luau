--!strict
-- Runs the actual HUD factory with stand-ins. No rendered/device hit testing.
return function(factory: any,Fit: any)
 local function dim(x: number,xo: number,y: number,yo: number): any
  return {X={Scale=x,Offset=xo},Y={Scale=y,Offset=yo}}
 end
 local instances: {any}={}
 local E={Instance={new=function(kind: string)
   local node={kind=kind,Activated={Connect=function() end}}; table.insert(instances,node); return node
  end},Color3={fromRGB=function(...) return {...} end},
  Enum={ScreenInsets={CoreUISafeInsets='Core'},ZIndexBehavior={Sibling='Sibling'},Font={GothamBold='GothamBold'}},
  UDim2={new=dim,fromOffset=function(x: number,y: number) return dim(0,x,0,y) end,fromScale=function(x: number,y: number) return dim(x,0,y,0) end},
  UDim={new=function(x: number,y: number) return {x,y} end}}
 local hud=factory({WaitForChild=function() return {} end},E)
 local function rect(node: any,w: number,h: number): any
  return {x=node.Position.X.Scale*w+node.Position.X.Offset,y=node.Position.Y.Scale*h+node.Position.Y.Offset,
   w=node.Size.X.Scale*w+node.Size.X.Offset,h=node.Size.Y.Scale*h+node.Size.Y.Offset}
 end
 local count=0
 -- Include compact/safe sizes, the 500px layout boundary, and normal-to-short-to-normal transitions.
 for _,width in {729,756,844,1280,1920} do
  for _,height in {1080,720,500,499,390,333,720,390} do
   hud.layout(height)
   for _,node in instances do if node.kind=='TextButton' then
    local r=rect(node,width,height)
    assert(r.w>=48 and r.h>=48,node.Name..' is below 48x48 at '..width..'x'..height)
    assert(r.x>=0 and r.y>=0 and r.x+r.w<=width+1e-7 and r.y+r.h<=height+1e-7,node.Name..' outside safe area')
   end end
   local top: {any}={}; local bottom: {any}={}; local required={hud.primary,hud.joystick,hud.mute,hud.motion,hud.forfeit}
   local margin=Fit.hud(height)
   for _,node in required do
    local r=rect(node,width,height)
    assert(r.y+r.h<=margin.top or r.y>=height-margin.bottom,'control exceeds fitted HUD margin: '..node.Name)
    if node==hud.mute or node==hud.motion then table.insert(top,r) else table.insert(bottom,r) end
   end
   for _,row in {top,bottom} do for i=1,#row do for j=i+1,#row do
    local a,b=row[i],row[j]
    assert(a.x+a.w<=b.x or b.x+b.w<=a.x or a.y+a.h<=b.y or b.y+b.h<=a.y,'required buttons overlap')
   end end end
   local diagnostic,forfeit=rect(hud.diagnostic,width,height),rect(hud.forfeit,width,height)
   assert(diagnostic.y+diagnostic.h<=forfeit.y,'diagnostic overlaps Forfeit')
   for _,label in {hud.status,hud.detail} do
    local r=rect(label,width,height); assert(r.y+r.h<=margin.top)
   end
   count+=1
  end
 end
 print('PASS GBQA-09 actual HUD factory: all buttons >=48x48, safe bounds, target separation and camera margins;',count,'layouts; stand-ins only')
end
