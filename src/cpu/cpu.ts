// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

/**
 * AVR 8 CPU data structures
 * Part of AVR8js
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { AVRIOPort } from '../peripherals/gpio';
import { u32, u16, u8, i16 } from '../types';
import { avrInterrupt } from './interrupt';

const registerSpace = 0x100;
const MAX_INTERRUPTS = 128; // Enough for ATMega2560

export type CPUMemoryHook = (value: u8, oldValue: u8, addr: u16, mask: u8) => boolean | void;
export interface CPUMemoryHooks {
  [key: number]: CPUMemoryHook;
}

export type CPUMemoryReadHook = (addr: u16) => u8;
export interface CPUMemoryReadHooks {
  [key: number]: CPUMemoryReadHook;
}

export interface AVRInterruptConfig {
  address: u8;
  enableRegister: u16;
  enableMask: u8;
  flagRegister: u16;
  flagMask: u8;
  constant?: boolean;
  inverseFlag?: boolean;
}

export type AVRClockEventCallback = () => void;

interface AVRClockEventEntry {
  cycles: number;
  callback: AVRClockEventCallback;
  next: AVRClockEventEntry | null;
}

export class CPU {
  readonly data: Uint8Array = new Uint8Array(this.sramBytes + registerSpace);
  readonly data16 = new Uint16Array(this.data.buffer);
  readonly dataView = new DataView(this.data.buffer);
  readonly progBytes = new Uint8Array(this.progMem.buffer);
  readonly readHooks: CPUMemoryReadHooks = [];
  readonly writeHooks: CPUMemoryHooks = [];
  private readonly pendingInterrupts: (AVRInterruptConfig | null)[] = new Array(MAX_INTERRUPTS);
  private nextClockEvent: AVRClockEventEntry | null = null;
  private readonly clockEventPool: AVRClockEventEntry[] = []; // helps avoid garbage collection

  /**
   * Whether the program counter (PC) can address 22 bits (the default is 16)
   */
  readonly pc22Bits = this.progBytes.length > 0x20000;

  readonly gpioPorts = new Set<AVRIOPort>();
  readonly gpioByPort: AVRIOPort[] = [];

  /**
   * This function is called by the WDR instruction. The Watchdog peripheral attaches
   * to it to listen for WDR (watchdog reset).
   */
  onWatchdogReset = () => {
    /* empty by default */
  };

  /**
   * Program counter
   */
  pc: u32 = 0;

  /**
   * Clock cycle counter
   */
  cycles = 0;

  nextInterrupt: i16 = -1;
  maxInterrupt: i16 = 0;

  constructor(
    public progMem: Uint16Array,
    private sramBytes = 8192,
  ) {
    this.reset();
  }

  reset() {
    this.SP = this.data.length - 1;
    this.pc = 0;
    this.pendingInterrupts.fill(null);
    this.nextInterrupt = -1;
    this.nextClockEvent = null;
  }

  readData(addr: number) {
    if (addr >= 32 && this.readHooks[addr]) {
      return this.readHooks[addr](addr);
    }
    return this.data[addr];
  }

  writeData(addr: number, value: number, mask = 0xff) {
    const hook = this.writeHooks[addr];
    if (hook) {
      if (hook(value, this.data[addr], addr, mask)) {
        return;
      }
    }
    this.data[addr] = value;
  }

  get SP() {
    return this.dataView.getUint16(93, true);
  }

  set SP(value: number) {
    this.dataView.setUint16(93, value, true);
  }

  get SREG() {
    return this.data[95];
  }

  get interruptsEnabled() {
    return this.SREG & 0x80 ? true : false;
  }

  setInterruptFlag(interrupt: AVRInterruptConfig) {
    const { flagRegister, flagMask, enableRegister, enableMask } = interrupt;
    if (interrupt.inverseFlag) {
      this.data[flagRegister] &= ~flagMask;
    } else {
      this.data[flagRegister] |= flagMask;
    }
    if (this.data[enableRegister] & enableMask) {
      this.queueInterrupt(interrupt);
    }
  }

  updateInterruptEnable(interrupt: AVRInterruptConfig, registerValue: u8) {
    const { enableMask, flagRegister, flagMask, inverseFlag } = interrupt;
    if (registerValue & enableMask) {
      const bitSet = this.data[flagRegister] & flagMask;
      if (inverseFlag ? !bitSet : bitSet) {
        this.queueInterrupt(interrupt);
      }
    } else {
      this.clearInterrupt(interrupt, false);
    }
  }

  queueInterrupt(interrupt: AVRInterruptConfig) {
    const { address } = interrupt;
    this.pendingInterrupts[address] = interrupt;
    if (this.nextInterrupt === -1 || this.nextInterrupt > address) {
      this.nextInterrupt = address;
    }
    if (address > this.maxInterrupt) {
      this.maxInterrupt = address;
    }
  }

  clearInterrupt({ address, flagRegister, flagMask }: AVRInterruptConfig, clearFlag = true) {
    if (clearFlag) {
      this.data[flagRegister] &= ~flagMask;
    }
    const { pendingInterrupts, maxInterrupt } = this;
    if (!pendingInterrupts[address]) {
      return;
    }
    pendingInterrupts[address] = null;
    if (this.nextInterrupt === address) {
      this.nextInterrupt = -1;
      for (let i = address + 1; i <= maxInterrupt; i++) {
        if (pendingInterrupts[i]) {
          this.nextInterrupt = i;
          break;
        }
      }
    }
  }

  clearInterruptByFlag(interrupt: AVRInterruptConfig, registerValue: number) {
    const { flagRegister, flagMask } = interrupt;
    if (registerValue & flagMask) {
      this.data[flagRegister] &= ~flagMask;
      this.clearInterrupt(interrupt);
    }
  }

  addClockEvent(callback: AVRClockEventCallback, cycles: number) {
    const { clockEventPool } = this;
    cycles = this.cycles + Math.max(1, cycles);
    const maybeEntry = clockEventPool.pop();
    const entry: AVRClockEventEntry = maybeEntry ?? { cycles, callback, next: null };
    entry.cycles = cycles;
    entry.callback = callback;
    let { nextClockEvent: clockEvent } = this;
    let lastItem = null;
    while (clockEvent && clockEvent.cycles < cycles) {
      lastItem = clockEvent;
      clockEvent = clockEvent.next;
    }
    if (lastItem) {
      lastItem.next = entry;
      entry.next = clockEvent;
    } else {
      this.nextClockEvent = entry;
      entry.next = clockEvent;
    }
    return callback;
  }

  updateClockEvent(callback: AVRClockEventCallback, cycles: number) {
    if (this.clearClockEvent(callback)) {
      this.addClockEvent(callback, cycles);
      return true;
    }
    return false;
  }

  clearClockEvent(callback: AVRClockEventCallback) {
    let { nextClockEvent: clockEvent } = this;
    if (!clockEvent) {
      return false;
    }
    const { clockEventPool } = this;
    let lastItem = null;
    while (clockEvent) {
      if (clockEvent.callback === callback) {
        if (lastItem) {
          lastItem.next = clockEvent.next;
        } else {
          this.nextClockEvent = clockEvent.next;
        }
        if (clockEventPool.length < 10) {
          clockEventPool.push(clockEvent);
        }
        return true;
      }
      lastItem = clockEvent;
      clockEvent = clockEvent.next;
    }
    return false;
  }

  tick() {
    const { nextClockEvent } = this;
    if (nextClockEvent && nextClockEvent.cycles <= this.cycles) {
      nextClockEvent.callback();
      this.nextClockEvent = nextClockEvent.next;
      if (this.clockEventPool.length < 10) {
        this.clockEventPool.push(nextClockEvent);
      }
    }

    const { nextInterrupt } = this;
    if (this.interruptsEnabled && nextInterrupt >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const interrupt = this.pendingInterrupts[nextInterrupt]!;
      avrInterrupt(this, interrupt.address);
      if (!interrupt.constant) {
        this.clearInterrupt(interrupt);
      }
    }
  }
}
