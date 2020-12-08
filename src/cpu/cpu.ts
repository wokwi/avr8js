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

export class CPU implements ICPU {
  readonly data: Uint8Array = new Uint8Array(this.sramBytes + registerSpace);
  readonly data16 = new Uint16Array(this.data.buffer);
  readonly dataView = new DataView(this.data.buffer);
  readonly progBytes = new Uint8Array(this.progMem.buffer);
  readonly readHooks: CPUMemoryReadHooks = [];
  readonly writeHooks: CPUMemoryHooks = [];
  private readonly pendingInterrupts: AVRInterruptConfig[] = [];
  readonly pc22Bits = this.progBytes.length > 0x20000;

  // This lets the Timer Compare output override GPIO pins:
  readonly gpioTimerHooks: CPUMemoryHooks = [];

  pc: u32 = 0;
  cycles: u32 = 0;
  nextInterrupt: i16 = -1;

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

  tick() {
    if (this.interruptsEnabled && this.nextInterrupt >= 0) {
      const interrupt = this.pendingInterrupts[this.nextInterrupt];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      avrInterrupt(this, interrupt.address);
      if (!interrupt.constant) {
        this.clearInterrupt(interrupt);
      }
    }
  }
}
