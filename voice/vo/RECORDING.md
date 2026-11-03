# Recording the voice-over yourselves

The narration lines in the game are PLACEHOLDERS spoken by a computer voice. Chris, Martin or Marius can record the real thing.
It works file by file, with no code change: if `voice/vo/real/<id>.m4a` exists the game plays that file instead of the computer voice.
Lines you have not recorded keep the computer voice, so you can swap them in over several evenings.

## 1. What to say

Open `voice/vo/script_for_recording.html` (print it, or read it on a second screen). It lists every line per person:
the **id** is the file name, then the words, the mood, and when it plays in the game.
The words come from `data/voiceover.json`. If you want to change a line, edit it there first (and run `python3 build/make_vo.py`
so the computer voice and the subtitle timing are redone). Chris's lines are Chris's, Martin's are Martin's.

Tips: thinking out loud, not performing. Close to the microphone, quiet and a little dry, as if only you can hear it.
A tiny pause before and after each line. If you flub it, record the line again; one clean take per file.

## 2. File names

`voice/vo/real/<id>.m4a`

Examples: `voice/vo/real/c_tree.m4a` (Chris at the tree), `voice/vo/real/m_bowl.m4a` (Martin at Bowlinghallen), `voice/vo/real/c_m12.m4a` (Chris on the morning of 12 December).
The id is exactly the one in the script. Lines marked `both` in the data file get two files: `<id>_chris.m4a` and `<id>_martin.m4a`.
Make the folder `voice/vo/real/` yourself the first time.

## 3. Format

- m4a (AAC), **mono**, 44.1 or 48 kHz, about 64 kbps is plenty
- speech level around **-16 LUFS** (normal "podcast" loudness). The game also levels every file by itself, so this does not need to be perfect.
- trim long silences at the start and end (a quarter of a second is fine)

### Convert on a Mac (no extra software)

Record anything (Voice Memos, QuickTime, GarageBand, a phone). Then in Terminal, from the `neset-xl` folder:

```
afconvert -f m4af -d aac -b 64000 -c 1 mytake.wav voice/vo/real/c_tree.m4a
```

Works for .wav, .m4a, .caf, .aif and .mp3 input. For a whole folder of takes named by id:

```
mkdir -p voice/vo/real
for f in takes/*.wav; do afconvert -f m4af -d aac -b 64000 -c 1 "$f" "voice/vo/real/$(basename "${f%.*}").m4a"; done
```

### Convert with ffmpeg (if you have it)

```
ffmpeg -i mytake.wav -af "loudnorm=I=-16:TP=-1.5:LRA=7,silenceremove=start_periods=1:start_threshold=-50dB" -ac 1 -c:a aac -b:a 64k voice/vo/real/c_tree.m4a
```

## 4. Subtitles

The subtitles light up word by word. For the computer voice the timing is exact; for your recordings the game spreads the words
over the spoken part of the file by itself (it ignores the silence at the start and end), so nothing else is needed.

## 5. Checking it

Open the game with `?as=chris&day=1` (or `?as=martin`), start, then in the browser console type: `__VO.say('c_tree', true)` to hear that line right away.
If the real file cannot be read (wrong format, empty file) the game quietly falls back to the computer voice.

## 6. Publishing

`build/deploy.sh` copies `voice/vo/` (including `voice/vo/real/`) and `data/voiceover.json` to the website.
