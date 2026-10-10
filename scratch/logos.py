import numpy as np
from PIL import Image, ImageFilter
from collections import deque

# --- logo2: gold mark on light background with guide lines -> transparent PNG
im = Image.open("public/images/logo2.jpeg").convert("RGB")
a = np.asarray(im).astype(float)
r, g, b = a[...,0], a[...,1], a[...,2]
sat = r - b  # gold is strongly warm; paper/guide lines are near-neutral
alpha = np.clip((sat - 22) / 45, 0, 1)
gold = np.array([201, 162, 52], float)
out = np.zeros(a.shape[:2] + (4,), np.uint8)
out[...,:3] = gold.astype(np.uint8)
out[...,3] = (alpha * 255).astype(np.uint8)
img = Image.fromarray(out, "RGBA")
img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())
pad = int(max(img.size) * 0.04)
canvas = Image.new("RGBA", (img.width + 2*pad, img.height + 2*pad), (0,0,0,0))
canvas.paste(img, (pad, pad))
s = 4
canvas = canvas.resize((canvas.width*s//2, canvas.height*s//2), Image.LANCZOS)
canvas.save("public/images/krides-mark.png")
print("mark", canvas.size)

# --- logo1: dark rounded tile; knock out the light backdrop around it
im = Image.open("public/images/logo1.jpeg").convert("RGB")
a = np.asarray(im).astype(int)
h, w = a.shape[:2]
light = a.min(axis=2) > 150
bg = np.zeros((h, w), bool)
dq = deque()
for x in range(w):
    for y in (0, h-1):
        if light[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
for y in range(h):
    for x in (0, w-1):
        if light[y, x] and not bg[y, x]: bg[y, x] = True; dq.append((y, x))
while dq:
    y, x = dq.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; dq.append((ny, nx))
mask = Image.fromarray(((~bg) * 255).astype(np.uint8), "L")
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
rgba = im.convert("RGBA"); rgba.putalpha(mask)
rgba = rgba.crop(mask.point(lambda v: 255 if v > 128 else 0).getbbox())
side = max(rgba.size)
sq = Image.new("RGBA", (side, side), (0,0,0,0))
sq.paste(rgba, ((side-rgba.width)//2, (side-rgba.height)//2))
sq.resize((512, 512), Image.LANCZOS).save("public/images/krides-icon.png")
sq.resize((192, 192), Image.LANCZOS).save("public/images/krides-icon-192.png")
sq.resize((64, 64), Image.LANCZOS).save("src/app/icon.png")
print("icon", sq.size)
