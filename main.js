var ppq = 120;
var bpm = 110;
var lastTick = 0;
var playing = false
var recording = false
var quantize = false
var step = 0;
var currentTrack = 0;
var trackData = [
    {
        noteOn: {},
        noteOff: {},
    },
    {
        noteOn: {},
        noteOff: {},
    },
    {
        noteOn: {},
        noteOff: {},
    },
    {
        noteOn: {},
        noteOff: {},
    },
];
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
    if (typeof trackData[currentTrack].noteOn[step] !== "undefined") {
        trackData[currentTrack].noteOn[step].forEach(function (note) {
            getOutputs()[1].playNote(note, 1);
        })
    }
    if (typeof trackData[currentTrack].noteOff[step] !== "undefined") {
        trackData[currentTrack].noteOff[step].forEach(function (note) {
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

function togglePlay() {
    playing = !playing
    lastTick = 0;
    getOutputs().forEach(function (output) {
        output.stopNote("all");
    });
}

function toggleQuantize() {
    quantize = !quantize;
}

function toggleMetronome() {
    metronome = !metronome;
}

function stop() {
    playing = false
    step = 0
    lastTick = 0
    getOutputs().forEach(function (output) {
        output.stopNote("all");
    });
    document.getElementById("timeline").style = "margin-left: calc(50%);"
}

function toggleRecording() {
    recording = !recording
}

function changeTrack(track_number) {
    currentTrack = track_number;
}

function getOutputs() {
    return WebMidi.outputs.concat([fakeOutput]);
}

function quantizeStep(setStep) {
    multiple = ppq / 2
    newStep = setStep + multiple / 2;
    newStep = newStep - (newStep % multiple);
    return setStep;
}

WebMidi.enable((err) => {
    console.log(getOutputs());
    console.log(WebMidi.inputs);

    WebMidi.inputs[0].addListener("noteon", "all", function (event) {
        if (playing && recording) {
            setStep = step;
            if (quantize) {
                setStep = quantizeStep(setStep)
            }
            if (typeof trackData[currentTrack].noteOn[setStep] == "undefined") {
                trackData[currentTrack].noteOn[setStep] = []
            }
            trackData[currentTrack].noteOn[setStep].push(event.note.name + event.note.octave)
        }
        getOutputs()[1].playNote(event.note.name + event.note.octave, event.channel);
    });
    WebMidi.inputs[0].addListener("noteoff", "all", function (event) {
        if (playing && recording) {
            setStep = step;
            if (quantize) {
                newStep = quantizeStep(setStep)
                // Prevent notes from being cut off by having the same start+end time.
                if (newStep < setStep) {
                    newStep += ppq;
                }
                setStep = newStep
            }
            if (typeof trackData[currentTrack].noteOff[setStep] == "undefined") {
                trackData[currentTrack].noteOff[setStep] = []
            }
            trackData[currentTrack].noteOff[setStep].push(event.note.name + event.note.octave)
        }
        getOutputs()[1].stopNote(event.note.name + event.note.octave, event.channel);
    });
});

var timer = new Worker('timer.js');
timer.onmessage = function(e) {
    tick();
}


setInterval(function () {
    trackData.forEach(function (track, track_number) {
        document.getElementById(`track_${track_number}`).innerHTML = "";
        var segments = [];
        for (var i of Object.keys(track.noteOn).sort()) {
            for (var j of Object.keys(track.noteOff).sort()) {
                if (j < i) {
                    continue;
                }
                sharedNotes = track.noteOn[i].filter(note => track.noteOff[j].includes(note));
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
            document.getElementById(`track_${track_number}`).append(segmentElem);
        });
    });
    document.getElementById("playing").innerText = playing ? "Playing" : "Paused";
    document.getElementById("recording").innerText = recording ? "Recording" : "Not recording";
    document.getElementById("metronome").innerText = metronome ? "Metronome on" : "Metronome off";
    document.getElementById("quantized").innerText = quantize ? "Quantization on" : "Quantization off";
    document.getElementById("current-track").innerText = `Current track: ${currentTrack}`;
}, 500);

document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case "p":
            togglePlay();
            break;
        case "r":
            toggleRecording();
            break;
        case "s":
            stop();
            break;
        case "m":
            toggleMetronome();
            break;
        case "q":
            toggleQuantize();
            break;
        case "0":
        case "1":
        case "2":
        case "3":
            changeTrack(parseInt(event.key));
            break;
    }
});
