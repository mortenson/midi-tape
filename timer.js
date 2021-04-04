var lastTick = 0;
var ppq = 48;
var bpm = 110;
var tickRate = 60000 / (bpm * ppq);

function tick() {
    if (lastTick === 0) {
        lastTick = performance.now();
    }
    postMessage({});
    timeout = tickRate
    var offset = (performance.now() - lastTick) - tickRate
    if (offset > 0) {
        timeout -= offset
    }
    setTimeout(tick, timeout);
    lastTick = performance.now();
}

tick();

onmessage = function(e) {
    ppq = e.data.ppq;
    bpm = e.data.bpm;
    tickRate = 60000 / (bpm * ppq);
}
