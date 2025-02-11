// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

/**
 * AVR8 Clock
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2020, Uri Shaked
 */

import { CPU } from '../cpu/cpu';
import { u32, u8 } from '../types';

const CLKPCE = 128;

export interface AVRClockConfig {
  CLKPR: u8;
}

export const clockConfig: AVRClockConfig = {
  CLKPR: 0x61,
};

const prescalers = [
  1, 2, 4, 8, 16, 32, 64, 128, 256,

  // The following values are "reserved" according to the datasheet, so we measured
  // with a scope to figure them out (on ATmega328p)
  2, 4, 8, 16, 32, 64, 128,
];

export class AVRClock {
  private clockEnabledCycles = 0;
  private prescalerValue = 1;
  cyclesDelta = 0;

  constructor(
    private cpu: CPU,
    private baseFreqHz: u32,
    private config: AVRClockConfig = clockConfig,
  ) {
    this.cpu.writeHooks[this.config.CLKPR] = (clkpr) => {
      if ((!this.clockEnabledCycles || this.clockEnabledCycles < cpu.cycles) && clkpr === CLKPCE) {
        this.clockEnabledCycles = this.cpu.cycles + 4;
      } else if (this.clockEnabledCycles && this.clockEnabledCycles >= cpu.cycles) {
        this.clockEnabledCycles = 0;
        const index = clkpr & 0xf;
        const oldPrescaler = this.prescalerValue;
        this.prescalerValue = prescalers[index];
        this.cpu.data[this.config.CLKPR] = index;
        if (oldPrescaler !== this.prescalerValue) {
          this.cyclesDelta =
            (cpu.cycles + this.cyclesDelta) * (oldPrescaler / this.prescalerValue) - cpu.cycles;
        }
      }

      return true;
    };
  }

  get frequency() {
    return this.baseFreqHz / this.prescalerValue;
  }

  get prescaler() {
    return this.prescalerValue;
  }

  get timeNanos() {
    return ((this.cpu.cycles + this.cyclesDelta) / this.frequency) * 1e9;
  }

  get timeMicros() {
    return ((this.cpu.cycles + this.cyclesDelta) / this.frequency) * 1e6;
  }

  get timeMillis() {
    return ((this.cpu.cycles + this.cyclesDelta) / this.frequency) * 1e3;
  }
}
