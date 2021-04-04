// Settings.
let playing = false;
let recording = true;
let quantize = false;
let midiReady = false;
let metronome = true;
let countIn = false;

// Used for recording/playback.
let currentTrack = 0;
let step = 0;
let startMarker = 0;
let endMarker = 0;
let countInTimer = 0;
const timer = new Worker("timer.js");

// Used for user interactions.
let keysPressed = {};
let arrowTrackChange = false;
let trackKey = false;

// A tape is data that should persist.
let tape = {
  ppq: 48,
  bpm: 110,
  inputDevice: 0,
  tracks: [
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
  ],
};

// A fake MIDI output device for ease of development.

const pitchShifter = new Tone.PitchShift(0).toDestination();
const synth = new Tone.PolySynth(Tone.Synth).toDestination();
synth.connect(pitchShifter);
const metronome_synth = new Tone.Synth().toDestination();

const fakeOutput = {
  name: "Fake Synth",
};

fakeOutput.playNote = function (note_name, channel, options) {
  synth.triggerAttack(note_name, Tone.now(), options.velocity ?? 1);
};

fakeOutput.stopNote = function (note_name, channel) {
  if (note_name === "all") {
    synth.releaseAll();
  } else {
    synth.triggerRelease(note_name);
  }
};

fakeOutput.sendPitchBend = function (value, channel) {
  pitchShifter.pitch = value;
};

fakeOutput.sendControlChange = function (name, value) {};

fakeOutput.sendClock = function () {};

// Main callback for outputting MIDI.

function tick() {
  if (!playing) {
    return;
  }
  if (countInTimer > 0) {
    if (countInTimer % (tape.ppq * 4) === 0) {
      metronome_synth.triggerAttackRelease("C4", 0.1);
    } else if (countInTimer % tape.ppq === 0) {
      metronome_synth.triggerAttackRelease("C3", 0.1);
    }
    renderTimeline();
    countInTimer--;
    return;
  }
  tape.tracks.forEach(function (track, trackNumber) {
    if (typeof track.noteOn[step] !== "undefined") {
      for (let note in track.noteOn[step]) {
        getOutputDevice(trackNumber).playNote(note, track.outputChannel, {
          velocity: track.noteOn[step][note],
        });
      }
    }
    if (typeof track.noteOff[step] !== "undefined") {
      track.noteOff[step].forEach(function (note) {
        getOutputDevice(trackNumber).stopNote(note, track.outputChannel);
      });
    }
    if (typeof track.pitchbend[step] !== "undefined") {
      getOutputDevice(trackNumber).sendPitchBend(
        track.pitchbend[step],
        track.outputChannel
      );
    }
    if (typeof track.controlchange[step] !== "undefined") {
      for (let name in track.controlchange[step]) {
        getOutputDevice(trackNumber).sendControlChange(
          name,
          track.controlchange[step][name],
          track.outputChannel
        );
      }
    }
  });
  if (metronome) {
    if (step % (tape.ppq * 4) === 0) {
      metronome_synth.triggerAttackRelease("C4", 0.1);
    } else if (step % tape.ppq === 0) {
      metronome_synth.triggerAttackRelease("C3", 0.1);
    }
  }
  step++;
  if (endMarker !== 0 && endMarker < step) {
    stopAllNotes();
    step = startMarker;
  }
  if (step % (tape.ppq / 24) === 0) {
    getOutputs().forEach(function (output) {
      output.sendClock();
    });
  }
  renderTimeline();
}

function getInputs() {
  return WebMidi.inputs;
}

function getInputDevice() {
  let i = tape.inputDevice;
  if (i > getInputs().length) {
    i = 0;
  }
  return getInputs()[i];
}

function getOutputs() {
  return WebMidi.outputs.concat([fakeOutput]);
}

function getOutputDevice(trackNumber) {
  let i = trackNumber;
  if (i > getOutputs().length) {
    i = 0;
  }
  return getOutputs()[tape.tracks[trackNumber].outputDevice];
}

function quantizeStep(setStep, multiple, mode) {
  if (mode === "ceil") {
    return Math.ceil(setStep / multiple) * multiple;
  } else if (mode === "floor") {
    return Math.floor(setStep / multiple) * multiple;
  } else {
    newStep = setStep + multiple / 2;
    newStep = newStep - (newStep % multiple);
    return newStep;
  }
}

