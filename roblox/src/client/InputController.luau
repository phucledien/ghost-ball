--!strict
return function(hud: any,send: any,primary: any)
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
 local function cancel()
  I.down=false; I.mx,I.mz=0,0; keyboard=Vector2.zero; stick=Vector2.zero
  stickTouch=nil; aimTouch=nil; send('Cancel')
 end
 local function press()
  if not I.enabled or I.down or UIS:GetFocusedTextBox() then return end
  I.down=true; primary(true)
 end
 local function release()
  if not I.down then return end
  I.down=false; primary(false)
 end
 action.Pressed:Connect(press); action.Released:Connect(release)
 move.StateChanged:Connect(function(v: Vector2) keyboard=v end)
 UIS.InputBegan:Connect(function(input,processed)
  I.lastPointer=if input.UserInputType==Enum.UserInputType.Touch then 'Touch' else 'Keyboard'
  if not processed and input.UserInputType==Enum.UserInputType.MouseButton1 then press() end
 end)
 UIS.InputEnded:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 then release() end
  if input==stickTouch then stickTouch=nil; stick=Vector2.zero end
  if input==aimTouch then aimTouch=nil; release() end
 end)
 hud.joystick.InputBegan:Connect(function(input: InputObject)
  if input.UserInputType==Enum.UserInputType.Touch and I.enabled and not stickTouch then stickTouch=input end
 end)
 hud.primary.InputBegan:Connect(function(input: InputObject)
  if input.UserInputType==Enum.UserInputType.Touch and I.enabled and not aimTouch then
   aimTouch=input; aimOrigin=Vector2.new(input.Position.X,input.Position.Y); press()
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
  if input.UserInputState==Enum.UserInputState.Cancel then
   if input==stickTouch or input==aimTouch then cancel() end; return
  end
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
 UIS.WindowFocusReleased:Connect(cancel)
 UIS.TextBoxFocused:Connect(cancel)
 GuiService.MenuOpened:Connect(cancel)
 function I.setEnabled(enabled: boolean)
  if I.enabled and not enabled then cancel() end
  I.enabled=enabled; context.Enabled=enabled
 end
 function I.clear() cancel() end
 function I.update(localActor: any)
  if not I.enabled then I.mx,I.mz=0,0; return end
  I.mx,I.mz=worldAxes(if stickTouch then stick else keyboard)
  if I.lastPointer~='Touch' and localActor then
   local camera=workspace.CurrentCamera
   if camera then
    local p=UIS:GetMouseLocation(); local ray=camera:ScreenPointToRay(p.X,p.Y)
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
