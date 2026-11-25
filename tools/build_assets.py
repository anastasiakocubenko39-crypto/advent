import json, sys
from PIL import Image, ImageDraw, ImageFilter
RAW='/home/user/advent-src/raw/'; OUT='/home/user/advent-calendar/assets/'
def save(im, name, q=82, w=None):
    if w and im.width>w: im=im.resize((w, round(im.height*w/im.width)), Image.LANCZOS)
    im.save(OUT+name, 'WEBP', quality=q, method=6)
bgb=Image.open(RAW+'r1.jpeg').convert('RGB'); save(bgb,'img/bg-blue.webp',80)
bgg=Image.open(RAW+'r4.jpeg').convert('RGB'); save(bgg,'img/bg-green.webp',80)
house=Image.open(RAW+'r2.png').convert('RGBA'); save(house,'img/house.webp',85)
tree=Image.open(RAW+'r3.png').convert('RGBA'); save(tree,'img/tree.webp',85)
# balls: n: (cx, cy, r, cap_top)
balls={2:(380,365,46,316),3:(612,360,46,312),4:(393,575,49,518),5:(630,675,51,618),
 6:(193,890,48,828),7:(782,990,49,928),8:(412,905,43,848),9:(360,718,49,658),
 10:(262,1045,43,983),11:(645,895,46,838)}
layout={'tree':{'w':tree.width,'h':tree.height,'items':{}}}
for n,(cx,cy,r,cap) in balls.items():
    x0,y0,x1,y1=cx-r-4,cap-4,cx+r+5,cy+r+5
    crop=tree.crop((x0,y0,x1,y1))
    m=Image.new('L',crop.size,0); d=ImageDraw.Draw(m)
    d.ellipse([cx-r-1-x0,cy-r-1-y0,cx+r+1-x0,cy+r+1-y0],fill=255)
    d.rounded_rectangle([cx-16-x0,cap-y0,cx+16-x0,cy-r+14-y0],radius=5,fill=255)
    m=m.filter(ImageFilter.GaussianBlur(1.2))
    a=Image.new('RGBA',crop.size,(0,0,0,0)); a.paste(crop,(0,0),m)
    a.save(OUT+f'balls/b{n}.webp','WEBP',quality=88)
    layout['tree']['items'][n]={'kind':'ball','x':x0,'y':y0,'w':x1-x0,'h':y1-y0,'cx':cx,'cy':cy,'r':r,'cap':cap}
# star 1
x0,y0,x1,y1=420,8,555,135
star=tree.crop((x0,y0,x1,y1)); star.save(OUT+'balls/b1.webp','WEBP',quality=88)
layout['tree']['items'][1]={'kind':'star','x':x0,'y':y0,'w':x1-x0,'h':y1-y0,'cx':487,'cy':72,'r':60,'cap':y0}
# gift 12
x0,y0,x1,y1=352,1010,655,1275
g=tree.crop((x0,y0,x1,y1)); g.save(OUT+'balls/b12.webp','WEBP',quality=88)
layout['tree']['items'][12]={'kind':'gift','x':x0,'y':y0,'w':x1-x0,'h':y1-y0,'cx':503,'cy':1150,'r':140,'cap':y0}
# house windows: n: (x0,y0,x1,y1, arched)
win={1:(446,146,582,250,1),2:(194,338,300,466,1),3:(358,338,462,466,1),4:(553,338,657,466,1),5:(716,338,818,466,1),
 6:(130,636,226,768,1),7:(262,636,352,768,1),8:(660,636,750,768,1),9:(800,636,890,768,1),
 10:(226,965,302,1046,0),11:(706,965,782,1046,0),12:(452,624,562,918,2)}
layout['house']={'w':house.width,'h':house.height,'items':{}}
for n,(a,b,c,d_,arch) in win.items():
    layout['house']['items'][n]={'x':a,'y':b,'w':c-a,'h':d_-b,'arch':arch}
# small preview crops for design cards
json.dump(layout,open(OUT+'layout.json','w'),indent=1)
# sprite sheet for checking
sheet=Image.new('RGBA',(1300,160),(60,60,60,255));x=5
for n in range(1,13):
    im=Image.open(OUT+f'balls/b{n}.webp'); im.thumbnail((140,150)); sheet.alpha_composite(im,(x,5)); x+=105
sheet.save(sys.argv[1]+'/sheet.png')
hs=house.copy(); dr=ImageDraw.Draw(hs)
for n,(a,b,c,d_,arch) in win.items(): dr.rectangle([a,b,c,d_],outline=(0,255,0,255),width=3); dr.text((a+5,b+5),str(n),fill='white')
hs.convert('RGB').resize((512,640)).save(sys.argv[1]+'/house_boxes.png')

# ---- tree with balls 2..11 removed (inpaint) -> tree-empty.webp
import cv2, numpy as np
arr=np.array(tree); rgb=cv2.cvtColor(arr[:,:,:3],cv2.COLOR_RGB2BGR)
mask=np.zeros(arr.shape[:2],np.uint8)
for n,(cx,cy,r,cap) in balls.items():
    cv2.circle(mask,(cx,cy),r+5,255,-1); cv2.rectangle(mask,(cx-18,cap-4),(cx+18,cy-r+10),255,-1)
