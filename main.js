var ppq = 120;
var bpm = 110;
var tickRate = 60000 / (bpm * ppq);
var lastTick = 0;
var playing = false
var recording = false
var step = 0;
var noteOn = {};
var noteOff = {};
var outputs = []

var synth = new Tone.PolySynth(Tone.Synth).toDestination();

fakeOutput = {
    "name": "fakeOutput",
}

fakeOutput.playNote = function(note_name, channel) {
    synth.triggerAttack(note_name,  Tone.now())
}

fakeOutput.stopNote = function(note_name, channel) {
    synth.triggerRelease(note_name,  Tone.now())
}

function start() {
    Tone.start();
}

function tick() {
    if (!playing) {
        return
    }
    if (typeof noteOn[step] !== "undefined") {
        noteOn[step].forEach(function (note) {
            outputs[1].playNote(note, 1);
        })
    }
    if (typeof noteOff[step] !== "undefined") {
        noteOff[step].forEach(function (note) {
            outputs[1].stopNote(note, 1);
        })
    }
    if (lastTick === 0) {
        lastTick = performance.now();
    }
    step++
    step_display.innerText = step
    var offset = (performance.now() - lastTick) - tickRate
    setTimeout(tick, tickRate - offset)
    lastTick = performance.now();
}

function play() {
    if (!playing) {
        playing = true
        tick()
    }
}

function stop() {
    playing = false
    step = 0
    lastTick = 0
}

function record() {
    recording = true
}

function stopRecording() {
    recording = false
}

function getOutputs() {
    return WebMidi.outputs.concat([fakeOutput]);
}

WebMidi.enable((err) => {
    console.log(getOutputs());
    console.log(WebMidi.inputs);

    WebMidi.inputs[0].addListener("noteon", "all", function (event) {
        if (playing && recording) {
            if (typeof noteOn[step] == "undefined") {
                noteOn[step] = []
            }
            noteOn[step].push(event.note.name + event.note.octave)
        }
        getOutputs()[1].playNote(event.note.name + event.note.octave, event.channel);
    });
    WebMidi.inputs[0].addListener("noteoff", "all", function (event) {
        if (playing && recording) {
            if (typeof noteOff[step] == "undefined") {
                noteOff[step] = []
            }
            noteOff[step].push(event.note.name + event.note.octave)
        }
        getOutputs()[1].stopNote(event.note.name + event.note.octave, event.channel);
    });
});
