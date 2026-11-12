# Rotating heads

Turns a musician's green-screen photo series into the animated head shown on their band card.

```sh
pip install numpy pillow scipy
python3 scripts/heads/key.py <folder with the JPGs> cut/       # key out the green, despill, warm grade, find head position
python3 scripts/heads/anim.py cut/ wim "D18_0001:180,D18_0002:180,..."   # frame:milliseconds in play order (keep timings equal for a smooth turn)
cp wim.webp wim-still.webp public/images/heads/
```

Then set `head: 'wim'` on the member in `src/data/band.ts`. The still frame is used when the visitor prefers reduced motion.
Green pieces of clothing that don't touch the edge of the photo (like a green collar) are kept.

Options (environment variables for `key.py`):
- `SHIRT=1 KEY_LO=25 KEY_HI=50` when the musician wears a green/teal top (Corentin): the top is found by its bluer hue and kept.

Frame orders used so far:
- Wim: `0001 0002 0003 0008 0010 0014 0012 0013 0007 0006 0005 0009 0011 0014 0012 0013`, 180 ms each
- Corentin: `0015 0017 0018 0019 0022 0021 0023 0024 0025 0027 0016 0018 0020 0022 0021 0023 0024 0026 0028`, 180 ms each, still = first frame
