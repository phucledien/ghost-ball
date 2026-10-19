--!strict
-- Perspective half-space fit, in studs/pixels; no engine objects or screenshots.
local F={pitch=math.rad(36),yaw=math.rad(45),fov=38}
function F.bounds(R: any): {any}
 -- Include field line thickness, all rotated/leaning/knocked-over Parts, and held
 -- ball offset (0.7 units + radius), which can extend beyond the legal actor center.
 local hx=math.max((R.width/2-R.actorRadius)*R.scale+5,R.width*R.scale/2+0.1,(R.width/2-R.actorRadius+0.7+R.ballRadius)*R.scale)
 local hz=math.max((R.depth/2-R.actorRadius)*R.scale+5,R.depth*R.scale/2+0.1,(R.depth/2-R.actorRadius+0.7+R.ballRadius)*R.scale)
 local points={}
 for _,x in {-hx,hx} do for _,z in {-hz,hz} do for _,y in {-2,6} do
  table.insert(points,{x=x,y=y,z=z})
 end end end
 return points
end
function F.hud(height: number): any
 return if height<500 then {top=80,bottom=88} else {top=128,bottom=126}
end
function F.fit(width: number,height: number,safe: any,R: any): any
 width=math.max(1,width); height=math.max(1,height)
 -- Reserve the matching full/compact HUD layout, billboard half-size and 8 px
 -- breathing room. Safe margins come from fullscreen/CoreUISafeInsets regions.
 local hud=F.hud(height-safe.top-safe.bottom)
 local left,right=safe.left+88,width-safe.right-88
 local top,bottom=safe.top+hud.top+28,height-safe.bottom-hud.bottom-28
 -- Portrait is non-playable; remain finite until the rotate overlay is dismissed.
 if right<=left then left,right=width*0.45,width*0.55 end
 if bottom<=top then top,bottom=height*0.45,height*0.55 end
 local xmin,xmax=2*left/width-1,2*right/width-1
 local ymin,ymax=1-2*bottom/height,1-2*top/height
 local cx,cy=(xmin+xmax)/2,(ymin+ymax)/2
 local ty=math.tan(math.rad(F.fov/2)); local tx=ty*width/height
 local sp,cp,sy,co=math.sin(F.pitch),math.cos(F.pitch),math.sin(F.yaw),math.cos(F.yaw)
 local distance=1
 for _,p in F.bounds(R) do
  local x=co*p.x-sy*p.z
  local y=-sp*sy*p.x+cp*p.y-sp*co*p.z
  local radial=cp*sy*p.x+sp*p.y+cp*co*p.z
  distance=math.max(distance,radial+1,
   (x+xmax*tx*radial)/(tx*(xmax-cx)),(x+xmin*tx*radial)/(tx*(xmin-cx)),
   (y+ymax*ty*radial)/(ty*(ymax-cy)),(y+ymin*ty*radial)/(ty*(ymin-cy)))
 end
 distance+=0.01
 local rightOffset,upOffset=-cx*tx*distance,-cy*ty*distance
 return {distance=distance,targetX=co*rightOffset-sp*sy*upOffset,targetY=cp*upOffset,
  targetZ=-sy*rightOffset-sp*co*upOffset,left=left,right=right,top=top,bottom=bottom}
end
return F
