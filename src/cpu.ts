/**
 * AVR 8 CPU data structures
 * Part of avr8js
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { u16, u8 } from './types';

export interface ICPU {
  readonly data: Uint8Array;
  readonly dataView: DataView;
  readonly progMem: Uint16Array;
  readonly progBytes: Uint8Array;
  pc: u16;
  cycles: number;

  readData(addr: u16): u8;
  writeData(addr: u16, value: u8): void;
}

export type ICPUMemoryHook = (value: u8, oldValue: u8, addr: u16) => void;
export interface ICPUMemoryHooks {
  [key: number]: ICPUMemoryHook;
}

export class CPU implements ICPU {
  readonly data = new Uint8Array(16384);
  readonly data16 = new Uint16Array(this.data.buffer);
  readonly dataView = new DataView(this.data.buffer);
  readonly progBytes = new Uint8Array(this.progMem.buffer);
  readonly writeHooks: ICPUMemoryHooks = [];

  pc = 0;
  cycles = 0;

  constructor(public progMem: Uint16Array) {}

  readData(addr: number) {
    return this.data[addr];
  }

  writeData(addr: number, value: number) {
    const hook = this.writeHooks[addr];
    if (hook) {
      hook(value, this.data[addr], addr);
    }
    this.data[addr] = value;
  }
}
