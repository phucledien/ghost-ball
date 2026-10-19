--!strict
return function(fit: any,R: any,hud: any,engine: any?)
 local E=engine or {workspace=workspace,game=game,Enum=Enum,Vector3=Vector3,CFrame=CFrame}
 return function()
  local camera=E.workspace.CurrentCamera
  if not camera then return end
  camera.CameraType=E.Enum.CameraType.Scriptable
  camera.FieldOfViewMode=E.Enum.FieldOfViewMode.Vertical; camera.FieldOfView=fit.fov
  -- FOV describes the fullscreen render area; ViewportSize can exclude device cutouts.
  -- GetInsetArea rectangles share a Core UI-relative origin, so their difference
  -- gives the true safe margins in that fullscreen projection without double insets.
  local gui=E.game:GetService('GuiService')
  local full=gui:GetInsetArea(E.Enum.ScreenInsets.None)
  local core=gui:GetInsetArea(E.Enum.ScreenInsets.CoreUISafeInsets)
  local width,height=full.Max.X-full.Min.X,full.Max.Y-full.Min.Y
  local safe={left=core.Min.X-full.Min.X,top=core.Min.Y-full.Min.Y,
   right=full.Max.X-core.Max.X,bottom=full.Max.Y-core.Max.Y}
  hud.layout(height-safe.top-safe.bottom)
  local frame=fit.fit(width,height,safe,R)
  local target=E.Vector3.new(frame.targetX,frame.targetY,frame.targetZ)
  local pitch,yaw=fit.pitch,fit.yaw
  local offset=E.Vector3.new(math.cos(pitch)*math.sin(yaw),math.sin(pitch),math.cos(pitch)*math.cos(yaw))*frame.distance
  camera.CFrame=E.CFrame.lookAt(target+offset,target); camera.Focus=E.CFrame.new(target)
 end
end