function addTrackData(setStep, property, data) {
  if (Array.isArray(data)) {
    if (typeof tape.tracks[currentTrack][property][setStep] == "undefined") {
      tape.tracks[currentTrack][property][setStep] = [];
    }
    tape.tracks[currentTrack][property][setStep] = Array.from(
      new Set(tape.tracks[currentTrack][property][setStep].concat(data))
    );
  } else if (typeof data === "object") {
    if (typeof tape.tracks[currentTrack][property][setStep] == "undefined") {
      tape.tracks[currentTrack][property][setStep] = {};
    }
    for (let note in data) {
      tape.tracks[currentTrack][property][setStep][note] = data[note];
    }
  } else {
    tape.tracks[currentTrack][property][setStep] = data;
  }
}

// MIDI input callbacks.

function onNoteOn(event) {
  if (getInputDevice().id !== event.target.id) {
    return;
  }
  if (playing && recording) {
    setStep = step;
    if (quantize) {
      setStep = quantizeStep(setStep, tape.ppq / 2);
    }
    addTrackData(setStep, "noteOn", {
      [event.note.name + event.note.octave]: event.velocity,
    });
    renderSegments();
  }
  getOutputDevice(currentTrack).playNote(
    event.note.name + event.note.octave,
    tape.tracks[currentTrack].outputChannel,
    {
      velocity: event.velocity,
    }
  );
}

function onNoteOff(event) {
  if (getInputDevice().id !== event.target.id) {
    return;
  }
  if (playing && recording) {
    setStep = step;
    if (quantize) {
      newStep = quantizeStep(setStep, tape.ppq / 2);
      // Prevent notes from being cut off by having the same start+end time.
      if (newStep < setStep) {
        newStep = quantizeStep(setStep + tape.ppq / 2, tape.ppq / 2);
      }
      setStep = newStep;
    }
    addTrackData(setStep, "noteOff", [event.note.name + event.note.octave]);
    renderSegments();
  }
  getOutputDevice(currentTrack).stopNote(
    event.note.name + event.note.octave,
    tape.tracks[currentTrack].outputChannel
  );
}

function onPitchBend(event) {
  if (getInputDevice() !== event.target.id) {
    return;
  }
  if (playing && recording) {
    tape.tracks[currentTrack].pitchbend[step] = event.value;
  }
  getOutputDevice(currentTrack).sendPitchBend(
    event.value,
    tape.tracks[currentTrack].outputChannel
  );
}

function onControlChange(event) {
  if (getInputDevice() !== event.target.id) {
    return;
  }
  if (playing && recording) {
    addTrackData(step, "controlchange", {
      [event.controller.name]: event.value,
    });
  }
  getOutputDevice(currentTrack).sendControlChange(
    event.controller.name,
    event.value,
    tape.tracks[currentTrack].outputChannel
  );
}

// Keyboard interaction and callbacks.

function getUnfinishedNotes() {
  const unfinishedNotes = [];
  for (let i of Object.keys(tape.tracks[currentTrack].noteOn)
    .map(Number)
    .sort((a, b) => a - b)) {
    unfinishedNotes = Array.from(
      new Set(
        unfinishedNotes.concat(Object.keys(tape.tracks[currentTrack].noteOn[i]))
      )
    );
    for (let j of Object.keys(tape.tracks[currentTrack].noteOff)
      .map(Number)
      .sort((a, b) => a - b)) {
      if (j < i) {
        continue;
      }
      unfinishedNotes = unfinishedNotes.filter(
        (note) => !tape.tracks[currentTrack].noteOff[j].includes(note)
      );
    }
  }
  return unfinishedNotes;
}

function enableWebAudio() {
  Tone.start();
  document.getElementById("start_button").remove();
}

function stopAllNotes() {
  getOutputs().forEach(function (output) {
    output.stopNote("all");
  });
}

function togglePlay() {
  playing = !playing;
  if (countIn) {
    countInTimer = tape.ppq * 4;
  }
  stopAllNotes();
}

function toggleQuantize() {
  quantize = !quantize;
}

function toggleMetronome() {
  metronome = !metronome;
}

function stop() {
  playing = false;
  countInTimer = 0;
  step = startMarker;
  stopAllNotes();
  renderTimeline();
}

function toggleRecording() {
  recording = !recording;
}

function changeTrack(track_number) {
  currentTrack = track_number;
}

function addStartMarker() {
  if (playing) {
    return;
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
    return;
  }
  if (endMarker === step) {
    endMarker = 0;
  } else if (startMarker < step) {
    endMarker = step;
  }
}

function updateBpm(newBpm) {
  if (newBpm <= 0) {
    newBpm = 1;
  }
  tape.bpm = newBpm;
  timer.postMessage({ bpm: tape.bpm, ppq: tape.ppq });
  renderStatus();
}

