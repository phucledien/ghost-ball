--!strict
-- Signal/vector stand-ins exercise exact source callbacks; NOT Roblox runtime QA.
return function(factory: any)
 local function signal(): any
  local callbacks: {(...any) -> ()}={}
  return {Connect=function(_: any,fn: (...any) -> ()) table.insert(callbacks,fn) end,
   fire=function(...) for _,fn in callbacks do fn(...) end end}
 end
 local function vec(x: number,y: number,z: number?): any
  local t={X=x,Y=y,Z=z or 0}; local mt: any={}
  mt.__add=function(a: any,b: any) return vec(a.X+b.X,a.Y+b.Y,a.Z+b.Z) end
  mt.__sub=function(a: any,b: any) return vec(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end
  mt.__mul=function(a: any,b: number) return vec(a.X*b,a.Y*b,a.Z*b) end
  mt.__div=function(a: any,b: number) return vec(a.X/b,a.Y/b,a.Z/b) end
  mt.__index=function(a: any,key: string)
   local m=math.sqrt(a.X*a.X+a.Y*a.Y+a.Z*a.Z)
   return if key=='Magnitude' then m elseif key=='Unit' then vec(a.X/m,a.Y/m,a.Z/m) else nil
  end
  return setmetatable(t,mt)
 end
 local function setup(): any
  local focused: any=nil
  local UIS: any={InputBegan=signal(),InputEnded=signal(),InputChanged=signal(),WindowFocusReleased=signal(),WindowFocused=signal(),TextBoxFocused=signal(),TextBoxFocusReleased=signal()}
  UIS.GetFocusedTextBox=function() return focused end
  UIS.GetMouseLocation=function() return vec(400,236) end
  local inset=vec(44,36)
  local GS={MenuOpened=signal(),MenuClosed=signal(),MenuIsOpen=false,GetGuiInset=function() return inset,vec(0,0) end}
  local instances={}
  local camera: any={CFrame={RightVector=vec(1,0,0),LookVector=vec(0,0,-1)}}
  local rays={}
  camera.ScreenPointToRay=function(_: any,x: number,y: number)
   table.insert(rays,{method='Screen',x=x,y=y}); return {Origin=vec(0,3,0),Direction=vec(0,-1,0)}
  end
  camera.ViewportPointToRay=function(_: any,x: number,y: number)
   table.insert(rays,{method='Viewport',x=x,y=y}); return {Origin=vec(0,3,0),Direction=vec(0,-1,0)}
  end
  local E={game={GetService=function(_: any,name: string)
    return if name=='UserInputService' then UIS elseif name=='GuiService' then GS else {LocalPlayer={WaitForChild=function() return {} end}}
   end},workspace={CurrentCamera=camera},
   Instance={new=function(kind: string)
    local i={kind=kind,Pressed=signal(),Released=signal(),StateChanged=signal()}; table.insert(instances,i); return i
   end},Vector2={zero=vec(0,0),new=vec},Vector3={new=vec},
   Enum={InputActionType={Direction2D='D2',Bool='Bool'},KeyCode={W='W',S='S',A='A',D='D',Up='Up',Down='Down',Left='Left',Right='Right',Space='Space',J='J'},UserInputType={Touch='Touch',MouseButton1='Mouse'},UserInputState={Cancel='Cancel'}}}
  local hud={joystick={InputBegan=signal(),AbsolutePosition=vec(0,0),AbsoluteSize=vec(108,108)},primary={InputBegan=signal()}}
  local sent,primary={},{}
  local input=factory(hud,function(action: string) table.insert(sent,action) end,function(down: boolean) table.insert(primary,down) end,E)
  local context: any=nil; local move: any=nil; local action: any=nil
  for _,i in instances do
   if i.Name=='Move' then move=i elseif i.Name=='Primary' then action=i elseif i.Name=='GhostBallPlay' then context=i end
  end
  input.setEnabled(true)
  return {input=input,UIS=UIS,GS=GS,hud=hud,sent=sent,primary=primary,move=move,action=action,context=context,rays=rays,
   focus=function(value: any) focused=value end,setInset=function(x: number,y: number) inset=vec(x,y) end}
 end
 local passed,failed=0,0
 local function test(name: string,fn: () -> ())
  local ok,err=pcall(fn)
  if ok then passed+=1; print('PASS',name) else failed+=1; print('FAIL',name,err) end
 end
 local function touch(): any return {UserInputType='Touch',UserInputState='Begin',Position=vec(50,50)} end
 test('GBQA-03 Cancel at InputEnded or InputChanged never emits Release; duplicate termination is inert',function()
  for _,changed in {false,true} do
   local t=setup(); local p=touch(); t.hud.primary.InputBegan.fire(p)
   assert(t.primary[1]==true and t.input.down)
   p.UserInputState='Cancel'
   if changed then t.UIS.InputChanged.fire(p) end
   t.UIS.InputEnded.fire(p); t.UIS.InputChanged.fire(p); t.UIS.InputEnded.fire(p)
   assert(#t.primary==1 and #t.sent==1 and t.sent[1]=='Cancel' and not t.input.down)
   local fresh=touch(); t.hud.primary.InputBegan.fire(fresh); fresh.UserInputState='End'; t.UIS.InputEnded.fire(fresh)
   assert(#t.primary==3 and t.primary[2]==true and t.primary[3]==false)
  end
 end)
 test('GBQA-03 independent touch pointers and normal mouse/keyboard release',function()
  local t=setup(); local left,right=touch(),touch()
  t.hud.joystick.InputBegan.fire(left); t.hud.primary.InputBegan.fire(right)
  left.Position=vec(90,54); t.UIS.InputChanged.fire(left); t.input.update(nil); assert(t.input.mx>0)
  t.UIS.InputEnded.fire(left); assert(#t.primary==1)
  t.UIS.InputEnded.fire(right); assert(#t.primary==2 and t.primary[2]==false)
  t.action.Pressed.fire(); t.action.Released.fire(); assert(#t.primary==4)
  local mouse={UserInputType='Mouse',UserInputState='Begin'}
  t.UIS.InputBegan.fire(mouse,false); mouse.UserInputState='Cancel'; t.UIS.InputEnded.fire(mouse)
  assert(#t.primary==5 and t.primary[5]==true and t.sent[#t.sent]=='Cancel')
 end)
 test('GBQA-04 textbox blocks held movement, IAS primary and new pointers until released',function()
  local t=setup(); t.move.StateChanged.fire(vec(1,0)); t.input.update(nil); assert(t.input.mx==1)
  t.action.Pressed.fire(); assert(t.input.down)
  t.focus({}); t.UIS.TextBoxFocused.fire({})
  for _=1,20 do
   t.move.StateChanged.fire(vec(1,0)); t.action.Pressed.fire(); t.action.Released.fire()
   t.hud.primary.InputBegan.fire(touch()); t.input.setEnabled(true); t.input.update(nil)
   assert(t.input.mx==0 and not t.input.enabled and not t.context.Enabled and not t.input.down)
  end
  assert(#t.sent==1 and #t.primary==1)
  t.focus(nil); t.UIS.TextBoxFocusReleased.fire({}); t.input.update(nil)
  assert(t.input.enabled and t.context.Enabled and t.input.mx==0)
  -- A synthetic state for a still-held key must not revive stale movement.
  t.move.StateChanged.fire(vec(1,0)); t.input.update(nil); assert(t.input.mx==0)
  t.move.StateChanged.fire(vec(0,0)); t.move.StateChanged.fire(vec(-1,0)); t.input.update(nil); assert(t.input.mx==-1)
  t.action.Pressed.fire(); assert(#t.primary==1) -- re-enabled IAS cannot revive held Primary
  t.UIS.InputBegan.fire({UserInputType='Keyboard',KeyCode='Space'},false)
  t.action.Pressed.fire(); t.action.Released.fire(); assert(#t.primary==3)
 end)
 test('GBQA-04 overlapping menu/help/orientation/window/text gates cancel once and restore cleanly',function()
  local t=setup(); t.action.Pressed.fire(); t.move.StateChanged.fire(vec(1,0))
  t.GS.MenuIsOpen=true; t.GS.MenuOpened.fire(); t.focus({}); t.UIS.TextBoxFocused.fire({})
  t.UIS.WindowFocusReleased.fire()
  for _=1,30 do t.input.setEnabled(false); t.input.update(nil) end -- help + portrait
  assert(#t.sent==1 and #t.primary==1)
  t.focus(nil); t.UIS.TextBoxFocusReleased.fire({}); t.GS.MenuIsOpen=false; t.GS.MenuClosed.fire()
  t.input.setEnabled(true); assert(not t.input.enabled) -- window still unfocused
  t.UIS.WindowFocused.fire(); t.input.update(nil); assert(t.input.enabled and t.input.mx==0)
  t.UIS.InputBegan.fire({UserInputType='Keyboard',KeyCode='D'},false)
  t.move.StateChanged.fire(vec(1,0)); t.input.update(nil); assert(t.input.mx==1)
 end)
 test('GBQA-05 MouseLocation subtracts current GUI inset before ScreenPointToRay',function()
  local t=setup()
  for _,inset in {{0,0},{0,36},{44,36}} do
   t.setInset(inset[1],inset[2]); t.input.update({x=1,z=0})
   local ray=t.rays[#t.rays]
   assert(ray.method=='Screen' and ray.x==400-inset[1] and ray.y==236-inset[2])
  end
 end)
 print('INPUT SUMMARY',passed,'pass',failed,'fail; stand-ins only')
 assert(failed==0,'Input handler regression failures: '..failed)
end
