import json, sys
from PIL import Image
# usage: anim.py <cut dir> <out name> "<frame>:<ms>,<frame>:<ms>,..." [size] [still index]
CUT, NAME = sys.argv[1], sys.argv[2]
info=json.load(open(f'{CUT}/info.json'))
SEQ=[(a, int(b)) for a, b in (x.split(':') for x in sys.argv[3].split(','))]
W=760; OUTS=int(sys.argv[4]) if len(sys.argv)>4 else 480
STILL=int(sys.argv[5]) if len(sys.argv)>5 else 2
frames=[]
for n,d in SEQ:
    im=Image.open(f'{CUT}/{n}.png'); i=info[n]
    x=int(i['cx']); y=i['y0']
    c=im.crop((x-W//2,y-60,x+W//2,y-60+W)).resize((OUTS,OUTS),Image.LANCZOS)
    frames.append((c,d))
imgs=[f for f,_ in frames]; durs=[d for _,d in frames]
imgs[0].save(f'{NAME}.webp',save_all=True,append_images=imgs[1:],duration=durs,loop=0,quality=78,method=6)
# gif matted on the site teal
bg=(108,188,146)
g=[]
for f in imgs:
    b=Image.new('RGBA',f.size,bg+(255,)); b.alpha_composite(f); g.append(b.convert('RGB').quantize(255,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG))
g[0].save(f'{NAME}.gif',save_all=True,append_images=g[1:],duration=durs,loop=0,optimize=True)
S=Image.new('RGB',(OUTS*5,OUTS*2),bg)
for k,f in enumerate(imgs): S.paste(f,((k%5)*OUTS,(k//5)*OUTS),f)
S.save(f'{NAME}-sheet.jpg')
imgs[STILL].save(f'{NAME}-still.webp',quality=85)
