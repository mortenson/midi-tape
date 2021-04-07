// I wrote this code for fun over a weekend.
// Don't judge it too harshly.
// I mean I can't stop you.
// But you'll have to live with yourself.

// Settings.
let playing = false;
let recording = false;
let quantize = false;
let midiReady = false;
let metronome = true;
let countIn = false;
let overdub = false;

// Used for recording/playback.
let currentTrack = 0;
let step = 0;
let startMarker = 0;
let endMarker = 0;
let countInTimer = 0;
let timer = new Worker("timer.js");
let alreadyWiped = {};
let notesHeld = {};

// Used for user interactions.
let keysPressed = {};
let arrowTrackChange = false;
let lockTape = true;
let spinTimeout;

// A tape is data that should persist.
let defaultOutputDevice = 0;
let defaultOutputChannel = 1;
let tape = {
  version: 1,
  ppq: 48,
  bpm: 110,
  inputDevice: 0,
  tracks: [
    {
      outputDevice: defaultOutputDevice,
      outputChannel: defaultOutputChannel,
      noteOn: {},
      noteOff: {},
      pitchbend: {},
      controlchange: {},
    },
    {
      outputDevice: defaultOutputDevice,
      outputChannel: defaultOutputChannel,
      noteOn: {},
      noteOff: {},
      pitchbend: {},
      controlchange: {},
    },
    {
      outputDevice: defaultOutputDevice,
      outputChannel: defaultOutputChannel,
      noteOn: {},
      noteOff: {},
      pitchbend: {},
      controlchange: {},
    },
    {
      outputDevice: defaultOutputDevice,
      outputChannel: defaultOutputChannel,
      noteOn: {},
      noteOff: {},
      pitchbend: {},
      controlchange: {},
    },
  ],
};

// A fake MIDI output device for ease of development.

let pitchShifter = new Tone.PitchShift(0).toDestination();
let synth = new Tone.PolySynth(Tone.Synth).toDestination();
synth.connect(pitchShifter);
let metronome_synth = new Tone.Synth().toDestination();

