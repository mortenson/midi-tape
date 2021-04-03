var ppq = 120;
var bpm = 110;
var lastTick = 0;
var playing = false
var recording = true
var quantize = false
var step = 0;
var currentTrack = 0;
var inputDevice = 0;
var midiReady = false;
var startMarker = 0;
var endMarker = 0;
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
    if (endMarker !== 0 && endMarker <= step) {
        step = startMarker;
    }
    updateTimeline();
}

function updateTimeline() {
    document.getElementById("timeline").style = "margin-left: calc(50% - " + getStepPixelPosition(step) + "px);"
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
    step = startMarker
    lastTick = 0
    getOutputs().forEach(function (output) {
        output.stopNote("all");
    });
    updateTimeline();
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

function quantizeStep(setStep, multiple, mode) {
    ceil = Math.ceil(setStep/multiple) * multiple;
    floor = Math.floor(setStep/multiple) * multiple;
    if (mode === "ceil") {
       return ceil;
    } else if (mode === "floor") {
        return floor;
    } else {
        return Math.abs(setStep - ceil) < Math.abs(setStep - floor) ? ceil : floor;
    }
}

function onNoteOn(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
    if (playing && recording) {
        setStep = step;
        if (quantize) {
            setStep = quantizeStep(setStep, ppq / 2)
        }
        if (typeof trackData[currentTrack].noteOn[setStep] == "undefined") {
            trackData[currentTrack].noteOn[setStep] = []
        }
        trackData[currentTrack].noteOn[setStep].push(event.note.name + event.note.octave)
        updateSegments();
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
            newStep = quantizeStep(setStep, ppq / 2)
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
        updateSegments();
    }
    getOutputs()[trackData[currentTrack].outputDevice].stopNote(event.note.name + event.note.octave, trackData[currentTrack].outputChannel);
}

function onPitchBend(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
    if (playing && recording) {
        trackData[currentTrack].pitchbend[step] = event.value
        updateSegments();
    }
    getOutputs()[trackData[currentTrack].outputDevice].sendPitchBend(event.value, trackData[currentTrack].outputChannel);
}

WebMidi.enable((err) => {
    midiReady = true;
    updateUI();
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

function getStepPixelPosition(step) {
    bar_width = 100;
    pixel_per_note = bar_width / 4;
    return (step/ppq) * pixel_per_note
}

function updateUI() {
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
    if (startMarker > 0) {
        document.getElementById("timeline-start-marker").style = `left: ${getStepPixelPosition(startMarker)}px; display: block;`;
    } else {
        document.getElementById("timeline-start-marker").style = "";
    }
    if (endMarker > 0) {
        document.getElementById("timeline-end-marker").style = `left: ${getStepPixelPosition(endMarker)}px; display: block;`;
    } else {
        document.getElementById("timeline-end-marker").style = "";
    }
}

function updateSegments() {
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
            left = getStepPixelPosition(segment.firstStep)
            width = getStepPixelPosition(segment.lastStep) - left
            segmentElem.style = `left: ${left}}px; width: ${width}px`;
            document.getElementById(`track_${track_number}`).append(segmentElem);
        });
    });
}

function addStartMarker() {
    if (startMarker === step) {
        startMarker = 0;
        endMarker = 0;
    } else {
        startMarker = step;
    }
    if (startMarker > endMarker) {
        endMarker = 0;
    }
}

function addEndMarker() {
    if (endMarker === step) {
        endMarker = 0;
    } else if (startMarker < step) {
        endMarker = step;
    }
}

var keysPressed = {};
var arrowTrackChange = false;
var trackKey = false;

document.addEventListener('keydown', (event) => {
    if (!midiReady) {
        return;
    }
    keysPressed[event.key] = true;
    switch (event.key) {
        case "ArrowRight":
            if (trackKey === false && !playing) {
                if ("Shift" in keysPressed) {
                    step += 1
                    step = quantizeStep(step, ppq * 4, "ceil")
                } else {
                    step += 10;
                }
                updateTimeline();
            }
            break;
        case "ArrowLeft":
            if (trackKey === false && !playing) {
                if ("Shift" in keysPressed) {
                    step -= 1
                    step = quantizeStep(step, ppq * 4, "floor")
                } else {
                    step -= 10;
                }
                if (step < 0) {
                    step = 0;
                }
                updateTimeline();
            }
            break;
    }
});

document.addEventListener('keyup', function(event) {
    if (!midiReady) {
        return;
    }
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
                arrowTrackChange = true;
            }
            break;
        case "ArrowDown":
            if (trackKey !== false) {
                trackData[trackKey].outputDevice--
                if (trackData[trackKey].outputDevice < 0) {
                    trackData[trackKey].outputDevice = getOutputs().length-1
                }
                arrowTrackChange = true;
            }
            break;
        case "ArrowRight":
            if (trackKey !== false) {
                trackData[trackKey].outputChannel++
                if (trackData[trackKey].outputChannel > 16) {
                    trackData[trackKey].outputChannel = 1
                }
                arrowTrackChange = true;
            }
            break;
        case "ArrowLeft":
            if (trackKey !== false) {
                trackData[trackKey].outputChannel--
                if (trackData[trackKey].outputChannel <= 0) {
                    trackData[trackKey].outputChannel = 16
                }
                arrowTrackChange = true;
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
            if (!arrowTrackChange) {
                changeTrack(parseInt(event.key)-1);
            }
            arrowTrackChange = false;
            break;
        case "t":
            addStartMarker();
            break;
        case "y":
            addEndMarker();
            break;    
    }
    updateUI();
});
