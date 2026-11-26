"""Level 2, "Adulthood": stage set-up puzzle (keys last, then the song starts), then spotlight moments.

Input: the six Demucs stems (htdemucs_6s) of the master and the beat grid.
  python3 scripts/game/level_adulthood.py <stems dir> <beats.json> > public/game/levels/adulthood.json
Entry times below were measured on the stems (see README); cues and stage disasters are placed from the stem energy.
"""
import json, sys
import numpy as np
import soundfile as sf

STEMS = ['piano', 'drums', 'vocals', 'guitar', 'bass', 'other']
HOP = 0.25

# who plays what, in the order the song brings them in (Monia, 2026-11-26), with the measured entry (s)
MUSICIANS = [
    # id, instrument, stems this musician owns, entry
    ('tijl', 'keys', ['piano'], 0.0),
    ('tomas', 'perc', ['drums'], 12.0),
    ('sam', 'gtr2', ['vocals', 'guitar'], 16.0),
    ('wim', 'drums', ['drums'], 28.0),
    ('simon', 'bass', ['bass'], 31.0),
    ('corentin', 'sax', ['other'], 37.5),
    ('hans', 'gtr1', ['guitar'], 38.0),
    ('yorick', 'vox', ['vocals'], 42.0),
]
BIG = [  # (time, musician, animation): the big moments of the song
    (153.0, 'yorick', 'stagedive'),
    (224.0, 'simon', 'moshpit'),
    (238.5, 'tijl', 'skydive'),
    (262.0, 'wim', 'skydive'),
]
DISASTERS = [(96.0, 'cable'), (132.0, 'fan'), (186.0, 'cable'), (208.0, 'fan')]
SMALL_ANIMS = ['jump', 'spin', 'headbang', 'slide', 'levitate', 'wiggle']


def envelopes(d):
    out = {}
    for n in STEMS:
        y, sr = sf.read(f'{d}/{n}.wav')
        y = y.mean(1); h = int(sr * HOP); k = len(y) // h
        out[n] = 20 * np.log10(np.sqrt((y[:k * h].reshape(k, h) ** 2).mean(1)) + 1e-9)
    return out


def main():
    env = envelopes(sys.argv[1])
    bj = json.load(open(sys.argv[2]))
    beats = bj['beats']
    bpm = 60 / float(np.median(np.diff(beats)))
    dur = round(len(env['piano']) * HOP, 2)
    snap = lambda t: min(beats, key=lambda b: abs(b - t)) if t > 0.5 else 0.0
    mus = [{'id': i, 'instr': ins, 'stems': st, 'entry': round(snap(e), 3)} for i, ins, st, e in MUSICIANS]
    owners = {n: [m['id'] for m in mus if n in m['stems']] for n in STEMS}
    rel = {n: env[n] - np.median(env[n][int(45 / HOP):]) for n in STEMS}

    # Monia 2026-11-26: the stage is set up before the song, so cues run from the start; one every bar,
    # and in loud parts sometimes a burst of three on consecutive beats (different musicians)
    cues, last, rr = [], None, {n: 0 for n in STEMS}
    bar = 4 * 60 / bpm
    beat = 60 / bpm
    t = 3.0
    big_t = [b[0] for b in BIG]
    rng = np.random.default_rng(7)
    loud = np.mean([rel[n] for n in STEMS], axis=0)
    loud_thr = np.percentile(loud[int(10 / HOP):], 60)

    def pick(s, avoid):
        order = sorted(STEMS, key=lambda n: -rel[n][s].mean())
        for n in order:
            if env[n][s].mean() < -45: continue
            cands = owners[n]
            for k in range(len(cands)):
                c = cands[(rr[n] + k) % len(cands)]
                if c not in avoid:
                    rr[n] += 1; return c
        return None

    nbar = 0
    while t < dur - 8:
        tb = snap(t)
        if any(abs(tb - b) < bar * 1.5 for b in big_t):
            t += bar; continue
        s = slice(int(tb / HOP), int((tb + bar) / HOP))
        burst = nbar % 3 == 2 and loud[s].mean() > loud_thr
        n_cues = 3 if burst else 1
        avoid = [last]
        for k in range(n_cues):
            ck = snap(tb + k * beat)
            who = pick(slice(int(ck / HOP), int((ck + bar) / HOP)), avoid)
            if not who: break
            cues.append({'t': round(ck, 3), 'who': who, 'big': False, 'anim': SMALL_ANIMS[int(rng.integers(len(SMALL_ANIMS)))]})
            avoid.append(who); last = who
        nbar += 1
        t += bar
    for bt, who, anim in BIG:
        cues.append({'t': round(snap(bt), 3), 'who': who, 'big': True, 'anim': anim})
    cues.sort(key=lambda c: c['t'])
    disasters = []
    for dt, kind in DISASTERS:
        disasters.append({'t': round(snap(dt), 3), 'kind': kind, 'who': MUSICIANS[int(rng.integers(len(MUSICIANS)))][0]})

    level = {
        'title': 'Adulthood',
        'song': {'duration': dur, 'bpm': round(bpm, 2), 'beats': beats,
                 'stems': {n: f'/game/audio/adulthood/{n}.mp3' for n in STEMS}},
        'musicians': mus,
        'cues': cues,
        'disasters': disasters,
        # "magic and wonder" statement on the backdrop (first sung at 0:42, Monia 2026-11-26)
        'statement': {'t': 42.0, 'text': 'MAGIC AND WONDER'},
    }
    json.dump(level, sys.stdout, separators=(',', ':'))


main()
