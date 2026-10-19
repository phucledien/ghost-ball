--!strict
return function(player: Player)
 local gui=Instance.new('ScreenGui'); gui.Name='GhostBall'; gui.ResetOnSpawn=false
 gui.ScreenInsets=Enum.ScreenInsets.CoreUISafeInsets; gui.ZIndexBehavior=Enum.ZIndexBehavior.Sibling
 gui.Parent=player:WaitForChild('PlayerGui')
 local navy=Color3.fromRGB(15,24,40); local gold=Color3.fromRGB(247,199,87)
 local function text(name: string,label: string,size: UDim2,pos: UDim2,button: boolean): any
  local t=Instance.new(if button then 'TextButton' else 'TextLabel') :: any
  t.Name=name; t.Text=label; t.Size=size; t.Position=pos; t.BackgroundColor3=navy
  t.BackgroundTransparency=0.12; t.TextColor3=gold; t.Font=Enum.Font.GothamBold
  t.TextSize=16; t.TextWrapped=true; t.Parent=gui
  local corner=Instance.new('UICorner'); corner.CornerRadius=UDim.new(0,10); corner.Parent=t
  return t
 end
 local status=text('Status','GHOST BALL · CLASSIC',UDim2.new(0.68,0,0,72),UDim2.new(0.16,0,0,4),false)
 local detail=text('Danger','Connecting…',UDim2.new(0.68,0,0,48),UDim2.new(0.16,0,0,80),false)
 local primary=text('Primary','A\nPASS / DASH',UDim2.fromOffset(92,92),UDim2.new(1,-108,1,-110),true)
 local joystick=text('Move','MOVE',UDim2.fromOffset(108,108),UDim2.new(0,16,1,-126),true)
 local mute=text('Mute','SOUND ON',UDim2.fromOffset(112,48),UDim2.new(1,-120,0,4),true)
 local motion=text('Motion','MOTION ON',UDim2.fromOffset(112,48),UDim2.new(1,-120,0,56),true)
 local helpButton=text('Help','?',UDim2.fromOffset(48,48),UDim2.fromOffset(4,4),true)
 local forfeit=text('Forfeit','FORFEIT',UDim2.fromOffset(112,48),UDim2.new(0.5,-56,1,-56),true)
 local help=text('Instructions','GHOST BALL\n\nPass the danger. Holder at the buzzer is OUT.\nIf loose or flying, the last kicker is OUT.\n\nWASD / arrows move · mouse aims\nSpace / J / click: tap pass, hold to charge\nWithout the ball: dash\nTouch: left stick + hold / drag / release A\n\nThe SERVER deadline decides. A late strike cannot save you.\nReset / disconnect forfeits. Late joins spectate.\n\nTAP TO PLAY',UDim2.new(0.72,0,0.76,0),UDim2.new(0.14,0,0.12,0),true)
 help.ZIndex=5; help.TextScaled=true
 local textLimit=Instance.new('UITextSizeConstraint'); textLimit.MinTextSize=11; textLimit.MaxTextSize=18; textLimit.Parent=help
 local rotate=text('Rotate','Rotate to landscape',UDim2.fromScale(1,1),UDim2.fromScale(0,0),false); rotate.ZIndex=10; rotate.Visible=false
 local diagnostic=text('AudioDiagnostic','Audio assets pending import',UDim2.fromOffset(240,24),UDim2.new(0.5,-120,1,-84),false); diagnostic.TextSize=12
 help.Activated:Connect(function() help.Visible=false end)
 helpButton.Activated:Connect(function() help.Visible=not help.Visible end)
 local function layout(height: number)
  local short=height<500
  status.Size=UDim2.new(0.68,0,0,if short then 40 else 72)
  detail.Size=UDim2.new(0.68,0,0,if short then 32 else 48)
  detail.Position=UDim2.new(0.16,0,0,if short then 48 else 80)
  status.TextSize=if short then 12 else 16; detail.TextSize=if short then 12 else 16
  primary.Size=UDim2.fromOffset(if short then 72 else 92,if short then 72 else 92)
  primary.Position=UDim2.new(1,if short then -88 else -108,1,if short then -88 else -110)
  joystick.Size=UDim2.fromOffset(if short then 72 else 108,if short then 72 else 108)
  joystick.Position=UDim2.new(0,16,1,if short then -88 else -126)
  forfeit.Size=UDim2.fromOffset(112,if short then 40 else 48)
  forfeit.Position=UDim2.new(0.5,-56,1,if short then -48 else -56)
  diagnostic.Size=UDim2.fromOffset(240,if short then 16 else 24)
  diagnostic.Position=UDim2.new(0.5,-120,1,if short then -68 else -84)
  for _,button in {mute,motion} do button.Size=UDim2.fromOffset(112,if short then 32 else 48) end
  motion.Position=UDim2.new(1,-120,0,if short then 40 else 56)
  for _,button in {primary,joystick,mute,motion,forfeit} do button.TextSize=if short then 12 else 16 end
 end
 return {layout=layout,gui=gui,status=status,detail=detail,primary=primary,joystick=joystick,mute=mute,motion=motion,
  help=help,rotate=rotate,forfeit=forfeit,diagnostic=diagnostic}
end
