--!strict
return function(manifest: any,diagnostic: TextLabel)
 local folder=Instance.new('Folder'); folder.Name='GhostBallAudio'; folder.Parent=workspace
 local output=Instance.new('AudioDeviceOutput'); output.Parent=folder
 local players: {[string]: AudioPlayer}={}; local missing=0
 for name,entry in manifest.audio do
  if entry.assetId=='' then missing+=1; continue end
  local a=Instance.new('AudioPlayer'); a.Name=name; a.Asset=entry.assetId; a.Volume=0.45; a.Parent=folder
  local wire=Instance.new('Wire'); wire.SourceInstance=a; wire.TargetInstance=output; wire.Parent=a
  players[name]=a
 end
 diagnostic.Text=if missing>0 then 'Audio pending: '..missing..'/6 assets' else 'Audio loading…'
 task.delay(10,function()
  local ready=0; for _,a in players do if a.IsReady then ready+=1 end end
  diagnostic.Text=if ready==6 then '' else 'Audio unavailable: '..(6-ready)..'/6 cues'
 end)
 local A: any={muted=false}
 function A.play(name: string)
  local a=players[name]
  if not A.muted and a and a.IsReady then a:Stop(); a:Play() end
 end
 function A.toggle()
  A.muted=not A.muted
  if A.muted then for _,a in players do a:Stop() end end
 end
 return A
end
