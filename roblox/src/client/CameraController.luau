--!strict
return function()
 local camera=workspace.CurrentCamera
 if not camera then return end
 camera.CameraType=Enum.CameraType.Scriptable; camera.FieldOfView=38
 local aspect=camera.ViewportSize.X/math.max(1,camera.ViewportSize.Y)
 -- Frame the full pitch with extra room for HUD on short landscape screens.
 local distance=math.max(124,180/math.max(1,aspect))
 local pitch,yaw=math.rad(36),math.rad(45)
 local target=Vector3.new(0,0,0)
 camera.CFrame=CFrame.lookAt(target+Vector3.new(math.cos(pitch)*math.sin(yaw),math.sin(pitch),math.cos(pitch)*math.cos(yaw))*distance,target)
 camera.Focus=CFrame.new(target)
end
