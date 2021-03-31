var ppq = 120;
var bpm = 110;
var tickRate = 60000 / (bpm * ppq);
var lastTick = 0;
var playing = false
var recording = false
var step = 0;
var noteOn = {};
var noteOff = {};
function tick() {
    if (!playing) {
        return
    }
    if (typeof noteOn[step] !== "undefined") {
        noteOn[step].forEach(function (note) {
            WebMidi.outputs[1].playNote(note, 1);
        })
    }
    if (typeof noteOff[step] !== "undefined") {
        noteOff[step].forEach(function (note) {
            WebMidi.outputs[1].stopNote(note, 1);
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

WebMidi.enable((err) => {
    console.log(WebMidi.inputs);
    console.log(WebMidi.outputs);

    WebMidi.inputs[0].addListener("noteon", "all", (event) => {
        if (playing && recording) {
            if (typeof noteOn[step] == "undefined") {
                noteOn[step] = []
            }
            noteOn[step].push(event.note.number)
        }
        WebMidi.outputs[1].playNote(event.note.number, event.channel);
    });
    WebMidi.inputs[0].addListener("noteoff", "all", (event) => {
        if (playing && recording) {
            if (typeof noteOff[step] == "undefined") {
                noteOff[step] = []
            }
            noteOff[step].push(event.note.number)
        }
        WebMidi.outputs[1].stopNote(event.note.number, event.channel);
    });
});
