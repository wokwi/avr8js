/**
 * AVR-8 Timers
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, Uri Shaked
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

const WGM_NORMAL = 0;
const WGM_PWM_PHASE_CORRECT = 1;
const WGM_CTC = 2;
const WGM_FASTPWM = 3;

const TOV = 1;
const OCFA = 2;
const OCFB = 4;

const TOIE = 1;
const OCIEA = 2;
const OCIEB = 4;

type u8 = number;

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

export class AVRTimer {
  private mask = (1 << this.config.bits) - 1;
  private lastCycle = 0;
  private ocrA: u8 = 0;
  private ocrB: u8 = 0;

  constructor(private cpu: CPU, private config: AVRTimerConfig) {
    cpu.writeHooks[config.TCNT] = (value: u8) => {
      this.TCNT = value;
      this.timerUpdated(value);
      return true;
    };
    cpu.writeHooks[config.OCRA] = (value: u8) => {
      // TODO implement buffering when timer running in PWM mode
      this.ocrA = value;
    };
    cpu.writeHooks[config.OCRB] = (value: u8) => {
      this.ocrB = value;
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
    return this.cpu.data[this.config.TCNT];
  }

  set TCNT(value: u8) {
    this.cpu.data[this.config.TCNT] = value;
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

  get CS() {
    return (this.TCCRB & 0x7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }

  get WGM() {
    return ((this.TCCRB & 0x8) >> 1) | (this.TCCRA & 0x3);
  }

  tick() {
    const divider = this.config.dividers[this.CS];
    const delta = this.cpu.cycles - this.lastCycle;
    if (divider && delta >= divider) {
      const counterDelta = Math.floor(delta / divider);
      this.lastCycle += counterDelta * divider;
      const val = this.TCNT;
      const newVal = (val + counterDelta) & this.mask;
      this.TCNT = newVal;
      this.timerUpdated(newVal);
      if (
        (this.WGM === WGM_NORMAL ||
          this.WGM === WGM_PWM_PHASE_CORRECT ||
          this.WGM === WGM_FASTPWM) &&
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
      if (this.WGM === WGM_CTC) {
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
