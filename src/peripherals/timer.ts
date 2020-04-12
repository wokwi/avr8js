/**
 * AVR-8 Timers
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */

import { CPU } from '../cpu/cpu';
import { avrInterrupt } from '../cpu/interrupt';

const timer01Dividers = {
  0: 0,
  1: 1,
  2: 8,
  3: 64,
  4: 256,
  5: 1024,
  6: 0, // TODO: External clock source on T0 pin. Clock on falling edge.
  7: 0 // TODO: External clock source on T0 pin. Clock on rising edge.
};

const TOV = 1;
const OCFA = 2;
const OCFB = 4;

const TOIE = 1;
const OCIEA = 2;
const OCIEB = 4;

type u8 = number;
type u16 = number;

interface TimerDividers {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
}

interface AVRTimerConfig {
  bits: 8 | 16;
  captureInterrupt: u8;
  compAInterrupt: u8;
  compBInterrupt: u8;
  ovfInterrupt: u8;

  // Register addresses
  TIFR: u8;
  OCRA: u8;
  OCRB: u8;
  ICR: u8;
  TCNT: u8;
  TCCRA: u8;
  TCCRB: u8;
  TCCRC: u8;
  TIMSK: u8;

  dividers: TimerDividers;
}

export const timer0Config: AVRTimerConfig = {
  bits: 8,
  captureInterrupt: 0, // not available
  compAInterrupt: 0x1c,
  compBInterrupt: 0x1e,
  ovfInterrupt: 0x20,
  TIFR: 0x35,
  OCRA: 0x47,
  OCRB: 0x48,
  ICR: 0, // not available
  TCNT: 0x46,
  TCCRA: 0x44,
  TCCRB: 0x45,
  TCCRC: 0, // not available
  TIMSK: 0x6e,
  dividers: timer01Dividers
};

export const timer1Config: AVRTimerConfig = {
  bits: 16,
  captureInterrupt: 0x14,
  compAInterrupt: 0x16,
  compBInterrupt: 0x18,
  ovfInterrupt: 0x1a,
  TIFR: 0x36,
  OCRA: 0x88,
  OCRB: 0x8a,
  ICR: 0x86,
  TCNT: 0x84,
  TCCRA: 0x80,
  TCCRB: 0x81,
  TCCRC: 0x82,
  TIMSK: 0x6f,
  dividers: timer01Dividers
};

export const timer2Config: AVRTimerConfig = {
  bits: 8,
  captureInterrupt: 0, // not available
  compAInterrupt: 0x0e,
  compBInterrupt: 0x10,
  ovfInterrupt: 0x12,
  TIFR: 0x37,
  OCRA: 0xb3,
  OCRB: 0xb4,
  ICR: 0, // not available
  TCNT: 0xb2,
  TCCRA: 0xb0,
  TCCRB: 0xb1,
  TCCRC: 0, // not available
  TIMSK: 0x70,
  dividers: {
    0: 1,
    1: 1,
    2: 8,
    3: 32,
    4: 64,
    5: 128,
    6: 256,
    7: 1024
  }
};

/* All the following types and constants are related to WGM (Waveform Generation Mode) bits: */
enum TimerMode {
  Normal,
  PWMPhaseCorrect,
  CTC,
  FastPWM,
  PWMPhaseFrequencyCorrect,
  Reserved
}

enum TOVUpdateMode {
  Max,
  Top,
  Bottom
}

enum OCRUpdateMode {
  Immediate,
  Top,
  Bottom
}

const TopOCRA = 1;
const TopICR = 2;
type TimerTopValue = 0xff | 0x1ff | 0x3ff | 0xffff | typeof TopOCRA | typeof TopICR;

type WGMConfig = [TimerMode, TimerTopValue, OCRUpdateMode, TOVUpdateMode];

