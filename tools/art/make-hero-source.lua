local source,dest,finish,tags=app.params['source'],app.params['dest'],app.params['finish'],app.params['tags']
assert(source and dest and finish and tags,'Supply source, dest, finish and tags')
assert(not app.fs.isFile(dest) or app.params['force']=='true','Refusing to overwrite existing pixel source')
local file=io.open(tags,'r');local clips=json.decode(file:read('*a'));file:close()
local function sheet(path)
 local sprite=app.open(path)
 app.command.ImportSpriteSheet{ui=false,type=SpriteSheetType.ROWS,frameBounds=Rectangle(0,0,96,96),padding=Size(0,0),partialTiles=false}
 return sprite
end
local s=sheet(source);local expected=0
for _,clip in ipairs(clips) do expected=expected+#clip.durations*8 end
assert(#s.frames==expected,'Frame count mismatch')
s.layers[1].name='Base — Blender palette'
local corrections=sheet(finish);assert(#corrections.frames==expected)
app.activeSprite=s
local layer=s:newLayer();layer.name='Pixel finish — contour and clusters'
for i=1,expected do
 local cel=corrections.layers[1]:cel(i)
 if cel then s:newCel(layer,i,cel.image,cel.position) end
end
corrections:close()
local index=1
for facing=0,7 do
 for _,clip in ipairs(clips) do
  local first=index
  for _,ms in ipairs(clip.durations) do s.frames[index].duration=ms/1000;index=index+1 end
  local tag=s:newTag(first,index-1);tag.name=clip.name..'_'..facing
 end
end
local slice=s:newSlice(Rectangle(0,0,96,96));slice.name='Foot anchor';slice.pivot=Point(48,70)
s:saveAs(dest)
print('Saved '..expected..' frames with editable base + finishing layers and '..#s.tags..' tags')
