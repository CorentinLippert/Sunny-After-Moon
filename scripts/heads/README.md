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
- Hans: key with `EDGE=1`; animate with `ANCHOR=neck NECK_OFFSET=600 CROP=860` (his mohawk sticks up differently per angle, so frames line up on the neck instead of the top of the hair). Order `0029 0031 0033 0035 0037 0038 0040 0042 0030 0032 0034 0036 0037 0039 0041 0043`, 180 ms each, still = first frame
- Sam: key with `KEY_LO=12 KEY_HI=28 HOLE=20000 EDGE=1` (olive T-shirt stays below 10, a shadowed corner of the screen drops to ~27; HOLE also clears the screen showing between dreadlocks); animate with `CROP=900` so the dreadlocks fit. Order `0044 0046 0048 0050 0051 0052 0053 0055 0045 0047 0049 0050 0051 0052 0054 0056`, 180 ms each, still = first frame
- Yorick: key with `EDGE=1`. He moved closer to the camera on a few shots, so those frames carry a third value, a scale (`frame:ms:scale`). Sequence: `D18_0057:180,D18_0066:180,D18_0067:180,D18_0059:180,D18_0060:180,D18_0061:180,D18_0062:180,D18_0068:180:0.87,D18_0069:180,D18_0058:180,D18_0067:180,D18_0059:180,D18_0060:180,D18_0061:180,D18_0062:180,D18_0063:180,D18_0070:180:0.95,D18_0064:180:0.92`, still = first frame. D18_0065 is left out (motion blur).
- Simon: key with `EDGE=1 HOLE=20000` (clears the screen showing through his curls); animate with `CROP=900`. Order `0071 0073 0075 0077 0078 0079 0080 0081 0082 0084 0088 0072 0074 0076 0077 0078 0079 0080 0081 0083 0085 0086 0087`, 180 ms each, still = first frame. D18_0089 is unused. On the back shot the photo stops above the crop, so anim.py ends the bottom fade where the photo ends.
