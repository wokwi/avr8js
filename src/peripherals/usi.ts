// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { AVRIOPort } from './gpio';

const USICR = 0x2d;
const USISR = 0x2e;
const USIDR = 0x2f;
const USIBR = 0x30;

// USISR bits
const USICNT_MASK = 0xf;
const USIDC = 1 << 4;
const USIPF = 1 << 5;
const USIOIF = 1 << 6;
const USISIF = 1 << 7;

// USICR bits
const USITC = 1 << 0;
const USICLK = 1 << 1;
const USICS0 = 1 << 2;
const USICS1 = 1 << 3;
const USIWM0 = 1 << 4;
const USIWM1 = 1 << 5;
const USIOIE = 1 << 6;
const USISIE = 1 << 7;

export class AVRUSI {
  // Interrupts
  private START: AVRInterruptConfig = {
    address: 0xd,
    flagRegister: USISR,
    flagMask: USISIF,
    enableRegister: USICR,
    enableMask: USISIE,
  };

  private OVF: AVRInterruptConfig = {
    address: 0xe,
    flagRegister: USISR,
    flagMask: USIOIF,
    enableRegister: USICR,
    enableMask: USIOIE,
  };

  constructor(cpu: CPU, port: AVRIOPort, portPin: number, dataPin: number, clockPin: number) {
    const PIN = portPin;
    const PORT = PIN + 2;
    port.addListener((value) => {
      const twoWire = (cpu.data[USICR] & USIWM1) === USIWM1;
      if (twoWire) {
        if (value & (1 << clockPin) && !(value & (1 << dataPin))) {
          // Start condition detected
          cpu.setInterruptFlag(this.START);
        }
        if (value & (1 << clockPin) && value & (1 << dataPin)) {
          // Stop condition detected
          cpu.data[USISR] |= USIPF;
        }
      }
    });
    const updateOutput = () => {
      const oldValue = cpu.data[PORT];
      const newValue =
        cpu.data[USIDR] & 0x80 ? oldValue | (1 << dataPin) : oldValue & ~(1 << dataPin);
      cpu.writeHooks[PORT](newValue, oldValue, PORT, 0xff);
      if (newValue & 0x80 && !(cpu.data[PIN] & 0x80)) {
        cpu.data[USISR] |= USIDC; // Shout output HIGH (pulled-up), but input is LOW
      } else {
        cpu.data[USISR] &= ~USIDC;
      }
    };
    const count = () => {
      const counter = (cpu.data[USISR] + 1) & USICNT_MASK;
      cpu.data[USISR] = (cpu.data[USISR] & ~USICNT_MASK) | counter;
      if (!counter) {
        cpu.data[USIBR] = cpu.data[USIDR];
        cpu.setInterruptFlag(this.OVF);
      }
    };
    const shift = (inputValue: number) => {
      cpu.data[USIDR] = (cpu.data[USIDR] << 1) | inputValue;
      updateOutput();
    };
    cpu.writeHooks[USIDR] = (value: number) => {
      cpu.data[USIDR] = value;
      updateOutput();
      return true;
    };
    cpu.writeHooks[USISR] = (value: number) => {
      const writeClearMask = USISIF | USIOIF | USIPF;
      cpu.data[USISR] = (cpu.data[USISR] & writeClearMask & ~value) | (value & 0xf);
      cpu.clearInterruptByFlag(this.START, value);
      cpu.clearInterruptByFlag(this.OVF, value);
      return true;
    };
    cpu.writeHooks[USICR] = (value: number) => {
      cpu.data[USICR] = value & ~(USICLK | USITC);
      cpu.updateInterruptEnable(this.START, value);
      cpu.updateInterruptEnable(this.OVF, value);
      const clockSrc = value & ((USICS1 | USICS0) >> 2);
      const mode = value & ((USIWM1 | USIWM0) >> 4);
      const usiClk = value & USICLK;
      port.openCollector = mode >= 2 ? 1 << dataPin : 0;
      const inputValue = cpu.data[PIN] & (1 << dataPin) ? 1 : 0;
      if (usiClk && !clockSrc) {
        shift(inputValue);
        count();
      }
      if (value & USITC) {
        cpu.writeHooks[PIN](1 << clockPin, cpu.data[PIN], PIN, 0xff);
        const newValue = cpu.data[PIN] & (1 << clockPin);
        if (usiClk && (clockSrc === 2 || clockSrc === 3)) {
          if (clockSrc === 2 && newValue) {
            shift(inputValue);
          }
          if (clockSrc === 3 && !newValue) {
            shift(inputValue);
          }
          count();
        }
        return true;
      }
    };
  }
}
