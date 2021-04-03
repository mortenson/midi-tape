var ppq = 120;
var bpm = 110;
var lastTick = 0;
var playing = false
var recording = false
var quantize = false
var step = 0;
var currentTrack = 0;
var inputDevice = 0;
var trackData = [
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
    },
];
var outputs = [];
var metronome = true;

var pitchShifter = new Tone.PitchShift(0).toDestination();
var synth = new Tone.PolySynth(Tone.Synth).toDestination();
synth.connect(pitchShifter);
var metronome_synth = new Tone.Synth().toDestination();

fakeOutput = {
    "name": "Fake Synth",
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

fakeOutput.sendPitchBend = function(value, channel) {
    pitchShifter.pitch = value
}

function start() {
    Tone.start();
    document.getElementById("start_button").remove();
}

function tick() {
    if (!playing) {
        return
    }
    trackData.forEach(function (track) {
        if (typeof track.noteOn[step] !== "undefined") {
            track.noteOn[step].forEach(function (note) {
                getOutputs()[track.outputDevice].playNote(note, track.outputChannel);
            })
        }
        if (typeof track.noteOff[step] !== "undefined") {
            track.noteOff[step].forEach(function (note) {
                getOutputs()[track.outputDevice].stopNote(note, track.outputChannel);
            })
        }
        if (typeof track.pitchbend[step] !== "undefined") {
            getOutputs()[track.outputDevice].sendPitchBend(track.pitchbend[step], track.outputChannel)
        }
    });
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
    document.getElementById('step-display').innerText = step
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

function onNoteOn(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
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
    getOutputs()[trackData[currentTrack].outputDevice].playNote(event.note.name + event.note.octave, trackData[currentTrack].outputChannel);
}

function onNoteOff(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
    if (playing && recording) {
        setStep = step;
        if (quantize) {
            newStep = quantizeStep(setStep)
            // Prevent notes from being cut off by having the same start+end time.
            if (newStep < setStep) {
                newStep += (ppq / 2);
            }
            setStep = newStep
        }
        if (typeof trackData[currentTrack].noteOff[setStep] == "undefined") {
            trackData[currentTrack].noteOff[setStep] = []
        }
        trackData[currentTrack].noteOff[setStep].push(event.note.name + event.note.octave)
    }
    getOutputs()[trackData[currentTrack].outputDevice].stopNote(event.note.name + event.note.octave, trackData[currentTrack].outputChannel);
}

function onPitchBend(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
    trackData[currentTrack].pitchbend[step] = event.value
    getOutputs()[trackData[currentTrack].outputDevice].sendPitchBend(event.value, trackData[currentTrack].outputChannel);
}

WebMidi.enable((err) => {
    WebMidi.inputs.forEach(function (input, key) {
        input.addListener("noteon", "all", onNoteOn);
        input.addListener("noteoff", "all", onNoteOff);
        input.addListener("pitchbend", "all", onPitchBend);
    });
});

var timer = new Worker('timer.js');
timer.onmessage = function(e) {
    tick();
}

setInterval(function () {
    document.body.classList = recording ? "recording" : "";
    document.getElementById("playing").innerText = playing ? "Playing" : "Paused";
    document.getElementById("recording").innerText = recording ? "Recording" : "Not recording";
    document.getElementById("metronome").innerText = metronome ? "Metronome on" : "Metronome off";
    document.getElementById("quantized").innerText = quantize ? "Quantization on" : "Quantization off";
    document.getElementById("current-track").innerText = `Current track: ${currentTrack+1}`;
    trackData.forEach(function (track, index) {
        document.getElementById(`track_${index}`).classList = index === currentTrack ? 'track current-track' : 'track';
        document.getElementById(`output-device-${index}`).innerText = `Track ${index+1} device: ${getOutputs()[track.outputDevice].name} (${track.outputChannel})`
    });
    document.getElementById("input-device").innerText = `Input device: ${WebMidi.inputs[inputDevice].name}`
}, 100);

setInterval(function () {
    trackData.forEach(function (track, track_number) {
        document.getElementById(`track_${track_number}`).innerHTML = "";
        var segments = [];
        for (var i of Object.keys(track.noteOn).map(Number).sort((a, b) => a - b)) {
            for (var j of Object.keys(track.noteOff).map(Number).sort((a, b) => a - b)) {
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
}, 500);

var keysPressed = {};

document.addEventListener('keydown', (event) => {
    keysPressed[event.key] = true;
});

document.addEventListener('keyup', function(event) {
    delete keysPressed[event.key];
    trackKey = false;
    if ("1" in keysPressed) {
        trackKey = 0;
    } else if ("2" in keysPressed) {
        trackKey = 1;
    } else if ("3" in keysPressed) {
        trackKey = 2;
    } else if ("4" in keysPressed) {
        trackKey = 3;
    }
    switch (event.key) {
        case "ArrowUp":
            if (trackKey !== false) {
                trackData[trackKey].outputDevice++
                if (trackData[trackKey].outputDevice >= getOutputs().length) {
                    trackData[trackKey].outputDevice = 0
                }
            }
            break;
        case "ArrowDown":
            if (trackKey !== false) {
                trackData[trackKey].outputDevice--
                if (trackData[trackKey].outputDevice < 0) {
                    trackData[trackKey].outputDevice = getOutputs().length-1
                }
            }
            break;
        case "ArrowRight":
            if (trackKey !== false) {
                trackData[trackKey].outputChannel++
                if (trackData[trackKey].outputChannel > 16) {
                    trackData[trackKey].outputChannel = 1
                }
            }
            break;
        case "ArrowLeft":
            if (trackKey !== false) {
                trackData[trackKey].outputChannel--
                if (trackData[trackKey].outputChannel <= 0) {
                    trackData[trackKey].outputChannel = 16
                }
            }
            break;
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
        case "1":
        case "2":
        case "3":
        case "4":
            if (true) {
                changeTrack(parseInt(event.key)-1);
            }
            break;
    }
});
