--!strict
return function(hud: any,send: any,primary: any,engine: any?)
 -- Optional engine adapter lets offline tests execute these exact handlers.
 local E=engine or {game=game,Instance=Instance,Enum=Enum,Vector2=Vector2,Vector3=Vector3,workspace=workspace}
 local game,Instance,Enum,Vector2,Vector3,workspace=E.game,E.Instance,E.Enum,E.Vector2,E.Vector3,E.workspace
 local UIS=game:GetService('UserInputService')
 local GuiService=game:GetService('GuiService')
 local player=game:GetService('Players').LocalPlayer
 local context=Instance.new('InputContext'); context.Name='GhostBallPlay'; context.Priority=2000; context.Sink=true
 context.Parent=player:WaitForChild('PlayerGui')
 local move=Instance.new('InputAction'); move.Name='Move'; move.Type=Enum.InputActionType.Direction2D; move.Parent=context
 for _,keys in {{Enum.KeyCode.W,Enum.KeyCode.S,Enum.KeyCode.A,Enum.KeyCode.D},{Enum.KeyCode.Up,Enum.KeyCode.Down,Enum.KeyCode.Left,Enum.KeyCode.Right}} do
  local binding=Instance.new('InputBinding'); binding.Up=keys[1]; binding.Down=keys[2]; binding.Left=keys[3]; binding.Right=keys[4]
  binding.Parent=move
 end
 local action=Instance.new('InputAction'); action.Name='Primary'; action.Type=Enum.InputActionType.Bool; action.Parent=context
 for _,key in {Enum.KeyCode.Space,Enum.KeyCode.J} do
  local binding=Instance.new('InputBinding'); binding.KeyCode=key; binding.Parent=action
 end
 local I: any={mx=0,mz=0,ax=1,az=0,down=false,enabled=false,lastPointer='Keyboard'}
 local keyboard=Vector2.zero; local stick=Vector2.zero
 local stickTouch: InputObject?=nil; local aimTouch: InputObject?=nil
 local aimOrigin=Vector2.zero
 local wanted=false; local windowFocused=true; local textFocused=false; local menuOpen=false
 local awaitNeutral=false; local primaryArmed=true
 local function cancel()
  local active=I.enabled or I.down or stickTouch~=nil or aimTouch~=nil
  I.down=false; I.mx,I.mz=0,0; keyboard=Vector2.zero; stick=Vector2.zero
  stickTouch=nil; aimTouch=nil; awaitNeutral=true; primaryArmed=false
  if active then send('Cancel') end
 end
 local function refresh()
  local enabled=wanted and windowFocused and not textFocused and not UIS:GetFocusedTextBox() and not menuOpen and not GuiService.MenuIsOpen
  if I.enabled and not enabled then
   -- Clear held state before disabling IAS, which can synchronously emit Released.
   cancel(); I.enabled=false
  end
  I.enabled=enabled==true; context.Enabled=I.enabled
 end
 local function press(fresh: boolean?)
  refresh()
  if not I.enabled or I.down then return end
  if fresh then primaryArmed=true end
  if not primaryArmed then return end
  I.down=true; primary(true)
 end
 local function release()
  refresh()
  if not I.enabled or not I.down then return end
  I.down=false; primary(false)
 end
 action.Pressed:Connect(function() press() end)
 action.Released:Connect(function()
  release(); if I.enabled then primaryArmed=true end
 end)
 move.StateChanged:Connect(function(v: Vector2)
  refresh()
  if not I.enabled then return end
  if v.Magnitude==0 then awaitNeutral=false end
  if not awaitNeutral then keyboard=v end
 end)
 local moveKeys={Enum.KeyCode.W,Enum.KeyCode.S,Enum.KeyCode.A,Enum.KeyCode.D,Enum.KeyCode.Up,Enum.KeyCode.Down,Enum.KeyCode.Left,Enum.KeyCode.Right}
 UIS.InputBegan:Connect(function(input,processed)
  refresh()
  I.lastPointer=if input.UserInputType==Enum.UserInputType.Touch then 'Touch' else 'Keyboard'
  if not I.enabled or processed then return end
  if table.find(moveKeys,input.KeyCode) then awaitNeutral=false end
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.KeyCode==Enum.KeyCode.Space or input.KeyCode==Enum.KeyCode.J then press(true) end
 end)
 local function cancelled(input: InputObject): boolean
  if input.UserInputState~=Enum.UserInputState.Cancel then return false end
  if input==stickTouch or input==aimTouch or (input.UserInputType==Enum.UserInputType.MouseButton1 and I.down) then cancel() end
  return true
 end
 UIS.InputEnded:Connect(function(input)
  if cancelled(input) then return end
  if input.KeyCode==Enum.KeyCode.Space or input.KeyCode==Enum.KeyCode.J then primaryArmed=true; release() end
  if input.UserInputType==Enum.UserInputType.MouseButton1 then release() end
  if input==stickTouch then stickTouch=nil; stick=Vector2.zero end
  if input==aimTouch then aimTouch=nil; release() end
 end)
 hud.joystick.InputBegan:Connect(function(input: InputObject)
  refresh()
  if input.UserInputType==Enum.UserInputType.Touch and I.enabled and not stickTouch then stickTouch=input end
 end)
 hud.primary.InputBegan:Connect(function(input: InputObject)
  refresh()
  if input.UserInputType==Enum.UserInputType.Touch and I.enabled and not aimTouch then
   aimTouch=input; aimOrigin=Vector2.new(input.Position.X,input.Position.Y); press(true)
  end
 end)
 local function worldAxes(v: Vector2): (number,number)
  local c=workspace.CurrentCamera
  if not c then return 0,0 end
  local right=c.CFrame.RightVector; local look=c.CFrame.LookVector
  local f=Vector3.new(look.X,0,look.Z).Unit
  local w=right*v.X+f*v.Y
  if w.Magnitude>1 then w=w.Unit end
  return w.X,w.Z
 end
 UIS.InputChanged:Connect(function(input)
  if cancelled(input) then return end
  refresh(); if not I.enabled then return end
  if input==stickTouch then
   local center=hud.joystick.AbsolutePosition+hud.joystick.AbsoluteSize/2
   local delta=(Vector2.new(input.Position.X,input.Position.Y)-center)/45
   stick=Vector2.new(delta.X,-delta.Y)
  end
  if input==aimTouch then
   local delta=Vector2.new(input.Position.X,input.Position.Y)-aimOrigin
   if delta.Magnitude>12 then I.ax,I.az=worldAxes(Vector2.new(delta.X,-delta.Y).Unit) end
  end
 end)
 UIS.WindowFocusReleased:Connect(function() windowFocused=false; refresh() end)
 UIS.WindowFocused:Connect(function() windowFocused=true; refresh() end)
 UIS.TextBoxFocused:Connect(function() textFocused=true; refresh() end)
 UIS.TextBoxFocusReleased:Connect(function() textFocused=false; refresh() end)
 GuiService.MenuOpened:Connect(function() menuOpen=true; refresh() end)
 GuiService.MenuClosed:Connect(function() menuOpen=false; refresh() end)
 function I.setEnabled(enabled: boolean) wanted=enabled; refresh() end
 function I.clear() cancel() end
 function I.update(localActor: any)
  refresh()
  if not I.enabled then I.mx,I.mz=0,0; return end
  I.mx,I.mz=worldAxes(if stickTouch then stick else keyboard)
  if I.lastPointer~='Touch' and localActor then
   local camera=workspace.CurrentCamera
   if camera then
    -- MouseLocation is screen-relative. ScreenPointToRay is Core UI-relative:
    -- subtract the actual current GUI inset, including nonzero horizontal offsets.
    local p=UIS:GetMouseLocation(); local inset=GuiService:GetGuiInset()
    local ray=camera:ScreenPointToRay(p.X-inset.X,p.Y-inset.Y)
    if math.abs(ray.Direction.Y)>1e-6 then
     local distance=-ray.Origin.Y/ray.Direction.Y
     if distance>0 then
      local point=ray.Origin+ray.Direction*distance
      local delta=Vector2.new(point.X/3-localActor.x,point.Z/3-localActor.z)
      if delta.Magnitude>0.1 then I.ax,I.az=delta.Unit.X,delta.Unit.Y end
     end
    end
   end
  end
 end
 return I
end
