var ppq = 120;
var bpm = 110;
var lastTick = 0;
var playing = false
var recording = false
var step = 0;
var noteOn = {};
var noteOff = {};
var outputs = [];
var metronome = true;

var synth = new Tone.PolySynth(Tone.Synth).toDestination();
var metronome_synth = new Tone.Synth().toDestination();

fakeOutput = {
    "name": "fakeOutput",
}

fakeOutput.playNote = function(note_name, channel) {
    synth.triggerAttack(note_name,  Tone.now())
}

fakeOutput.stopNote = function(note_name, channel) {
    if (note_name === "all") {
        synth.releaseAll();
    } else {
        synth.triggerRelease(note_name,  Tone.now())
    }
}

function start() {
    Tone.start();
    document.getElementById("start_button").remove();
}

function tick() {
    if (!playing) {
        return
    }
    if (typeof noteOn[step] !== "undefined") {
        noteOn[step].forEach(function (note) {
            getOutputs()[1].playNote(note, 1);
        })
    }
    if (typeof noteOff[step] !== "undefined") {
        noteOff[step].forEach(function (note) {
            getOutputs()[1].stopNote(note, 1);
        })
    }
    if (metronome) {
        if (step % (ppq*4) === 0) {
            metronome_synth.triggerAttackRelease("C4", .1);
        } else if (step % ppq === 0) {
            metronome_synth.triggerAttackRelease("C3", .1);
        }
    }
    if (lastTick === 0) {
        lastTick = performance.now();
    }
    step++
    bar_width = 100;
    pixel_per_note = bar_width / 4;
    quarter_notes = step/ppq;
    progress = quarter_notes * pixel_per_note;
    document.getElementById("timeline").style = "margin-left: calc(50% - " + progress + "px);"
    step_display.innerText = step
}

function play() {
    if (!playing) {
        playing = true
    }
}

function stop() {
    playing = false
    step = 0
    lastTick = 0
    getOutputs().forEach(function (output) {
        output.stopNote("all");
    });
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

var timer = new Worker('timer.js');
timer.onmessage = function(e) {
    tick();
}


setInterval(function () {
    document.getElementById("track_1").innerHTML = "";
    var segments = [];
    for (var i in noteOn) {
        for (var j in noteOff) {
            if (j < i) {
                continue;
            }
            sharedNotes = noteOn[i].filter(note => noteOff[j].includes(note));
            if (sharedNotes.length > 0) {
                segments.push({
                    firstStep: i,
                    lastStep: j,
                });
                break;
            }
        }
    }
    segments.forEach(function (segment) {
        var segmentElem = document.createElement("div");
        segmentElem.classList = "timeline-segment";
        bar_width = 100;
        pixel_per_note = bar_width / 4;
        left = (segment.firstStep/ppq) * pixel_per_note
        width = ((segment.lastStep/ppq) * pixel_per_note) - left
        segmentElem.style = `left: ${left}px; width: ${width}px`;
        document.getElementById("track_1").append(segmentElem);
    });
}, 1000);
