import { ICPU } from 'avr8js';

export class CPUPerformance {
  private prevTime = 0;
  private prevCycles = 0;
  private samples = new Float32Array(64);
  private sampleIndex = 0;

  constructor(private cpu: ICPU, private MHZ: number) {}

  reset() {
    this.prevTime = 0;
    this.prevCycles = 0;
    this.sampleIndex = 0;
  }

  update() {
    if (this.prevTime) {
      const delta = performance.now() - this.prevTime;
      const deltaCycles = this.cpu.cycles - this.prevCycles;
      const deltaCpuMillis = 1000 * (deltaCycles / this.MHZ);
      const factor = deltaCpuMillis / delta;
      if (!this.sampleIndex) {
        this.samples.fill(factor);
      }
      this.samples[this.sampleIndex++ % this.samples.length] = factor;
    }
    this.prevCycles = this.cpu.cycles;
    this.prevTime = performance.now();
    const avg = this.samples.reduce((x, y) => x + y) / this.samples.length;
    return avg;
  }
}
