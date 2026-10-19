--!strict
-- Adapter wiring only; analytic geometry assertions live in Regressions.
return function(factory: any,Fit: any,R: any)
 local function vec(x: number,y: number,z: number?): any
  return setmetatable({X=x,Y=y,Z=z or 0},{
   __add=function(a: any,b: any) return vec(a.X+b.X,a.Y+b.Y,a.Z+b.Z) end,
   __mul=function(a: any,b: number) return vec(a.X*b,a.Y*b,a.Z*b) end,
  })
 end
 for _,size in {{844,390},{1280,720},{1920,1080}} do
  for _,safe in {{left=0,right=0,top=0,bottom=0},{left=44,right=44,top=36,bottom=21}} do
   local w,h=size[1],size[2]
   local full={Min=vec(-safe.left,-safe.top),Max=vec(w-safe.left,h-safe.top)}
   local core={Min=vec(0,0),Max=vec(w-safe.left-safe.right,h-safe.top-safe.bottom)}
   local camera: any={ViewportSize=vec(w-safe.left-safe.right,h)}
   local layoutHeight=0
   local E={workspace={CurrentCamera=camera},Vector3={new=vec},
    Enum={CameraType={Scriptable='Scriptable'},FieldOfViewMode={Vertical='Vertical'},ScreenInsets={None='None',CoreUISafeInsets='Core'}},
    game={GetService=function() return {GetInsetArea=function(_: any,kind: string) return if kind=='None' then full else core end} end},
    CFrame={new=function(v: any) return v end,lookAt=function(pos: any,target: any) return {pos=pos,target=target} end}}
   factory(Fit,R,{layout=function(height: number) layoutHeight=height end},E)()
   local frame=Fit.fit(w,h,safe,R); local t=camera.CFrame.target
   assert(math.abs(t.X-frame.targetX)<1e-7 and math.abs(t.Y-frame.targetY)<1e-7 and math.abs(t.Z-frame.targetZ)<1e-7)
   assert(camera.FieldOfView==Fit.fov and camera.FieldOfViewMode=='Vertical')
   assert(layoutHeight==h-safe.top-safe.bottom)
  end
 end
 print('PASS GBQA-06 camera adapter uses fullscreen projection and Core UI safe area; stand-ins only')
end
