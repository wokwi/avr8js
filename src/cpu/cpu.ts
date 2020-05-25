/**
 * AVR 8 CPU data structures
 * Part of AVR8js
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { u32, u16, u8 } from '../types';

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

export class CPU implements ICPU {
  readonly data: Uint8Array = new Uint8Array(this.sramBytes + registerSpace);
  readonly data16 = new Uint16Array(this.data.buffer);
  readonly dataView = new DataView(this.data.buffer);
  readonly progBytes = new Uint8Array(this.progMem.buffer);
  readonly readHooks: CPUMemoryReadHooks = [];
  readonly writeHooks: CPUMemoryHooks = [];
  readonly pc22Bits = this.progBytes.length > 0x20000;

  // This lets the Timer Compare output override GPIO pins:
  readonly gpioTimerHooks: CPUMemoryHooks = [];

  pc = 0;
  cycles = 0;

  constructor(public progMem: Uint16Array, private sramBytes = 8192) {
    this.reset();
  }

  reset() {
    this.data.fill(0);
    this.SP = this.data.length - 1;
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
}
