# Rotating heads

Turns a musician's green-screen photo series into the animated head shown on their band card.

```sh
pip install numpy pillow scipy
python3 scripts/heads/key.py <folder with the JPGs> cut/       # key out the green, despill, warm grade, find head position
python3 scripts/heads/anim.py cut/ wim "D18_0001:600,D18_0002:160,..."   # frame:milliseconds in play order
cp wim.webp wim-still.webp public/images/heads/
```

Then set `head: 'wim'` on the member in `src/data/band.ts`. The still frame is used when the visitor prefers reduced motion.
Green pieces of clothing that don't touch the edge of the photo (like a green collar) are kept.
