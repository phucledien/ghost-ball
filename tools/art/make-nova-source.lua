local source=app.params['source']
local dest=app.params['dest']
assert(source and dest, 'Supply --script-param source=... --script-param dest=...')
assert(not app.fs.isFile(dest) or app.params['force']=='true', 'Source exists; refusing to overwrite pixel corrections. Use a new dest, or force=true only for deliberate regeneration.')
app.open(source)
app.command.ImportSpriteSheet{ui=false,type=SpriteSheetType.ROWS,frameBounds=Rectangle(0,0,96,96),padding=Size(0,0),partialTiles=false}
local s=app.activeSprite
assert(#s.frames==176,'Expected 176 frames, got '..#s.frames)
s.layers[1].name='Render — palette cleaned'
local clips={{'idle',{150,150,150,150}},{'run',{75,75,75,75,75,75,75,75}},{'pass',{45,45,50,70,70,120}},{'catch',{30,30,90,90}}}
local index=1
for facing=0,7 do
 for _,clip in ipairs(clips) do
  local first=index
  for _,ms in ipairs(clip[2]) do s.frames[index].duration=ms/1000;index=index+1 end
  local tag=s:newTag(first,index-1);tag.name=clip[1]..'_'..facing
 end
end
local paint=s:newLayer();paint.name='Pixel corrections — editable'
local slice=s:newSlice(Rectangle(0,0,96,96));slice.name='Foot anchor';slice.pivot=Point(48,70)
s:saveAs(dest)
print('Saved editable sprite source: '..#s.frames..' frames, '..#s.tags..' tags')