let fakeOutput = {
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

function wipeStepData() {
  let didWipe = false;
  if (
    !("noteOn" in alreadyWiped) &&
    typeof tape.tracks[currentTrack].noteOn[step] !== "undefined"
  ) {
    delete tape.tracks[currentTrack].noteOn[step];
    didWipe = true;
  }
  if (
    !("noteOff" in alreadyWiped) &&
    typeof tape.tracks[currentTrack].noteOff[step] !== "undefined"
  ) {
    delete tape.tracks[currentTrack].noteOff[step];
    didWipe = true;
    addTrackData(
      step,
      "noteOff",
      getUnfinishedNotes().filter((note) => !note in notesHeld)
    );
  }
  if (
    !("pitchbend" in alreadyWiped) &&
    typeof tape.tracks[currentTrack].pitchbend[step] !== "undefined"
  ) {
    delete tape.tracks[currentTrack].pitchbend[step];
    didWipe = true;
  }
  if (
    !("controlchange" in alreadyWiped) &&
    typeof tape.tracks[currentTrack].controlchange[step] !== "undefined"
  ) {
    delete tape.tracks[currentTrack].controlchange[step];
    didWipe = true;
  }
  alreadyWiped = {};
  if (didWipe) {
    renderSegments();
  }
}

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
    if (countInTimer % (tape.ppq / 24) === 0) {
      getOutputs().forEach(function (output) {
        output.sendClock();
      });
    }
    countInTimer--;
    return;
  }
  if (recording && overdub) {
    wipeStepData();
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
        try {
          getOutputDevice(trackNumber).sendControlChange(
            name,
            track.controlchange[step][name],
            track.outputChannel
          );
        } catch (e) {}
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
  if (step % (tape.ppq / 24) === 0) {
    getOutputs().forEach(function (output) {
      output.sendClock();
    });
  }
  step++;
  if (endMarker !== 0 && endMarker < step) {
    stopAllNotes();
    step = startMarker;
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
  let i = tape.tracks[trackNumber].outputDevice;
  if (i > getOutputs().length) {
    i = 0;
  }
  return getOutputs()[i];
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
  if (overdub) {
    delete tape.tracks[currentTrack][property][setStep];
    alreadyWiped[property] = true;
  }
  if (Array.isArray(data)) {
    if (typeof tape.tracks[currentTrack][property][setStep] === "undefined") {
      tape.tracks[currentTrack][property][setStep] = [];
    }
    tape.tracks[currentTrack][property][setStep] = Array.from(
      new Set(tape.tracks[currentTrack][property][setStep].concat(data))
    );
  } else if (typeof data === "object") {
    if (typeof tape.tracks[currentTrack][property][setStep] === "undefined") {
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
  if (playing && recording && countInTimer <= 0) {
    setStep = step;
    if (quantize) {
      setStep = quantizeStep(setStep, tape.ppq / 2);
    }
    addTrackData(setStep, "noteOn", {
      [event.note.name + event.note.octave]: event.velocity,
    });
    notesHeld[event.note.name + event.note.octave] = true;
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
  if (playing && recording && countInTimer <= 0) {
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
    delete notesHeld[event.note.name + event.note.octave];
    renderSegments();
  }
  getOutputDevice(currentTrack).stopNote(
    event.note.name + event.note.octave,
    tape.tracks[currentTrack].outputChannel
  );
}

function onPitchBend(event) {
  if (getInputDevice().id !== event.target.id) {
    return;
  }
  if (playing && recording && countInTimer <= 0) {
    addTrackData(step, "pitchbend", event.value);
    renderSegments();
  }
  getOutputDevice(currentTrack).sendPitchBend(
    event.value,
    tape.tracks[currentTrack].outputChannel
  );
}

function onControlChange(event) {
  if (getInputDevice().id !== event.target.id) {
    return;
  }
  if (playing && recording && countInTimer <= 0) {
    addTrackData(step, "controlchange", {
      [event.controller.name]: event.value,
    });
    renderSegments();
  }
  try {
    getOutputDevice(currentTrack).sendControlChange(
      event.controller.name,
      event.value,
      tape.tracks[currentTrack].outputChannel
    );
  } catch (e) {}
}

// Keyboard interaction and callbacks.

function getUnfinishedNotes() {
  let unfinishedNotes = [];
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
  document.getElementById("webaudio_button").remove();
}

function stopAllNotes() {
  getOutputs().forEach(function (output) {
    output.stopNote("all");
  });
}

function togglePlay() {
  playing = !playing;
  if (!playing) {
    notesHeld = {};
    addTrackData(step, "noteOff", getUnfinishedNotes());
    renderSegments();
  }
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
  notesHeld = {};
  addTrackData(step, "noteOff", getUnfinishedNotes());
  renderSegments();
  if (step !== startMarker) {
    spinCassette(true);
  }
  step = startMarker;
  stopAllNotes();
  renderTimeline();
}

function toggleRecording() {
  recording = !recording;
  if (!recording) {
    notesHeld = {};
    addTrackData(step, "noteOff", getUnfinishedNotes());
    renderSegments();
  }
}

function toggleOverdub() {
  overdub = !overdub;
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
  if (startMarker >= endMarker) {
    endMarker = 0;
  }
}

function addEndMarker() {
  if (playing) {
    return;
  }
  if (endMarker === step || step === 0) {
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

function deleteTrackData(pitch_cc_only) {
  if (endMarker > 0) {
    for (let i = startMarker; i <= endMarker; ++i) {
      if (!pitch_cc_only) {
        if (typeof tape.tracks[currentTrack].noteOn[i] !== "undefined") {
          delete tape.tracks[currentTrack].noteOn[i];
        }
        if (typeof tape.tracks[currentTrack].noteOff[i] !== "undefined") {
          delete tape.tracks[currentTrack].noteOff[i];
        }
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

function storeTape() {
  localforage.setItem("tape", tape);
}

function wipeTape() {
  lockTape = true;
  localforage.clear().then(function () {
    location.reload();
  });
}

function save() {
  lockTape = true;
  let element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," +
      encodeURIComponent(JSON.stringify(tape, null, 2))
  );
  element.setAttribute("download", "midi-tape.json");
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  lockTape = false;
}

function load() {
  let input = document.createElement("input");
  input.type = "file";
  input.onchange = function (event) {
    let reader = new FileReader();
    reader.onload = function (event) {
      lockTape = true;
      tape = JSON.parse(event.target.result);
      storeTape();
      location.reload();
    };
    reader.readAsText(event.target.files[0]);
  };
  input.click();
}

function spinCassette(backwards) {
  document.getElementById("cassette").classList = "";
  if (backwards) {
    setTimeout(
      () => (document.getElementById("cassette").classList = "spin-back")
    );
  } else {
    setTimeout(() => (document.getElementById("cassette").classList = "spin"));
  }
  if (spinTimeout) {
    clearTimeout(spinTimeout);
  }
  spinTimeout = setTimeout(
    () => (document.getElementById("cassette").classList = ""),
    1000
  );
}

document.addEventListener("keydown", (event) => {
  if (!midiReady) {
    return;
  }
  keysPressed[event.key] = true;
  let trackKey = false;
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
    case "ArrowRight":
      if (trackKey === false && !playing) {
        if ("Shift" in keysPressed) {
          step += 1;
          step = quantizeStep(step, tape.ppq * 4, "ceil");
          spinCassette();
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
          spinCassette(true);
        } else {
          step -= 10;
        }
        if (step < 0) {
          step = 0;
        }
        renderTimeline();
      }
      break;
    case "ArrowUp":
    case "ArrowDown":
      event.preventDefault();
      break;
  }
});

document.addEventListener("keyup", function (event) {
  if (!midiReady) {
    return;
  }
  delete keysPressed[event.key];
  let trackKey = false;
  let inputChange = false;
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
    case "P":
      stop();
      break;
    case "r":
      toggleRecording();
      break;
    case "R":
      toggleOverdub();
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
      deleteTrackData("Shift" in keysPressed);
      break;
    case "v":
      paste();
      break;
    case "V":
      // 11th hour hack to avoid refactoring paste/addTrackData.
      currentTrackBackup = currentTrack;
      tape.tracks.forEach(function (track, index) {
        currentTrack = index;
        paste();
      });
      currentTrack = currentTrackBackup;
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
  document.body.classList = `${recording ? "recording" : ""} ${
    playing ? "playing" : ""
  }`;
  document.getElementById("bpm-status").innerText = tape.bpm + " BPM";
  document.getElementById("playing").innerText = playing ? "Playing" : "Paused";
  document.getElementById("recording").innerText = recording
    ? "Recording"
    : "Not recording";
  document.getElementById("overdub").innerText = overdub
    ? "Overdub on"
    : "Overdub off";
  document.getElementById("metronome").innerText = metronome
    ? "Metronome on"
    : "Metronome off";
  document.getElementById("count-in").innerText = countIn
    ? "Count in on"
    : "Count in off";
  // document.getElementById("quantized").innerText = quantize
  //   ? "Quantization on"
  //   : "Quantization off";
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
    trackElem = document.getElementById(`track_${track_number}`);
    trackElem.innerHTML = "";
    let segments = [];
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
      let segmentElem = document.createElement("div");
      segmentElem.classList = "timeline-segment";
      left = getStepPixelPosition(segment.firstStep);
      width = getStepPixelPosition(segment.lastStep) - left;
      segmentElem.style = `left: ${left}px; width: ${width}px`;
      trackElem.append(segmentElem);
    });

    for (let i in track.pitchbend) {
      let pitchElem = document.createElement("div");
      pitchElem.classList = "timeline-pitchbend";
      left = getStepPixelPosition(i);
      pitchElem.style = `left: ${left}px;`;
      trackElem.append(pitchElem);
    }

    for (let i in track.controlchange) {
      let pitchElem = document.createElement("div");
      pitchElem.classList = "timeline-controlchange";
      left = getStepPixelPosition(i);
      pitchElem.style = `left: ${left}px;`;
      trackElem.append(pitchElem);
    }
  });
}

function renderTimeline() {
  document.getElementById("timeline").style =
    "margin-left: calc(50% - " + getStepPixelPosition(step) + "px);";
}

// Init code.

setInterval(function () {
  if (!lockTape) {
    storeTape();
  }
}, 500);

localforage.getItem("tape").then(function (value) {
  if (value) {
    tape = value;
    if (midiReady) {
      renderSegments();
      renderTimeline();
      renderStatus();
    }
  }
  lockTape = false;
});

timer.onmessage = (event) => {
  tick();
};

WebMidi.enable((err) => {
  midiReady = true;
  renderSegments();
  renderTimeline();
  renderStatus();
  WebMidi.inputs.forEach(function (input, key) {
    input.addListener("noteon", "all", onNoteOn);
    input.addListener("noteoff", "all", onNoteOff);
    input.addListener("pitchbend", "all", onPitchBend);
    input.addListener("controlchange", "all", onControlChange);
  });
});