const wgmModes8Bit: WGMConfig[] = [
  /*0*/ [TimerMode.Normal, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*1*/ [TimerMode.PWMPhaseCorrect, 0xff, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*2*/ [TimerMode.CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*3*/ [TimerMode.FastPWM, 0xff, OCRUpdateMode.Bottom, TOVUpdateMode.Max],
  /*4*/ [TimerMode.Reserved, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*5*/ [TimerMode.PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*6*/ [TimerMode.Reserved, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*7*/ [TimerMode.FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top]
];

// Table 16-4 in the datasheet
const wgmModes16Bit: WGMConfig[] = [
  /*0 */ [TimerMode.Normal, 0xffff, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*1 */ [TimerMode.PWMPhaseCorrect, 0x00ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*2 */ [TimerMode.PWMPhaseCorrect, 0x01ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*3 */ [TimerMode.PWMPhaseCorrect, 0x03ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*4 */ [TimerMode.CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*5 */ [TimerMode.FastPWM, 0x00ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top],
  /*6 */ [TimerMode.FastPWM, 0x01ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top],
  /*7 */ [TimerMode.FastPWM, 0x03ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top],
  /*8 */ [TimerMode.PWMPhaseFrequencyCorrect, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom],
  /*9 */ [TimerMode.PWMPhaseFrequencyCorrect, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom],
  /*10*/ [TimerMode.PWMPhaseCorrect, TopICR, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*11*/ [TimerMode.PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom],
  /*12*/ [TimerMode.CTC, TopICR, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*13*/ [TimerMode.Reserved, 0xffff, OCRUpdateMode.Immediate, TOVUpdateMode.Max],
  /*14*/ [TimerMode.FastPWM, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Top],
  /*15*/ [TimerMode.FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top]
];

export class AVRTimer {
  private lastCycle = 0;
  private ocrA: u16 = 0;
  private ocrB: u16 = 0;
  private timerMode: TimerMode;
  private topValue: TimerTopValue;

  constructor(private cpu: CPU, private config: AVRTimerConfig) {
    this.updateWGMConfig();
    this.registerHook(config.TCNT, (value: u16) => {
      this.TCNT = value;
      this.timerUpdated(value);
      return true;
    });
    this.registerHook(config.OCRA, (value: u16) => {
      // TODO implement buffering when timer running in PWM mode
      this.ocrA = value;
    });
    this.registerHook(config.OCRB, (value: u16) => {
      this.ocrB = value;
    });
    cpu.writeHooks[config.TCCRA] = (value) => {
      this.cpu.data[config.TCCRA] = value;
      this.updateWGMConfig();
      return true;
    };
    cpu.writeHooks[config.TCCRB] = (value) => {
      this.cpu.data[config.TCCRB] = value;
      this.updateWGMConfig();
      return true;
    };
  }

  reset() {
    this.lastCycle = 0;
    this.ocrA = 0;
    this.ocrB = 0;
  }

  get TIFR() {
    return this.cpu.data[this.config.TIFR];
  }

  set TIFR(value: u8) {
    this.cpu.data[this.config.TIFR] = value;
  }

  get TCNT() {
    return this.config.bits === 16
      ? this.cpu.dataView.getUint16(this.config.TCNT, true)
      : this.cpu.data[this.config.TCNT];
  }

  set TCNT(value: u16) {
    this.cpu.data[this.config.TCNT] = value & 0xff;
    if (this.config.bits === 16) {
      this.cpu.data[this.config.TCNT + 1] = (value >> 8) & 0xff;
    }
  }

  get TCCRA() {
    return this.cpu.data[this.config.TCCRA];
  }

  get TCCRB() {
    return this.cpu.data[this.config.TCCRB];
  }

  get TIMSK() {
    return this.cpu.data[this.config.TIMSK];
  }

  get ICR() {
    // Only available for 16-bit timers
    return (this.cpu.data[this.config.ICR + 1] << 8) | this.cpu.data[this.config.ICR];
  }

  get CS() {
    return (this.TCCRB & 0x7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }

  get WGM() {
    const mask = this.config.bits === 16 ? 0x18 : 0x8;
    return ((this.TCCRB & mask) >> 1) | (this.TCCRA & 0x3);
  }

  get TOP() {
    switch (this.topValue) {
      case TopOCRA:
        return this.ocrA;
      case TopICR:
        return this.ICR;
      default:
        return this.topValue;
    }
  }

  private registerHook(address: number, hook: (value: u16) => void) {
    if (this.config.bits === 16) {
      this.cpu.writeHooks[address] = (value: u8) => hook((this.cpu.data[address + 1] << 8) | value);
      this.cpu.writeHooks[address + 1] = (value: u8) => hook((value << 8) | this.cpu.data[address]);
    } else {
      this.cpu.writeHooks[address] = hook;
    }
  }

  private updateWGMConfig() {
    const wgmModes = this.config.bits === 16 ? wgmModes16Bit : wgmModes8Bit;
    const [timerMode, topValue] = wgmModes[this.WGM];
    this.timerMode = timerMode;
    this.topValue = topValue;
  }

  tick() {
    const divider = this.config.dividers[this.CS];
    const delta = this.cpu.cycles - this.lastCycle;
    if (divider && delta >= divider) {
      const counterDelta = Math.floor(delta / divider);
      this.lastCycle += counterDelta * divider;
      const val = this.TCNT;
      const newVal = (val + counterDelta) % (this.TOP + 1);
      this.TCNT = newVal;
      this.timerUpdated(newVal);
      const { timerMode } = this;
      if (
        (timerMode === TimerMode.Normal ||
          timerMode === TimerMode.PWMPhaseCorrect ||
          timerMode === TimerMode.PWMPhaseFrequencyCorrect ||
          timerMode === TimerMode.FastPWM) &&
        val > newVal
      ) {
        this.TIFR |= TOV;
      }
    }
    if (this.cpu.interruptsEnabled) {
      if (this.TIFR & TOV && this.TIMSK & TOIE) {
        avrInterrupt(this.cpu, this.config.ovfInterrupt);
        this.TIFR &= ~TOV;
      }
      if (this.TIFR & OCFA && this.TIMSK & OCIEA) {
        avrInterrupt(this.cpu, this.config.compAInterrupt);
        this.TIFR &= ~OCFA;
      }
      if (this.TIFR & OCFB && this.TIMSK & OCIEB) {
        avrInterrupt(this.cpu, this.config.compBInterrupt);
        this.TIFR &= ~OCFB;
      }
    }
  }

  private timerUpdated(value: u8) {
    if (this.ocrA && value === this.ocrA) {
      this.TIFR |= OCFA;
      if (this.timerMode === TimerMode.CTC) {
        // Clear Timer on Compare Match (CTC) Mode
        this.TCNT = 0;
        this.TIFR |= TOV;
      }
    }
    if (this.ocrB && value === this.ocrB) {
      this.TIFR |= OCFB;
    }
  }
}
