# The game

A rhythm runner at `/game/`: the musician's x position is the song time × `SPEED`, so every obstacle is met on the beat.

- `src/game/engine.ts`: game loop, physics, character select (pixel heads + thug-life glasses), HUD. Character list and eye positions for the glasses are at the top.
- `src/game/art.ts`: pixel-art drawing (babushkas, jellies, pudding trampolines, sky that goes from sun to moon over the song).
- `src/game/texts.ts`: in-game texts in EN/NL/FR.
- `public/game/`: sprites, heads, level JSON, song (MP3).

## Rebuilding the assets

```sh
pip install numpy pillow scipy librosa
# 1. musician poses (green-screen photos of the 2023 photo shoot) -> pixel sprite strips: run A, run B, jump, glide, action
python3 scripts/game/sprites.py "<folder with D18_*.JPG>" public/game/sprites
# 2. rotating heads -> pixel strips for the select screen
python3 scripts/game/heads.py
# 3. song analysis (beats, sections, accents, melody) -> scripts/game/data/balkan-booby-analysis.json
python3 scripts/game/analyse_beats.py song.wav beats.json
python3 scripts/game/analyse_sections.py song.wav beats.json scripts/game/data/balkan-booby-analysis.json
# 4. level layout from the analysis (simulates every jump so all platforms are reachable)
python3 scripts/game/level_balkan_booby.py > public/game/levels/balkan-booby.json
```

Poses per musician are listed in `POSES` in `sprites.py` (photo numbers).

## Testing

`/game/?autoplay&nosound&rate=2&char=hans` lets a bot play the level from the generated input plan; it must reach the finish with 0 falls.
`&from=93` starts at the checkpoint before that time (seconds).

## Level 2: Adulthood (stage puzzle)

`src/game/stage.ts` draws at 960x540 (the canvas switches size when the level starts) in a paper cut-out style.
Phase 1: musicians arrive in random order; each carries only his own instrument from the stacked backline (only the top comes off, two side-table slots) to his spot on the band's stage plan. An instrument is only heard once it is set up.
Phase 2: tap the musician in the shrinking circle on the beat: spotlight + an animation (stage dive, mosh pit, skydive on the big moments). Happy crowd = points and pints (an ice tea for Simon). Two kinds of stage disasters: an unplugged cable and a fan on stage.

```sh
# 1. split the master in six stems with Demucs (htdemucs_6s: drums, bass, other, vocals, guitar, piano)
#    then encode them: ffmpeg -i stems/<name>.wav -ac 1 -b:a 64k public/game/audio/adulthood/<name>.mp3
python3 scripts/game/analyse_beats.py master.wav scripts/game/data/adulthood-beats.json
# 2. level: entries per musician (measured on the stems), spotlight cues, disasters, "MAGIC AND WONDER" at 0:42
python3 scripts/game/level_adulthood.py <stems dir> scripts/game/data/adulthood-beats.json > public/game/levels/adulthood.json
# 3. cartoon caricature heads from the band-page photo heads
python3 scripts/game/toon_heads.py public/images/heads public/game/toon
```

Test: `/game/?level=adulthood&autoplay&nosound&rate=4` plays the whole level with a bot (must end with 8/8 placed).
