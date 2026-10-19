--!strict
return function(M: any)
 local P = {}
 local schemas = {
  Ready={protocolVersion=true}, SyncRequest={protocolVersion=true,revision=true},
  Move={matchId=true,roundId=true,seq=true,moveX=true,moveZ=true,aimX=true,aimZ=true},
  Action={matchId=true,roundId=true,seq=true,action=true,aimX=true,aimZ=true},
 }
 local enums={Press=true,Release=true,Dash=true,Forfeit=true,Cancel=true}
 function P.validate(channel: any, p: any): (boolean,string)
  if type(channel)~='string' or not schemas[channel] or type(p)~='table' or getmetatable(p)~=nil then return false,'schema' end
  local count=0
  for k,v in p do
   count+=1
   if count>9 or type(k)~='string' or not schemas[channel][k] then return false,'field' end
   if k=='action' then
    if type(v)~='string' or not enums[v] then return false,'action' end
   elseif not M.finite(v) or math.abs(v)>2147483647 then return false,'number' end
  end
  if channel=='Ready' or channel=='SyncRequest' then
   return p.protocolVersion==1 and (p.revision==nil or (p.revision>=0 and p.revision%1==0)),'version'
  end
  for _,k in {'matchId','roundId','seq'} do
   if not M.finite(p[k]) or p[k]<0 or p[k]%1~=0 then return false,'sequence' end
  end
  if channel=='Move' then
   for _,k in {'moveX','moveZ','aimX','aimZ'} do
    if not M.finite(p[k]) or math.abs(p[k])>1 then return false,'axis' end
   end
  else
   if not enums[p.action] then return false,'action' end
   if (p.aimX==nil)~=(p.aimZ==nil) then return false,'aim' end
   if p.aimX~=nil and (math.abs(p.aimX)>1 or math.abs(p.aimZ)>1) then return false,'axis' end
  end
  return true,'ok'
 end
 function P.bucket(bucket: any, now: number, rate: number, burst: number): boolean
  bucket.tokens=math.min(burst,(bucket.tokens or burst)+math.max(0,now-(bucket.at or now))*rate)
  bucket.at=now
  if bucket.tokens<1 then return false end
  bucket.tokens-=1; return true
 end
 return P
end
