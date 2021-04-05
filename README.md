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

### Controls

All user input is done through the keyboard to make usage with a smaller
external device (ex: remapped numpad) possible.

- `p` - Play/pause
- `P (shift+p)` - Stop
- `r` - Toggle recording
- `m` - Toggle metronome
- `M (shift+m)` - Toggle count-in
- `q` - Toggle quantization (locks input to 1/8 notes)
- `1-4` - Change track
- `1-4 + up/down` - Change output device
- `1-4 + left/right` - Change output channel
- `i + up/down` - Change input device
- `up/down` - Change BPM
- `shift + up/down` - Change BPM in increments of 10
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

If building an external controller, you will need 17 inputs.

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

### Notes

- Your input device's MIDI channel is ignored, to keep the idea that one track is
one MIDI output device + one channel.
- A MIDI clock is sent to all outputs every quarter note.
- Since it's JavaScript, the BPM is likely always a little off.
- The tape runs at a resolution of 48 PPQ. Higher PPQ values make the tape
run slow.

## Development

midi-tape is built using vanilla JavaScript, and is intended to be used in
modern browsers with Web MIDI support (basically latest Chrome).

I built this over a weekend, and would like to maintain it minimally going
forward. Please do not refactor the entire codebase, and instead add small
sensible features if needed.

To start a local dev server, run `npm start`.

To format code, run `npm run prettier`.

To update copies of vendor libraries, run `npm run build-assets`.
