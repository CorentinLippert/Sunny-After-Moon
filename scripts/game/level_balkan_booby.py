"""Build the "Balkan Booby" level from the song analysis.

python3 scripts/game/level_balkan_booby.py > public/game/levels/balkan-booby.json

The player's horizontal position is locked to the song: x = SPEED * songTime. So every obstacle sits at the
x where the player is at a given moment of the music. Jumps are simulated with the same physics as the game
(src/game/physics constants mirrored below), so platforms are placed exactly where a jump on the beat lands.
`plan` lists the intended inputs; the game's autopilot (?autoplay) replays them to prove the level can be finished.
"""
import json, sys, math, os

HERE = os.path.dirname(__file__)
A = json.load(open(os.path.join(HERE, 'data/balkan-booby-analysis.json')))

# --- physics, keep in sync with src/game/engine.ts ---
SPEED = 180.0     # px per second of music
G = 1100.0
JUMP = -360.0
JUMP2 = -320.0
GLIDE_FALL = 70.0
TRAMP = -560.0
GROUND = 220.0
DT = 1 / 240

BEATS = A['beats']
BEAT = 60 / 184.57
END = 169.4


def bx(t):
    return SPEED * t


def beats_in(t0, t1):
    return [b for b in BEATS if t0 <= b < t1]


def nearest_beat(t):
    return min(BEATS, key=lambda b: abs(b - t))


def fly(t0, y0, vy0, surface_y, double_at=None, glide=False, t_max=4.0):
    """Simulate a jump; return (t, y) when falling through surface_y, plus the sampled path."""
    t, y, vy = t0, y0, vy0
    path = []
    used2 = False
    while t - t0 < t_max:
        if double_at is not None and not used2 and t >= double_at:
            vy = JUMP2
            used2 = True
        vy += G * DT
        if glide and used2 and vy > GLIDE_FALL:
            vy = GLIDE_FALL
        y_new = y + vy * DT
        t += DT
        if vy > 0 and y <= surface_y <= y_new:
            return t, surface_y, path
        y = y_new
        path.append((t, y))
    return None, None, path


level = {
    'title': 'Balkan Booby',
    'song': {'src': '/game/audio/balkan-booby.mp3', 'duration': 171.6, 'bpm': 184.6, 'beats': BEATS},
    'speed': SPEED,
    'ground': GROUND,
    'pits': [], 'jellies': [], 'tramps': [], 'babushkas': [], 'coins': [], 'checkpoints': [], 'signs': [],
    'plan': [], 'finish': bx(END),
}
pits = level['pits']
plan = level['plan']
coins = level['coins']


def coin(t, y):
    coins.append([round(bx(t), 1), round(y, 1)])


def arc_coins(path, every=0.09):
    last = -1
    for t, y in path:
        if t - last >= every:
            coin(t, y - 18)
            last = t


def gap(t, width_beats=1.1):
    """Pit starting just after beat t; the player jumps on t."""
    a, b = t + 0.05, t + 0.05 + width_beats * BEAT
    pits.append([round(bx(a), 1), round(bx(b), 1)])
    plan.append([round(t, 3), 'jump'])
    _, _, path = fly(t, GROUND, JUMP, GROUND)
    arc_coins(path[20::], 0.1)
    return t + 2 * BEAT


def babushka(t, kind='hop'):
    """Babushka the player meets on beat t (jump over her, stomp her or hit her)."""
    level['babushkas'].append({'x': round(bx(t) + (58 if kind == 'big' else 46), 1), 'kind': kind})
    plan.append([round(t, 3), 'jump'])


def tramp(t, land_beats=3):
    """Jelly trampoline on beat t, launching over a pit; lands on the ground land_beats later."""
    level['tramps'].append({'x': round(bx(t) + 6, 1)})
    # the game bounces as soon as the player is within 14 px of the trampoline centre
    tl, _, path = fly(t + (6 - 14) / SPEED, GROUND, TRAMP, GROUND)
    pits.append([round(bx(t + 0.18), 1), round(bx(tl - 0.12), 1)])
    arc_coins(path[30::], 0.12)
    return tl


