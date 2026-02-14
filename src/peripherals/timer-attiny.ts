// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

/**
 * ATtiny25/45/85 Timer/Counter1
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2586-AVR-8-bit-Microcontroller-ATtiny25-ATtiny45-ATtiny85_Datasheet.pdf
 */

import { AVRInterruptConfig, CPU, CPUMemoryHook } from '../cpu/cpu';
import { PinOverrideMode } from './gpio';

type u8 = number;
type u16 = number;

export interface ATtinyTimer1Config {
  TCCR1: u8;
  GTCCR: u8;
  TCNT1: u8;
  OCR1A: u8;
  OCR1B: u8;
  OCR1C: u8;
  TIFR: u8;
  TIMSK: u8;

  ovfInterrupt: u8;
  compAInterrupt: u8;
  compBInterrupt: u8;

  TOV1: u8;
  OCF1A: u8;
  OCF1B: u8;

  TOIE1: u8;
  OCIE1A: u8;
  OCIE1B: u8;

  compPortB: u16;
  compPinA: u8;
  compPinB: u8;

  dividers: Record<number, number>;
}

// TCCR1 bits
const CTC1 = 1 << 7;
const PWM1A = 1 << 6;
const CS_MASK = 0x0f;

// GTCCR bits
const PWM1B_BIT = 1 << 6;
const FOC1B = 1 << 3;
const FOC1A = 1 << 2;
const PSR1 = 1 << 1;

export const attinyTimer1Config: ATtinyTimer1Config = {
  TCCR1: 0x50,
  GTCCR: 0x4c,
  TCNT1: 0x4f,
  OCR1A: 0x4e,
  OCR1B: 0x4b,
  OCR1C: 0x4d,
  TIFR: 0x58,
  TIMSK: 0x59,

  ovfInterrupt: 0x04,
  compAInterrupt: 0x03,
  compBInterrupt: 0x09,

  TOV1: 1 << 2,
  OCF1A: 1 << 6,
  OCF1B: 1 << 5,

  TOIE1: 1 << 2,
  OCIE1A: 1 << 6,
  OCIE1B: 1 << 5,

  compPortB: 0x38,
  compPinA: 1, // PB1
  compPinB: 4, // PB4

  dividers: {
    0: 0,
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 16,
    6: 32,
    7: 64,
    8: 128,
    9: 256,
    10: 512,
    11: 1024,
    12: 2048,
    13: 4096,
    14: 8192,
    15: 16384,
  },
};

export class ATtinyTimer1 {
  private lastCycle = 0;
  private tcnt = 0;
  private tcntNext = 0;
  private tcntUpdated = false;
  private ocrA = 0;
  private ocrB = 0;
  private ocrC = 0;
  private divider = 0;
  private updateDivider = false;
  private countingUp = true;

  private readonly OVF: AVRInterruptConfig = {
    address: this.config.ovfInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.TOV1,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.TOIE1,
  };

  private readonly OCFA: AVRInterruptConfig = {
    address: this.config.compAInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.OCF1A,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.OCIE1A,
  };

  private readonly OCFB: AVRInterruptConfig = {
    address: this.config.compBInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.OCF1B,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.OCIE1B,
  };

