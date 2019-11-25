/**
 * AVR-8 GPIO Port implementation
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, Uri Shaked
 */
import { CPU } from './cpu';
import { u8 } from './types';

export interface AVRPortConfig {
  // Register addresses
  PIN: u8;
  DDR: u8;
  PORT: u8;
}

export type GPIOListener = (value: u8, oldValue: u8) => void;

export const portBConfig: AVRPortConfig = {
  PIN: 0x23,
  DDR: 0x24,
  PORT: 0x25
};

export const portCConfig: AVRPortConfig = {
  PIN: 0x26,
  DDR: 0x27,
  PORT: 0x28
};

export const portDConfig: AVRPortConfig = {
  PIN: 0x29,
  DDR: 0x2a,
  PORT: 0x2b
};

export class AVRIOPort {
  private listeners: GPIOListener[] = [];

  constructor(cpu: CPU, portConfig: AVRPortConfig) {
    cpu.writeHooks[portConfig.PORT] = (value: u8, oldValue: u8) => {
      const ddrMask = cpu.data[portConfig.DDR];
      value &= ddrMask;
      cpu.data[portConfig.PIN] = (cpu.data[portConfig.PIN] & ~ddrMask) | value;
      this.writeGpio(value, oldValue & ddrMask);
      // TODO: activate pullups if configured as an input pin
    };
    cpu.writeHooks[portConfig.PIN] = (value: u8) => {
      // Writing to 1 PIN toggles PORT bits
      const oldPortValue = cpu.data[portConfig.PORT];
      const ddrMask = cpu.data[portConfig.DDR];
      const portValue = oldPortValue ^ value;
      cpu.data[portConfig.PORT] = portValue;
      cpu.data[portConfig.PIN] = (cpu.data[portConfig.PIN] & ~ddrMask) | (portValue & ddrMask);
      this.writeGpio(portValue & ddrMask, oldPortValue & ddrMask);
      return true;
    };
  }

  addListener(listener: GPIOListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: GPIOListener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private writeGpio(value: u8, oldValue: u8) {
    for (const listener of this.listeners) {
      listener(value, oldValue);
    }
  }
}
