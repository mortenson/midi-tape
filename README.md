# midi-tape

A tape mode style recorder for external MIDI devices, created using Web MIDI.

I made this as an alternative to using a DAW, for situations where you want to
control a few external MIDI devices to make quick songs.

## User guide

midi-tape is a 4-track tape mode style recorder that takes input from one MIDI
device (ex: a MIDI keyboard), and outputs that recording to other MIDI devices
and channels.

You can use this to create songs in a more linear, free-form way than with a
traditional DAW or MIDI sequencer.

Web MIDI isn't supported in many browsers, so please use the latest Chrome and
do not switch tabs while recording.

### Controls

All user input is done through the keyboard to make usage with a smaller
external device (ex: remapped numpad) possible.

- `p` - Play/pause
- `P (shift+p)` - Stop
- `r` - Toggle recording
- `R (shift+r)` - Toggle replace recording
- `m` - Toggle metronome
- `m + up/down` - Change beats per minute
- `m + left/right` - Change beats per bar
- `M (shift+m)` - Toggle count-in
- `1-9/0` - Change track
- `1-9/0 + up/down` - Change output device
- `1-9/0 + left/right` - Change output channel
- `1-9/0 + delete` - Delete track
- `i + up/down` - Change input device
- `up/down` - Change track
- `left/right` - Move tape
- `shift + left/right` - Move tape to next/previous bar
- `t` - Add/clear start point
- `y` - Add/clear end point
- `backspace/delete` - Deletes everything between start/end points
- `shift + backspace/delete` - Deletes pitch bends and control changes between
start/end points
- `v` - Pastes the current track's data between start/end points to current
point
- `V (shift+v)` - Pastes all track data between start/end points to current point
- `i + p` - Plays the timeline and tells the input device to play. Useful for
recording drum machines.
- `u` - Undo (for track deletion, note deletion, recording sessions, and paste)
- `U (shift+u)` - Redo
- `q` - Toggle quantization
- `q + up/down` - Change quantization level

If you need more than 10 tracks, use the "o" key instead of the numerical keys:

- `O (shift+o)` - Add a track
- `o + delete` - Delete current track
- `o + up/down` - Change output device
- `o + left/right` - Change output channel

### The timeline

The timeline displays all notes, pitch bends, and control changes for each
track.

Notes in the current track are green, pitch bends are purple, and control
changes are cyan. When recording, the current track's content will turn red.

The start point, if placed, is turquoise, and the end point if placed is
yellow. You can use start/end points to work on loops in your song - when the
end point is reached, the tape will automatically loop back to the start
point. When you're happy with your loop, you can paste it to the next bar(s).
If not you can delete it to start over.

Per the above control guide, you move around the timeline using arrow keys, and
can hold shift to jump from bar to bar. Most of your time with midi-tape will
be spent moving on the timeline, changing start/end points, and changing
tracks.

### Saving/loading

By default the current tape is saved to persistent browser storage often to
prevent data loss between sessions.

To save your work long-term, click the "Save" button at the bottom of the
screen. This will save the tape as JSON, which you can then load back into
midi-tape when needed.

### Using dummy devices

To avoid errors and allow for easier testing of the tool, dummy/fake input and
output devices are provided for you. The "Dummy Synth" uses Tone.js and
supports polyphony and pitch changes. The "Dummy Keyboard" allow you to play
a C major scale using the keys a, s, d, f, g, h, and j. The k and l keys move
the octave up and down.

Note that these are not meant to be useful for real recording scenarios, so
their functionality will always be limited.

### Monitoring and recording audio

Since it can be a bit difficult to monitor the output of your synths while
listening to midi-tape's metronome, you can click "Monitor Audio" and have your
browser's default input played through the default output. This is also useful
for quick jam sessions without opening a DAW or using something like JACK.

While monitoring, you can click "Record Audio", which will lock keyboard
controls, go to the start of the tape, and play it through while recording
everything that's monitored. Once finished, .webm file will be downloaded. I
would have preferred .wav, but the browser APIs for this are pretty limited.

### Exporting a MIDI file

If you're finished recording but want to edit some of the MIDI manually, you
can click "Export MIDI" to download your tape as a .mid file.

Note that this is a one-way operation, you cannot import MIDI files as parsing
them accurately given midi-tape's limited feature set could result in data
loss.

### Notes

- Your input device's MIDI channel is ignored, to keep the idea that one track is
one MIDI output device + one channel.
- A MIDI clock is sent to all outputs every quarter note.
- Since it's JavaScript, the BPM is likely always a little off.
- The tape runs at a resolution of 24 PPQ. Higher PPQ values make the tape run
inconsistently.
- Replacing is destructive (just like a real tape) - use it wisely!

## Development

midi-tape is built using vanilla JavaScript, and is intended to be used in
modern browsers with Web MIDI support (basically latest Chrome).

I built this over a weekend, and would like to maintain it minimally going
forward. Please do not refactor the entire codebase, and instead add small
sensible features if needed.

To start a local dev server, run `npm start`.

To format code, run `npm run prettier`.

To update copies of vendor libraries, run `npm run build-assets`.