  constructor(
    private cpu: CPU,
    private config: ATtinyTimer1Config,
  ) {
    const { TCCR1, GTCCR, TCNT1, OCR1A, OCR1B, OCR1C, TIFR, TIMSK } = config;

    cpu.readHooks[TCNT1] = () => {
      this.count(false);
      return (cpu.data[TCNT1] = this.tcnt & 0xff);
    };

    cpu.writeHooks[TCNT1] = (value: number) => {
      this.tcntNext = value;
      this.countingUp = true;
      this.tcntUpdated = true;
      cpu.updateClockEvent(this.count, 0);
      if (this.divider) {
        this.timerUpdated(this.tcntNext, this.tcntNext);
      }
    };

    cpu.writeHooks[OCR1A] = (value: number) => {
      this.ocrA = value;
    };
    cpu.writeHooks[OCR1B] = (value: number) => {
      this.ocrB = value;
    };
    cpu.writeHooks[OCR1C] = (value: number) => {
      this.ocrC = value;
    };

    cpu.writeHooks[TCCR1] = (value: number) => {
      cpu.data[TCCR1] = value;
      this.updateDivider = true;
      cpu.clearClockEvent(this.count);
      cpu.addClockEvent(this.count, 0);
      this.updateCompConfig();
      return true;
    };

    // GTCCR is shared with Timer0 (PSR0) — chain with existing hook
    const prevGtccrHook = cpu.writeHooks[GTCCR] as CPUMemoryHook | undefined;
    cpu.writeHooks[GTCCR] = (value: number, oldValue: number, addr: number, mask: number) => {
      if (value & FOC1A) {
        this.forceCompare('A');
      }
      if (value & FOC1B) {
        this.forceCompare('B');
      }
      if (value & PSR1) {
        this.lastCycle = this.cpu.cycles;
      }
      value &= ~(FOC1A | FOC1B | PSR1);

      if (prevGtccrHook) {
        prevGtccrHook(value, oldValue, addr, mask);
      } else {
        cpu.data[GTCCR] = value;
      }

      this.updateCompConfig();
      return true;
    };

    // TIFR/TIMSK are shared with Timer0 — chain with existing hooks
    const prevTifrHook = cpu.writeHooks[TIFR] as CPUMemoryHook | undefined;
    cpu.writeHooks[TIFR] = (value: number, oldValue: number, addr: number, mask: number) => {
      if (prevTifrHook) {
        prevTifrHook(value, oldValue, addr, mask);
      } else {
        cpu.data[TIFR] = value;
      }
      cpu.clearInterruptByFlag(this.OVF, value);
      cpu.clearInterruptByFlag(this.OCFA, value);
      cpu.clearInterruptByFlag(this.OCFB, value);
      return true;
    };

    const prevTimskHook = cpu.writeHooks[TIMSK] as CPUMemoryHook | undefined;
    cpu.writeHooks[TIMSK] = (value: number, oldValue: number, addr: number, mask: number) => {
      if (prevTimskHook) {
        prevTimskHook(value, oldValue, addr, mask);
      }
      cpu.updateInterruptEnable(this.OVF, value);
      cpu.updateInterruptEnable(this.OCFA, value);
      cpu.updateInterruptEnable(this.OCFB, value);
    };
  }

  private get tccr1() {
    return this.cpu.data[this.config.TCCR1];
  }

  private get gtccr() {
    return this.cpu.data[this.config.GTCCR];
  }

  private get CS() {
    return this.tccr1 & CS_MASK;
  }

  private get ctcMode() {
    return !!(this.tccr1 & CTC1);
  }

  private get pwmA() {
    return !!(this.tccr1 & PWM1A);
  }

  private get pwmB() {
    return !!(this.gtccr & PWM1B_BIT);
  }

  private get comA(): number {
    return (this.tccr1 >> 4) & 0x3;
  }

  private get comB(): number {
    return (this.gtccr >> 4) & 0x3;
  }

  /** TOP = OCR1C in CTC/PWM modes, 0xFF in Normal mode */
  private get TOP() {
    if (this.ctcMode || this.pwmA || this.pwmB) {
      return this.ocrC;
    }
    return 0xff;
  }

  count = (reschedule = true) => {
    const { divider, lastCycle, cpu } = this;
    const { cycles } = cpu;
    const delta = cycles - lastCycle;

    if (divider && delta >= divider) {
      const counterDelta = Math.floor(delta / divider);
      this.lastCycle += counterDelta * divider;
      const val = this.tcnt;
      const top = this.TOP;
      const phasePwm = (this.pwmA || this.pwmB) && !this.ctcMode;

      const newVal = phasePwm
        ? this.phasePwmCount(val, counterDelta)
        : (val + counterDelta) % (top + 1);
      const overflow = val + counterDelta > top;

      if (!this.tcntUpdated) {
        this.tcnt = newVal;
        if (!phasePwm) {
          this.timerUpdated(newVal, val);
        }
      }

      if (!phasePwm && overflow) {
        cpu.setInterruptFlag(this.OVF);
      }
    }

    if (this.tcntUpdated) {
      this.tcnt = this.tcntNext;
      this.tcntUpdated = false;
    }

    if (this.updateDivider) {
      const cs = this.CS;
      const newDivider = this.config.dividers[cs] ?? 0;
      this.lastCycle = newDivider ? this.cpu.cycles : 0;
      this.updateDivider = false;
      this.divider = newDivider;
      if (newDivider) {
        cpu.addClockEvent(this.count, this.lastCycle + newDivider - cpu.cycles);
      }
      return;
    }

    if (reschedule && divider) {
      cpu.addClockEvent(this.count, this.lastCycle + divider - cpu.cycles);
    }
  };