def jelly_chain(t, n, heights):
    """Pit with n round jelly platforms; the player jumps on every second beat and lands on the next jelly."""
    start = t
    y = GROUND
    cur = t
    for k in range(n):
        target = heights[k % len(heights)]
        plan.append([round(cur, 3), 'jump'])
        tl, _, path = fly(cur, y, JUMP, target)
        if tl is None:
            raise SystemExit(f'jelly unreachable at {cur}')
        arc_coins(path[40::], 0.15)
        y = target
        nxt = min((b for b in BEATS if b >= tl + 0.05), default=tl + BEAT)
        # the jelly spans from where you land to where you take off on the next beat
        a, b = bx(tl) - 10, bx(nxt) + 10
        level['jellies'].append({'x': round((a + b) / 2, 1), 'y': target, 'w': round(max(44, b - a), 1)})
        cur = nxt
    # last jump back to the ground
    plan.append([round(cur, 3), 'jump'])
    tl, _, path = fly(cur, y, JUMP, GROUND)
    pits.append([round(bx(start + 0.1), 1), round(bx(tl - 0.15), 1)])
    return tl


def glide_hop(t, y, target, double_after=0.28):
    """Jump, double jump and glide down onto a high jelly far away."""
    plan.append([round(t, 3), 'jump'])
    plan.append([round(t + double_after, 3), 'jump2'])
    tl, _, path = fly(t, y, JUMP, target, double_at=t + double_after, glide=True)
    plan.append([round(tl, 3), 'release'])
    arc_coins(path[60::], 0.14)
    nxt = min(b for b in BEATS if b >= tl + 0.25)
    a, b = bx(tl) - 14, bx(nxt) + 10
    level['jellies'].append({'x': round((a + b) / 2, 1), 'y': target, 'w': round(b - a, 1)})
    return tl


def checkpoint(t, label):
    level['checkpoints'].append({'t': round(t, 3), 'x': round(bx(t), 1), 'label': label})


def melody_coins(t0, t1, every=0.16):
    mel = [m for m in A['mel'] if t0 <= m[0] < t1]
    if not mel:
        return
    lo, hi = 55, 80
    last = -1
    for t, p in mel:
        if t - last < every:
            continue
        h = 10 + max(0, min(1, (p - lo) / (hi - lo))) * 62
        coin(t, GROUND - h)
        last = t


def sign(t, key):
    level['signs'].append({'x': round(bx(t), 1), 'key': key})


# ---------------- the level, section by section ----------------
B = beats_in

# Intro 0.4-9.9: learn to jump. Gaps every 2 bars, melody coins in between.
checkpoint(0.0, 'intro')
sign(0.6, 'jump')
ib = B(0.4, 9.9)
melody_coins(0.5, 2.4)
for i in (8, 16, 24):
    gap(ib[i])
melody_coins(3.6, 4.9)
melody_coins(6.2, 7.5)

# The little stop around 10 s: a trampoline throws you over the silence.
tl = tramp(nearest_beat(9.6))

# 11.1-19.8: the babushkas arrive, dancing on the beat.
checkpoint(11.6, 'babushkas')
sign(11.9, 'action')
sb = B(12.2, 19.8)
for i, b in enumerate(sb):
    if i % 8 == 0:
        babushka(b)
    elif i % 8 == 4:
        gap(b)

# 19.8-41.3: main groove. 4-bar phrases: gap, babushka, double gap (da-da), babushka.
checkpoint(20.2, 'groove')
gb = B(20.6, 41.0)
for i, b in enumerate(gb):
    k = i % 16
    if k == 0:
        gap(b)
    elif k == 4:
        babushka(b)
    elif k in (8, 10):
        gap(b, 1.0)
    elif k == 13:
        babushka(b, 'big')
melody_coins(20.6, 41.0, 0.5)

# 41.3-70.6: the jelly section. Chains of round jellies, jump every second beat.
checkpoint(41.6, 'jelly')
sign(41.8, 'jelly')
t = nearest_beat(42.3)
while t < 68:
    t = jelly_chain(t, 5, [GROUND - 30, GROUND - 52, GROUND - 30, GROUND - 8])
    nb = [b for b in BEATS if b > t + 0.6]
    babushka(nb[2])
    t = nb[6]
    if t < 66:
        t = tramp(t)
        t = min(b for b in BEATS if b > t + 0.9)

