import sys
import librosa, numpy as np, json
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
d=json.load(open(sys.argv[2])); beats=np.array(d['beats'])
hop=512
H,P=librosa.effects.hpss(y)
chroma=librosa.feature.chroma_cqt(y=H,sr=sr,hop_length=hop)
mf=librosa.feature.mfcc(y=y,sr=sr,hop_length=hop,n_mfcc=13)
bf=librosa.time_to_frames(beats,sr=sr,hop_length=hop)
X=np.vstack([librosa.util.sync(chroma,bf),librosa.util.sync(mf,bf)/50])
b=librosa.segment.agglomerative(X,14)
bt=librosa.frames_to_time(bf[np.clip(b,0,len(bf)-1)],sr=sr,hop_length=hop)
print('segments', np.round(bt,2))
# percussive onset strength at beats
po=librosa.onset.onset_strength(y=P,sr=sr,hop_length=hop)
ho=librosa.onset.onset_strength(y=H,sr=sr,hop_length=hop)
pt=librosa.times_like(po,sr=sr,hop_length=hop)
# strong percussive accents
pk=librosa.util.peak_pick(po,pre_max=6,post_max=6,pre_avg=20,post_avg=20,delta=po.std()*1.5,wait=8)
hk=librosa.util.peak_pick(ho,pre_max=4,post_max=4,pre_avg=15,post_avg=15,delta=ho.std()*1.0,wait=5)
print('perc accents',len(pk),'harm onsets',len(hk))
# pitch of melody (pyin on H, limited range)
f0,vf,vp=librosa.pyin(H,fmin=200,fmax=1400,sr=sr,hop_length=hop*2)
ft=librosa.times_like(f0,sr=sr,hop_length=hop*2)
mel=[[round(float(t),3),round(float(librosa.hz_to_midi(f)),1)] for t,f,v in zip(ft,f0,vf) if v and not np.isnan(f)]
print('voiced frames',len(mel))
rms=librosa.feature.rms(y=y,hop_length=hop)[0]
json.dump({'tempo':d['tempo'],'beats':d['beats'],'segments':[round(float(x),2) for x in bt],
 'perc':[round(float(pt[i]),3) for i in pk],'perc_s':[round(float(po[i]),2) for i in pk],
 'harm':[round(float(pt[i]),3) for i in hk],'mel':mel,
 'rms':[round(float(rms[i]),3) for i in range(0,len(rms),4)],'rms_dt':hop*4/sr},open(sys.argv[3],'w'))
