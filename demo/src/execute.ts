import {
  avrInstruction,
  AVRTimer,
  CPU,
  timer0Config,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig
} from 'avr8js';
import { loadHex } from './intelhex';

// ATmega328p params
const FLASH = 0x8000;

export class AVRRunner {
  readonly program = new Uint16Array(FLASH);
  readonly cpu: CPU;
  readonly timer: AVRTimer;
  readonly portB: AVRIOPort;
  readonly portC: AVRIOPort;
  readonly portD: AVRIOPort;

  private stopped = false;

  constructor(hex: string) {
    loadHex(hex, new Uint8Array(this.program.buffer));
    this.cpu = new CPU(this.program);
    this.timer = new AVRTimer(this.cpu, timer0Config);
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
  }

  async execute(callback: (cpu: CPU) => void) {
    this.stopped = false;
    for (;;) {
      avrInstruction(this.cpu);
      this.timer.tick();
      if (this.cpu.cycles % 50000 === 0) {
        callback(this.cpu);
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (this.stopped) {
          break;
        }
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}
