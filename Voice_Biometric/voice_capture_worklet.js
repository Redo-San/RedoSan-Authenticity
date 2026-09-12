/* c8 ignore start */
// Voice capture AudioWorkletProcessor — posts raw mono Float32 blocks.
// The k-rate side of the graph. Runs inside an AudioWorkletGlobalScope
// (no DOM, no window); do not add browser dependencies here.
/* c8 ignore stop */
/* global AudioWorkletProcessor, registerProcessor */

"use strict";

class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    var input = inputs[0];
    var channel = input ? input[0] : null;
    if (channel && channel.length > 0) {
      var block = new Float32Array(channel.length);
      block.set(channel);
      this.port.postMessage({ block: block });
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
