var ppq = 24;
var bpm = 110;
var tickRate = 60000 / (bpm * ppq);

function tick() {
  postMessage({});
  setTimeout(tick, tickRate);
}

tick();

onmessage = function (e) {
  ppq = e.data.ppq;
  bpm = e.data.bpm;
  tickRate = 60000 / (bpm * ppq);
};