function toggleCountIn() {
  countIn = !countIn;
  countInTimer = 0;
  renderStatus();
}

function deleteNotes() {
  if (endMarker > 0) {
    for (let i = startMarker; i <= endMarker; ++i) {
      if (typeof tape.tracks[currentTrack].noteOn[i] !== "undefined") {
        delete tape.tracks[currentTrack].noteOn[i];
      }
      if (typeof tape.tracks[currentTrack].noteOff[i] !== "undefined") {
        delete tape.tracks[currentTrack].noteOff[i];
      }
      if (typeof tape.tracks[currentTrack].pitchbend[i] !== "undefined") {
        delete tape.tracks[currentTrack].pitchbend[i];
      }
      if (typeof tape.tracks[currentTrack].controlchange[i] !== "undefined") {
        delete tape.tracks[currentTrack].controlchange[i];
      }
    }
    stopAllNotes();
    addTrackData(startMarker, "noteOff", getUnfinishedNotes());
    renderSegments();
  }
}

function paste() {
  if (playing || endMarker === 0 || step === startMarker) {
    return;
  }
  for (let i = startMarker; i <= endMarker; ++i) {
    relativeStep = i - startMarker;
    pasteStep = relativeStep + step;
    if (typeof tape.tracks[currentTrack].noteOn[i] !== "undefined") {
      addTrackData(pasteStep, "noteOn", tape.tracks[currentTrack].noteOn[i]);
    }
    if (typeof tape.tracks[currentTrack].noteOff[i] !== "undefined") {
      addTrackData(pasteStep, "noteOff", tape.tracks[currentTrack].noteOff[i]);
    }
    if (typeof tape.tracks[currentTrack].pitchbend[i] !== "undefined") {
      addTrackData(
        pasteStep,
        "pitchbend",
        tape.tracks[currentTrack].pitchbend[i]
      );
    }
    if (typeof tape.tracks[currentTrack].controlchange[i] !== "undefined") {
      addTrackData(
        pasteStep,
        "controlchange",
        tape.tracks[currentTrack].controlchange[i]
      );
    }
  }
  addTrackData(
    step + (endMarker - startMarker),
    "noteOff",
    getUnfinishedNotes()
  );
  renderSegments();
}

document.addEventListener("keydown", (event) => {
  if (!midiReady) {
    return;
  }
  keysPressed[event.key] = true;
  switch (event.key) {
    case "ArrowRight":
      if (trackKey === false && !playing) {
        if ("Shift" in keysPressed) {
          step += 1;
          step = quantizeStep(step, tape.ppq * 4, "ceil");
        } else {
          step += 10;
        }
        renderTimeline();
      }
      break;
    case "ArrowLeft":
      if (trackKey === false && !playing) {
        if ("Shift" in keysPressed) {
          step -= 1;
          step = quantizeStep(step, tape.ppq * 4, "floor");
        } else {
          step -= 10;
        }
        if (step < 0) {
          step = 0;
        }
        renderTimeline();
      }
      break;
  }
});

