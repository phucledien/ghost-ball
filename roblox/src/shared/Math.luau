--!strict
local M = {}
function M.finite(n: any): boolean
 return type(n) == 'number' and n == n and math.abs(n) < math.huge
end
function M.unit(x: number, z: number): (number, number)
 local m = math.sqrt(x*x+z*z)
 if m < 1e-8 then return 0, 0 end
 return x/m, z/m
end
function M.clampAxis(x: number, z: number): (number, number)
 local m = math.sqrt(x*x+z*z)
 if m > 1 then return x/m, z/m end
 return x,z
end
-- Closed entry/exit interval of a segment inside a circle, including initial overlap.
function M.sweepInterval(x: number,z: number,dx: number,dz: number,cx: number,cz: number,r: number): (number?,number?)
 local ox,oz=x-cx,z-cz
 local c=ox*ox+oz*oz-r*r
 local a=dx*dx+dz*dz
 if a<1e-12 then return if c<=0 then 0 else nil, if c<=0 then 1 else nil end
 local b=2*(ox*dx+oz*dz)
 local disc=b*b-4*a*c
 if disc<0 then return nil,nil end
 local root=math.sqrt(disc)
 local enter,leave=math.max(0,(-b-root)/(2*a)),math.min(1,(-b+root)/(2*a))
 if enter>leave then return nil,nil end
 return enter,leave
end
function M.sweep(x: number,z: number,dx: number,dz: number,cx: number,cz: number,r: number): number?
 local enter=M.sweepInterval(x,z,dx,dz,cx,cz,r)
 return enter
end
-- Earliest eligible time in a contact interval under the same ballistic height as flight.
function M.catchTime(enter: number,leave: number,y: number,vy: number,g: number,height: number,h: number,eligible: number): number?
 local t=math.max(enter*h,eligible,0)
 local last=leave*h
 if t>last then return nil end
 if y+vy*t-0.5*g*t*t>height then
  -- Above the catch plane: only the descending root can become eligible.
  t=(vy+math.sqrt(vy*vy+2*g*(y-height)))/g
 end
 return if t<=last then t/h else nil
end
return M