  private phasePwmCount(value: number, delta: number): number {
    const top = this.TOP;

    while (delta > 0) {
      if (this.countingUp) {
        value++;
        if (value >= top) {
          value = top;
          this.countingUp = false;
        }
      } else {
        value--;
        if (value <= 0) {
          value = 0;
          this.countingUp = true;
          this.cpu.setInterruptFlag(this.OVF);
        }
      }

      if (!this.tcntUpdated) {
        if (value === this.ocrA) {
          this.cpu.setInterruptFlag(this.OCFA);
          this.updateCompPinPwm('A');
        }
        if (value === this.ocrB) {
          this.cpu.setInterruptFlag(this.OCFB);
          this.updateCompPinPwm('B');
        }
      }
      delta--;
    }
    return value & 0xff;
  }

  private timerUpdated(value: number, prevValue: number) {
    const { ocrA, ocrB } = this;
    const overflow = prevValue > value;
    if (((prevValue < ocrA || overflow) && value >= ocrA) || (prevValue < ocrA && overflow)) {
      this.cpu.setInterruptFlag(this.OCFA);
      if (this.comA && !this.pwmA) {
        this.updateCompPinNonPwm('A');
      }
    }
    if (((prevValue < ocrB || overflow) && value >= ocrB) || (prevValue < ocrB && overflow)) {
      this.cpu.setInterruptFlag(this.OCFB);
      if (this.comB && !this.pwmB) {
        this.updateCompPinNonPwm('B');
      }
    }
  }

  private forceCompare(channel: 'A' | 'B') {
    if (channel === 'A' && !this.pwmA && this.comA) {
      this.updateCompPinNonPwm('A');
    } else if (channel === 'B' && !this.pwmB && this.comB) {
      this.updateCompPinNonPwm('B');
    }
  }

  private updateCompPinNonPwm(channel: 'A' | 'B') {
    const com = channel === 'A' ? this.comA : this.comB;
    const pin = channel === 'A' ? this.config.compPinA : this.config.compPinB;
    let mode: PinOverrideMode;
    switch (com) {
      case 1:
        mode = PinOverrideMode.Toggle;
        break;
      case 2:
        mode = PinOverrideMode.Clear;
        break;
      case 3:
        mode = PinOverrideMode.Set;
        break;
      default:
        return;
    }
    this.cpu.gpioByPort[this.config.compPortB]?.timerOverridePin(pin, mode);
  }

  private updateCompPinPwm(channel: 'A' | 'B') {
    const com = channel === 'A' ? this.comA : this.comB;
    const pin = channel === 'A' ? this.config.compPinA : this.config.compPinB;
    const invertingMode = com === 3;
    const isSet = this.countingUp === invertingMode;
    let mode: PinOverrideMode;
    switch (com) {
      case 1:
        mode = PinOverrideMode.Toggle;
        break;
      case 2:
      case 3:
        mode = isSet ? PinOverrideMode.Set : PinOverrideMode.Clear;
        break;
      default:
        return;
    }
    this.cpu.gpioByPort[this.config.compPortB]?.timerOverridePin(pin, mode);
  }

  private updateCompConfig() {
    const port = this.cpu.gpioByPort[this.config.compPortB];
    if (!port) return;
    port.timerOverridePin(
      this.config.compPinA,
      this.comA ? PinOverrideMode.Enable : PinOverrideMode.None,
    );
    port.timerOverridePin(
      this.config.compPinB,
      this.comB ? PinOverrideMode.Enable : PinOverrideMode.None,
    );
  }
}
