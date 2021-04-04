var ppq = 48;
var bpm = 110;
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
        controlchange: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
        controlchange: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
        controlchange: {},
    },
    {
        outputDevice: 1,
        outputChannel: 1,
        noteOn: {},
        noteOff: {},
        pitchbend: {},
        controlchange: {},
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

fakeOutput.playNote = function(note_name, channel, options) {
    velocity = 1
    if ("velocity"in options) {
        velocity = options.velocity
    }
    synth.triggerAttack(note_name, Tone.now(), velocity)
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

fakeOutput.sendControlChange = function(name, value) {}

fakeOutput.sendClock = function () {}

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
            for (var note in track.noteOn[step]) {
                getOutputs()[track.outputDevice].playNote(note, track.outputChannel, {
                    velocity: track.noteOn[step][note],
                });
            }
        }
        if (typeof track.noteOff[step] !== "undefined") {
            track.noteOff[step].forEach(function (note) {
                getOutputs()[track.outputDevice].stopNote(note, track.outputChannel);
            })
        }
        if (typeof track.pitchbend[step] !== "undefined") {
            getOutputs()[track.outputDevice].sendPitchBend(track.pitchbend[step], track.outputChannel)
        }
        if (typeof track.controlchange[step] !== "undefined") {
            for (var name in track.controlchange[step]) {
                getOutputs()[track.outputDevice].sendControlChange(name, track.controlchange[step][name], track.outputChannel);
            }
        }
    });
    if (metronome) {
        if (step % (ppq*4) === 0) {
            metronome_synth.triggerAttackRelease("C4", .1);
        } else if (step % ppq === 0) {
            metronome_synth.triggerAttackRelease("C3", .1);
        }
    }
    step++
    if (endMarker !== 0 && endMarker < step) {
        stopAllNotes();
        step = startMarker;
    }
    if (step % (ppq/24) === 0) {
        getOutputs().forEach(function (output) {
            output.sendClock();
        });
    }
    updateTimeline();
}

function updateTimeline() {
    document.getElementById("timeline").style = "margin-left: calc(50% - " + getStepPixelPosition(step) + "px);"
}

function stopAllNotes() {
    getOutputs().forEach(function (output) {
        output.stopNote("all");
    });
}

function togglePlay() {
    playing = !playing
    stopAllNotes();
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
    stopAllNotes();
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
    if (mode === "ceil") {
       return Math.ceil(setStep/multiple) * multiple;
    } else if (mode === "floor") {
        return Math.floor(setStep/multiple) * multiple;
    } else {
        newStep = setStep + multiple / 2;
        newStep = newStep - (newStep % multiple);
        return newStep;
    }
}

function addTrackData(setStep, property, data) {
    if (Array.isArray(data)) {
        if (typeof trackData[currentTrack][property][setStep] == "undefined") {
            trackData[currentTrack][property][setStep] = []
        }
        trackData[currentTrack][property][setStep] = Array.from(new Set(trackData[currentTrack][property][setStep].concat(data)))
    } else if (typeof data === "object") {
        if (typeof trackData[currentTrack][property][setStep] == "undefined") {
            trackData[currentTrack][property][setStep] = {}
        }
        for (var note in data) {
            trackData[currentTrack][property][setStep][note] = data[note];
        }
    } else {
        trackData[currentTrack][property][setStep] = data
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
        addTrackData(setStep, "noteOn", {[event.note.name + event.note.octave]: event.velocity})
        updateSegments();
    }
    getOutputs()[trackData[currentTrack].outputDevice].playNote(event.note.name + event.note.octave, trackData[currentTrack].outputChannel, {
        velocity: event.velocity,
    });
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
                newStep = quantizeStep(setStep + (ppq/2), ppq / 2)
            }
            setStep = newStep
        }
        addTrackData(setStep, "noteOff", [event.note.name + event.note.octave])
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
    }
    getOutputs()[trackData[currentTrack].outputDevice].sendPitchBend(event.value, trackData[currentTrack].outputChannel);
}

function onControlChange(event) {
    if (WebMidi.inputs[inputDevice].id !== event.target.id) {
        return;
    }
    if (playing && recording) {
        addTrackData(step, "controlchange", {[event.controller.name]: event.value})
    }
    getOutputs()[trackData[currentTrack].outputDevice].sendControlChange(event.controller.name, event.value, trackData[currentTrack].outputChannel);
}

WebMidi.enable((err) => {
    midiReady = true;
    updateUI();
    WebMidi.inputs.forEach(function (input, key) {
        input.addListener("noteon", "all", onNoteOn);
        input.addListener("noteoff", "all", onNoteOff);
        input.addListener("pitchbend", "all", onPitchBend);
        input.addListener("controlchange", "all", onControlChange);
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
                sharedNotes = track.noteOff[j].filter(note => note in track.noteOn[i]);
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
            segmentElem.style = `left: ${left}px; width: ${width}px`;
            document.getElementById(`track_${track_number}`).append(segmentElem);
        });
    });
}

function addStartMarker() {
    if (playing) {
        return
    }
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
    if (playing) {
        return
    }
    if (endMarker === step) {
        endMarker = 0;
    } else if (startMarker < step) {
        endMarker = step;
    }
}

function deleteNotes() {
    if (endMarker > 0) {
        for (var i=startMarker; i<=endMarker; ++i) {
            if (typeof trackData[currentTrack].noteOn[i] !== "undefined") {
                delete trackData[currentTrack].noteOn[i];
            }
            if (typeof trackData[currentTrack].noteOff[i] !== "undefined") {
                delete trackData[currentTrack].noteOff[i];
            }
            if (typeof trackData[currentTrack].pitchbend[i] !== "undefined") {
                delete trackData[currentTrack].pitchbend[i];
            }
            if (typeof trackData[currentTrack].controlchange[i] !== "undefined") {
                delete trackData[currentTrack].controlchange[i];
            }
        }
        stopAllNotes();
        updateSegments();
    }
}

function paste() {
    if (playing || endMarker === 0 || step === startMarker) {
        return;
    }
    for (var i=startMarker; i<=endMarker; ++i) {
        relativeStep = i - startMarker;
        pasteStep = relativeStep + step;
        if (typeof trackData[currentTrack].noteOn[i] !== "undefined") {
            addTrackData(pasteStep, "noteOn", trackData[currentTrack].noteOn[i]);
        }
        if (typeof trackData[currentTrack].noteOff[i] !== "undefined") {
            addTrackData(pasteStep, "noteOff", trackData[currentTrack].noteOff[i]);
        }
        if (typeof trackData[currentTrack].pitchbend[i] !== "undefined") {
            addTrackData(pasteStep, "pitchbend", trackData[currentTrack].pitchbend[i]);
        }
        if (typeof trackData[currentTrack].controlchange[i] !== "undefined") {
            addTrackData(pasteStep, "controlchange", trackData[currentTrack].controlchange[i]);
        }
    }
    updateSegments();
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
        case "Backspace":
            deleteNotes();
            break;
        case "v":
            paste();
            break;
    }
    updateUI();
});