res=rgb.copy()
allmask=mask.copy()
hsv=cv2.cvtColor(rgb,cv2.COLOR_BGR2HSV)
H,W=mask.shape
for n,(cx,cy,r,cap) in balls.items():
    R=r+8
    ys,xs=np.mgrid[-R-(cy-cap):R+1,-R:R+1]
    best=None
    for dist in (2.3*R,2.8*R,3.4*R):
        for a in np.linspace(0,2*np.pi,24,endpoint=False):
            dx,dy=int(dist*np.cos(a)),int(dist*np.sin(a))
            x0,y0=cx+dx-R,cap-8+dy; x1,y1=cx+dx+R,cy+dy+R
            if x0<0 or y0<0 or x1>=W or y1>=H: continue
            if arr[y0:y1,x0:x1,3].min()<250: continue
            if allmask[y0:y1,x0:x1].max()>0: continue
            patch=hsv[y0:y1,x0:x1]
            # ornaments: very saturated red/blue or very bright smooth
            red=((patch[:,:,0]<10)|(patch[:,:,0]>165))&(patch[:,:,1]>120)&(patch[:,:,2]>80)
            blue=(patch[:,:,0]>95)&(patch[:,:,0]<135)&(patch[:,:,1]>80)
            snow=(patch[:,:,1]<40)&(patch[:,:,2]>190)
            score=red.mean()*3+blue.mean()*3+snow.mean()*0.7+abs(float(patch[:,:,2].mean())-float(hsv[cy-R:cy+R,cx-R:cx+R,2].mean()))/255*0.5
            if best is None or score<best[0]: best=(score,dx,dy)
    _,dx,dy=best
    m=np.zeros_like(mask); cv2.circle(m,(cx,cy),r+6,255,-1); cv2.rectangle(m,(cx-19,cap-5),(cx+19,cy-r+10),255,-1)
    src=np.roll(np.roll(rgb,-dy,0),-dx,1)
    try:
        res=cv2.seamlessClone(src,res,m,(cx,(cap-5+cy+r+6)//2),cv2.NORMAL_CLONE) if False else res
    except Exception as e: pass
    f=(cv2.GaussianBlur(cv2.dilate(m,np.ones((9,9),np.uint8)),(21,21),0)/255.0)[:,:,None]
    res=(res*(1-f)+src*f).astype(np.uint8)
out=cv2.cvtColor(res,cv2.COLOR_BGR2RGB); out=np.dstack([out,arr[:,:,3]])
Image.fromarray(out,'RGBA').save(OUT+'img/tree-empty.webp','WEBP',quality=85,method=6)
Image.fromarray(out,'RGBA').crop((150,280,850,1100)).convert('RGB').resize((420,492)).save(sys.argv[1]+'/tree_empty.png')

# ---- detect light bulbs for twinkle overlays
def lights(img, maxn, exclude=()):
    a=np.array(img); bgr=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2BGR); hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV)
    v=hsv[:,:,2].astype(np.float32); s=hsv[:,:,1]; h=hsv[:,:,0]
    cand=((v>235)&(h>=10)&(h<=35)&(a[:,:,3]>250)).astype(np.uint8)
    n,lab,stats,cent=cv2.connectedComponentsWithStats(cand)
    pts=[]
    for i in range(1,n):
        ar=stats[i,4]
        if 6<=ar<=260:
            x,y=cent[i]
            if any(ex[0]<=x<=ex[2] and ex[1]<=y<=ex[3] for ex in exclude): continue
            pts.append((float(x),float(y),float(ar)))
    rng=np.random.default_rng(3); rng.shuffle(pts); chosen=[]
    for p in pts:
        if all((p[0]-q[0])**2+(p[1]-q[1])**2>40**2 for q in chosen): chosen.append(p)
        if len(chosen)>=maxn: break
    return [[round(x/img.width*100,2),round(y/img.height*100,2)] for x,y,_ in chosen]
wins=[(a,b,c,d) for (a,b,c,d,_) in win.values()]
layout['house']['lights']=lights(house,70,wins)
bx=[(cx-r,cap,cx+r,cy+r) for (cx,cy,r,cap) in balls.values()]+[(352,1010,655,1275),(420,8,555,135)]
layout['tree']['lights']=lights(tree,80,bx)
json.dump(layout,open(OUT+'layout.json','w'),indent=1)
print(len(layout['house']['lights']),len(layout['tree']['lights']))
import os
os.makedirs('/home/user/advent-calendar/js',exist_ok=True)
open('/home/user/advent-calendar/js/layout.js','w').write('// Згенеровано tools/build_assets.py з макета Figma. Координати — пікселі вихідних картинок.\nexport const LAYOUT = '+json.dumps(layout,separators=(',',':'))+';\n')
os.remove(OUT+'layout.json')
