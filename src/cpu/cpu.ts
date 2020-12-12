/**
 * AVR 8 CPU data structures
 * Part of AVR8js
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { u32, u16, u8, i16 } from '../types';
import { avrInterrupt } from './interrupt';

const registerSpace = 0x100;

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface ICPU {
  readonly data: Uint8Array;
  readonly dataView: DataView;
  readonly progMem: Uint16Array;
  readonly progBytes: Uint8Array;

  /**
   * Whether the program counter (PC) can address 22 bits (the default is 16)
   */
  readonly pc22Bits: boolean;

  /**
   * Program counter
   */
  pc: u32;

  /**
   * Clock cycle counter
   */
  cycles: number;

  readData(addr: u16): u8;
  writeData(addr: u16, value: u8): void;
}

export type CPUMemoryHook = (value: u8, oldValue: u8, addr: u16) => boolean | void;
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
}

export type AVRClockEventCallback = () => void;

interface AVRClockEventEntry {
  cycles: number;
  callback: AVRClockEventCallback;
}

export class CPU implements ICPU {
  readonly data: Uint8Array = new Uint8Array(this.sramBytes + registerSpace);
  readonly data16 = new Uint16Array(this.data.buffer);
  readonly dataView = new DataView(this.data.buffer);
  readonly progBytes = new Uint8Array(this.progMem.buffer);
  readonly readHooks: CPUMemoryReadHooks = [];
  readonly writeHooks: CPUMemoryHooks = [];
  private readonly pendingInterrupts: AVRInterruptConfig[] = [];
  private readonly clockEvents: AVRClockEventEntry[] = [];
  readonly pc22Bits = this.progBytes.length > 0x20000;

  // This lets the Timer Compare output override GPIO pins:
  readonly gpioTimerHooks: CPUMemoryHooks = [];

  pc: u32 = 0;
  cycles: u32 = 0;
  nextInterrupt: i16 = -1;
  private nextClockEvent: u32 = 0;

  constructor(public progMem: Uint16Array, private sramBytes = 8192) {
    this.reset();
  }

  reset() {
    this.data.fill(0);
    this.SP = this.data.length - 1;
    this.pendingInterrupts.splice(0, this.pendingInterrupts.length);
    this.nextInterrupt = -1;
  }

  readData(addr: number) {
    if (addr >= 32 && this.readHooks[addr]) {
      return this.readHooks[addr](addr);
    }
    return this.data[addr];
  }

  writeData(addr: number, value: number) {
    const hook = this.writeHooks[addr];
    if (hook) {
      if (hook(value, this.data[addr], addr)) {
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

  private updateNextInterrupt() {
    this.nextInterrupt = this.pendingInterrupts.findIndex((item) => !!item);
  }

  setInterruptFlag(interrupt: AVRInterruptConfig) {
    const { flagRegister, flagMask, enableRegister, enableMask } = interrupt;
    if (interrupt.constant) {
      this.data[flagRegister] &= ~flagMask;
    } else {
      this.data[flagRegister] |= flagMask;
    }
    if (this.data[enableRegister] & enableMask) {
      this.queueInterrupt(interrupt);
    }
  }

  updateInterruptEnable(interrupt: AVRInterruptConfig, registerValue: u8) {
    const { enableMask, flagRegister, flagMask } = interrupt;
    if (registerValue & enableMask) {
      if (this.data[flagRegister] & flagMask) {
        this.queueInterrupt(interrupt);
      }
    } else {
      this.clearInterrupt(interrupt, false);
    }
  }

  queueInterrupt(interrupt: AVRInterruptConfig) {
    this.pendingInterrupts[interrupt.address] = interrupt;
    this.updateNextInterrupt();
  }

  clearInterrupt({ address, flagRegister, flagMask }: AVRInterruptConfig, clearFlag = true) {
    delete this.pendingInterrupts[address];
    if (clearFlag) {
      this.data[flagRegister] &= ~flagMask;
    }
    this.updateNextInterrupt();
  }

  clearInterruptByFlag(interrupt: AVRInterruptConfig, registerValue: number) {
    const { flagRegister, flagMask } = interrupt;
    if (registerValue & flagMask) {
      this.data[flagRegister] &= ~flagMask;
      this.clearInterrupt(interrupt);
    }
  }

  addClockEvent(callback: AVRClockEventCallback, cycles: number) {
    const entry = { cycles: this.cycles + Math.max(1, cycles), callback };
    // Add the new entry while keeping the array sorted
    const { clockEvents } = this;
    if (!clockEvents.length || clockEvents[clockEvents.length - 1].cycles <= entry.cycles) {
      clockEvents.push(entry);
    } else if (clockEvents[0].cycles >= entry.cycles) {
      clockEvents.unshift(entry);
    } else {
      for (let i = 1; i < clockEvents.length; i++) {
        if (clockEvents[i].cycles >= entry.cycles) {
          clockEvents.splice(i, 0, entry);
          break;
        }
      }
    }
    this.nextClockEvent = this.clockEvents[0].cycles;
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
    const index = this.clockEvents.findIndex((item) => item.callback === callback);
    if (index >= 0) {
      this.clockEvents.splice(index, 1);
      this.nextClockEvent = this.clockEvents[0]?.cycles ?? 0;
      return true;
    }
    return false;
  }

  tick() {
    const { nextClockEvent, clockEvents } = this;
    if (nextClockEvent && nextClockEvent <= this.cycles) {
      clockEvents.shift()?.callback();
      this.nextClockEvent = clockEvents[0]?.cycles ?? 0;
    }

    const { nextInterrupt } = this;
    if (this.interruptsEnabled && nextInterrupt >= 0) {
      const interrupt = this.pendingInterrupts[nextInterrupt];
      avrInterrupt(this, interrupt.address);
      if (!interrupt.constant) {
        this.clearInterrupt(interrupt);
      }
    }
  }
}
