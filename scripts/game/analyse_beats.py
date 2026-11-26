import sys
import librosa, numpy as np, json
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
print('tempo', tempo, 'nbeats', len(beats), beats[:12])
d = np.diff(beats); print('beat interval median', np.median(d), 'std', d.std())
on = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=False)
print('onsets', len(on))
# energy per second
rms = librosa.feature.rms(y=y, hop_length=sr//2)[0]
print('rms per 0.5s:', ' '.join(f'{v:.2f}' for v in rms))
# harmonic/percussive
H, P = librosa.effects.hpss(y)
hr = librosa.feature.rms(y=H, hop_length=sr)[0]; pr = librosa.feature.rms(y=P, hop_length=sr)[0]
print('harm/perc per s:', ' '.join(f'{a/(b+1e-6):.1f}' for a,b in zip(hr,pr)))
json.dump({'tempo':float(np.atleast_1d(tempo)[0]),'beats':[round(float(b),3) for b in beats],'onsets':[round(float(o),3) for o in on]}, open(sys.argv[2],'w'))
