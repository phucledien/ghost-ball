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
-- Earliest segment/circle contact, including an initially overlapping segment.
function M.sweep(x: number,z: number, dx: number,dz: number, cx: number,cz: number,r: number): number?
 local ox,oz=x-cx,z-cz
 local c=ox*ox+oz*oz-r*r
 if c<=0 then return 0 end
 local a=dx*dx+dz*dz
 if a<1e-12 then return nil end
 local b=2*(ox*dx+oz*dz)
 local disc=b*b-4*a*c
 if disc<0 then return nil end
 local t=(-b-math.sqrt(disc))/(2*a)
 return if t>=0 and t<=1 then t else nil
end
return M