document.addEventListener("keyup", function (event) {
  if (!midiReady) {
    return;
  }
  delete keysPressed[event.key];
  trackKey = false;
  inputChange = false;
  if ("1" in keysPressed) {
    trackKey = 0;
  } else if ("2" in keysPressed) {
    trackKey = 1;
  } else if ("3" in keysPressed) {
    trackKey = 2;
  } else if ("4" in keysPressed) {
    trackKey = 3;
  } else if ("i" in keysPressed) {
    inputChange = true;
  }
  switch (event.key) {
    case "ArrowUp":
      if (trackKey !== false) {
        tape.tracks[trackKey].outputDevice++;
        if (tape.tracks[trackKey].outputDevice >= getOutputs().length) {
          tape.tracks[trackKey].outputDevice = 0;
        }
        arrowTrackChange = true;
      } else if (inputChange) {
        tape.inputDevice++;
        if (tape.inputDevice >= WebMidi.inputs.length) {
          tape.inputDevice = 0;
        }
      } else {
        offset = 1;
        if ("Shift" in keysPressed) {
          offset = 10;
        }
        updateBpm(tape.bpm + offset);
      }
      break;
    case "ArrowDown":
      if (trackKey !== false) {
        tape.tracks[trackKey].outputDevice--;
        if (tape.tracks[trackKey].outputDevice < 0) {
          tape.tracks[trackKey].outputDevice = getOutputs().length - 1;
        }
        arrowTrackChange = true;
      } else if (inputChange) {
        tape.inputDevice--;
        if (tape.inputDevice < 0) {
          tape.inputDevice = WebMidi.inputs.length - 1;
        }
      } else {
        offset = 1;
        if ("Shift" in keysPressed) {
          offset = 10;
        }
        updateBpm(tape.bpm - offset);
      }
      break;
    case "ArrowRight":
      if (trackKey !== false) {
        tape.tracks[trackKey].outputChannel++;
        if (tape.tracks[trackKey].outputChannel > 16) {
          tape.tracks[trackKey].outputChannel = 1;
        }
        arrowTrackChange = true;
      }
      break;
    case "ArrowLeft":
      if (trackKey !== false) {
        tape.tracks[trackKey].outputChannel--;
        if (tape.tracks[trackKey].outputChannel <= 0) {
          tape.tracks[trackKey].outputChannel = 16;
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
    case "M":
      toggleCountIn();
      break;
    case "q":
      toggleQuantize();
      break;
    case "1":
    case "2":
    case "3":
    case "4":
      if (!arrowTrackChange) {
        changeTrack(parseInt(event.key) - 1);
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
  renderStatus();
});

// UI rendering.

function getStepPixelPosition(step) {
  bar_width = 100;
  pixel_per_note = bar_width / 4;
  return (step / tape.ppq) * pixel_per_note;
}

function renderStatus() {
  document.body.classList = recording ? "recording" : "";
  document.getElementById("bpm-status").innerText = tape.bpm + " BPM";
  document.getElementById("playing").innerText = playing ? "Playing" : "Paused";
  document.getElementById("recording").innerText = recording
    ? "Recording"
    : "Not recording";
  document.getElementById("metronome").innerText = metronome
    ? "Metronome on"
    : "Metronome off";
  document.getElementById("count-in").innerText = countIn
    ? "Count in on"
    : "Count in off";
  document.getElementById("quantized").innerText = quantize
    ? "Quantization on"
    : "Quantization off";
  document.getElementById("current-track").innerText = `Current track: ${
    currentTrack + 1
  }`;
  tape.tracks.forEach(function (track, index) {
    document.getElementById(`track_${index}`).classList =
      index === currentTrack ? "track current-track" : "track";
    document.getElementById(`output-device-${index}`).innerText = `Track ${
      index + 1
    } device: ${getOutputDevice(index).name} (${track.outputChannel})`;
  });
  document.getElementById("input-device").innerText = `Input device: ${
    getInputDevice().name
  }`;
  if (startMarker > 0) {
    document.getElementById(
      "timeline-start-marker"
    ).style = `left: ${getStepPixelPosition(startMarker)}px; display: block;`;
  } else {
    document.getElementById("timeline-start-marker").style = "";
  }
  if (endMarker > 0) {
    document.getElementById(
      "timeline-end-marker"
    ).style = `left: ${getStepPixelPosition(endMarker)}px; display: block;`;
  } else {
    document.getElementById("timeline-end-marker").style = "";
  }
}

function renderSegments() {
  tape.tracks.forEach(function (track, track_number) {
    document.getElementById(`track_${track_number}`).innerHTML = "";
    const segments = [];
    for (let i of Object.keys(track.noteOn)
      .map(Number)
      .sort((a, b) => a - b)) {
      for (let j of Object.keys(track.noteOff)
        .map(Number)
        .sort((a, b) => a - b)) {
        if (j < i) {
          continue;
        }
        sharedNotes = track.noteOff[j].filter(
          (note) => note in track.noteOn[i]
        );
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
      const segmentElem = document.createElement("div");
      segmentElem.classList = "timeline-segment";
      left = getStepPixelPosition(segment.firstStep);
      width = getStepPixelPosition(segment.lastStep) - left;
      segmentElem.style = `left: ${left}px; width: ${width}px`;
      document.getElementById(`track_${track_number}`).append(segmentElem);
    });
  });
}

function renderTimeline() {
  document.getElementById("timeline").style =
    "margin-left: calc(50% - " + getStepPixelPosition(step) + "px);";
}

// Init code.

timer.onmessage = (event) => {
  tick();
};

WebMidi.enable((err) => {
  midiReady = true;
  renderStatus();
  WebMidi.inputs.forEach(function (input, key) {
    input.addListener("noteon", "all", onNoteOn);
    input.addListener("noteoff", "all", onNoteOff);
    input.addListener("pitchbend", "all", onPitchBend);
    input.addListener("controlchange", "all", onControlChange);
  });
});
