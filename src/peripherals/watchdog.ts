/**
 * AVR8 Watchdog Timer
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2021 Uri Shaked
 */

import { AVRClock } from '..';
import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface WatchdogConfig {
  watchdogInterrupt: u8;
  MCUSR: u8;
  WDTCSR: u8;
}

// Register bits:
const MCUSR_WDRF = 0x8; //  Watchdog System Reset Flag

const WDTCSR_WDIF = 0x80;
const WDTCSR_WDIE = 0x40;
const WDTCSR_WDP3 = 0x20;
const WDTCSR_WDCE = 0x10; // Watchdog Change Enable
const WDTCSR_WDE = 0x8;
const WDTCSR_WDP2 = 0x4;
const WDTCSR_WDP1 = 0x2;
const WDTCSR_WDP0 = 0x1;
const WDTCSR_WDP210 = WDTCSR_WDP2 | WDTCSR_WDP1 | WDTCSR_WDP0;

const WDTCSR_PROTECT_MASK = WDTCSR_WDE | WDTCSR_WDP3 | WDTCSR_WDP210;

export const watchdogConfig: WatchdogConfig = {
  watchdogInterrupt: 0x0c,
  MCUSR: 0x54,
  WDTCSR: 0x60,
};

export class AVRWatchdog {
  readonly clockFrequency = 128000;

  /**
   * Used to keep track on the last write to WDCE. Once written, the WDE/WDP* bits can be changed.
   */
  private changeEnabledCycles = 0;
  private watchdogTimeout = 0;
  private enabledValue = false;
  private scheduled = false;

  // Interrupts
  private Watchdog: AVRInterruptConfig = {
    address: this.config.watchdogInterrupt,
    flagRegister: this.config.WDTCSR,
    flagMask: WDTCSR_WDIF,
    enableRegister: this.config.WDTCSR,
    enableMask: WDTCSR_WDIE,
  };

  constructor(
    private cpu: CPU,
    private config: WatchdogConfig,
    private clock: AVRClock,
  ) {
    const { WDTCSR } = config;
    this.cpu.onWatchdogReset = () => {
      this.resetWatchdog();
    };
    cpu.writeHooks[WDTCSR] = (value: u8, oldValue: u8) => {
      if (value & WDTCSR_WDCE && value & WDTCSR_WDE) {
        this.changeEnabledCycles = this.cpu.cycles + 4;
        value = value & ~WDTCSR_PROTECT_MASK;
      } else {
        if (this.cpu.cycles >= this.changeEnabledCycles) {
          value = (value & ~WDTCSR_PROTECT_MASK) | (oldValue & WDTCSR_PROTECT_MASK);
        }
        this.enabledValue = !!(value & WDTCSR_WDE || value & WDTCSR_WDIE);
        this.cpu.data[WDTCSR] = value;
      }

      if (this.enabled) {
        this.resetWatchdog();
      }

      if (this.enabled && !this.scheduled) {
        this.cpu.addClockEvent(this.checkWatchdog, this.watchdogTimeout - this.cpu.cycles);
      }

      this.cpu.clearInterruptByFlag(this.Watchdog, value);
      return true;
    };
  }

  resetWatchdog() {
    const cycles = Math.floor((this.clock.frequency / this.clockFrequency) * this.prescaler);
    this.watchdogTimeout = this.cpu.cycles + cycles;
  }

  checkWatchdog = () => {
    if (this.enabled && this.cpu.cycles >= this.watchdogTimeout) {
      // Watchdog timed out!
      const wdtcsr = this.cpu.data[this.config.WDTCSR];
      if (wdtcsr & WDTCSR_WDIE) {
        this.cpu.setInterruptFlag(this.Watchdog);
      }
      if (wdtcsr & WDTCSR_WDE) {
        if (wdtcsr & WDTCSR_WDIE) {
          this.cpu.data[this.config.WDTCSR] &= ~WDTCSR_WDIE;
        } else {
          this.cpu.reset();
          this.scheduled = false;
          this.cpu.data[this.config.MCUSR] |= MCUSR_WDRF;
          return;
        }
      }
      this.resetWatchdog();
    }
    if (this.enabled) {
      this.scheduled = true;
      this.cpu.addClockEvent(this.checkWatchdog, this.watchdogTimeout - this.cpu.cycles);
    } else {
      this.scheduled = false;
    }
  };

  get enabled() {
    return this.enabledValue;
  }

  /**
   * The base clock frequency is 128KHz. Thus, a prescaler of 2048 gives 16ms timeout.
   */
  get prescaler() {
    const wdtcsr = this.cpu.data[this.config.WDTCSR];
    const value = ((wdtcsr & WDTCSR_WDP3) >> 2) | (wdtcsr & WDTCSR_WDP210);
    return 2048 << value;
  }
}
