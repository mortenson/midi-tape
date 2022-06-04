var lastTick = 0;
var ppq = 24;
var bpm = 110;
var tickRate = 60000 / (bpm * ppq);
var nums = [];
var numIndex = 0;

function debugTiming(offset) {
  nums[numIndex % 1000] = offset;
  numIndex++;
  var average = nums.reduce((a, b) => a + b) / nums.length;
  console.log("Average offset ", average);
}

function tick() {
  let now = performance.now();
  if (lastTick === 0) {
    lastTick = now;
  }
  postMessage({});
  setTimeout(tick, tickRate);
  lastTick = now;
}

tick();

onmessage = function (e) {
  ppq = e.data.ppq;
  bpm = e.data.bpm;
  tickRate = 60000 / (bpm * ppq);
};