# 70.6-93: trampolines and babushka crowds.
checkpoint(71.2, 'tramp')
t = nearest_beat(71.8)
while t < 91.5:
    t = tramp(t)
    nb = [b for b in BEATS if b > t + 0.3]
    babushka(nb[1])
    babushka(nb[3])
    gap(nb[6])
    t = nb[9]

# 93-99.4: the floating break. Double jump + glide from jelly to jelly.
checkpoint(92.3, 'glide')
sign(92.6, 'glide')
t, y = nearest_beat(93.0), GROUND
start = t
for target in (GROUND - 60, GROUND - 80, GROUND - 50, GROUND - 70):
    tl = glide_hop(t, y, target)
    y = target
    t = min(b for b in BEATS if b >= tl + 0.25)
plan.append([round(t, 3), 'jump'])
tl, _, _ = fly(t, y, JUMP, GROUND)
pits.append([round(bx(start + 0.1), 1), round(bx(tl - 0.15), 1)])
t = tl

# 99.4-135.7: everything mixed, 8-bar phrases.
checkpoint(max(t + 0.4, 100.0), 'mix')
t = nearest_beat(max(t + 1.2, 100.8))
while t < 129:
    nb = [b for b in BEATS if b >= t]
    gap(nb[0])
    gap(nb[2], 1.0)
    babushka(nb[5])
    babushka(nb[7], 'big')
    t = jelly_chain(nb[10], 3, [GROUND - 40, GROUND - 20, GROUND - 46])
    nb = [b for b in BEATS if b > t + 0.4]
    if nb[0] < 132:
        t = tramp(nb[1])
        nb = [b for b in BEATS if b > t + 0.4]
    t = nb[2]

# 135.7-144.5: the melodic bridge. Catch the notes.
checkpoint(136.0, 'bridge')
melody_coins(136.2, 144.2, 0.13)
for b in B(138.0, 144.0)[::8]:
    babushka(b, 'sleep')

# 144.5-165.8: finale, denser.
checkpoint(144.8, 'finale')
fb = B(145.3, 164.6)
i = 0
while i < len(fb) - 12:
    k = (i // 16) % 2
    gap(fb[i])
    babushka(fb[i + 2])
    gap(fb[i + 4], 1.0)
    if k:
        t = jelly_chain(fb[i + 6], 2, [GROUND - 40, GROUND - 24])
        i = next(j for j, b in enumerate(fb) if b > t + 0.4) + 1
    else:
        babushka(fb[i + 6], 'big')
        tramp(fb[i + 9])
        i += 13

# Outro: run home, coins on the last notes, finish line.
checkpoint(166.0, 'outro')
melody_coins(166.2, 169.0, 0.12)

# drop coins that ended up inside pits at ground height or overlapping each other
pits.sort()
level['coins'] = sorted({(round(x), round(y)) for x, y in coins})
level['plan'].sort()
for k in ('babushkas', 'jellies', 'tramps'):
    level[k].sort(key=lambda o: o['x'])

# sanity: no checkpoint inside a pit, no babushka over a pit
def unsafe(x):
    return any(a - 40 <= x <= b + 50 for a, b in pits) or any(o['x'] - 90 <= x <= o['x'] + 30 for o in level['babushkas']) \
        or any(abs(o['x'] - x) < 40 for o in level['tramps'])


for c in level['checkpoints']:
    t = c['t']
    while unsafe(bx(t)):
        t += 0.02
    c['t'], c['x'] = round(t, 3), round(bx(t), 1)
level['babushkas'] = [o for o in level['babushkas'] if not any(a - 12 <= o['x'] <= b + 12 for a, b in pits)]

print(json.dumps(level, separators=(',', ':')))
print(f"pits {len(pits)} jellies {len(level['jellies'])} tramps {len(level['tramps'])} babushkas {len(level['babushkas'])} coins {len(level['coins'])} cues {len(plan)}", file=sys.stderr)
