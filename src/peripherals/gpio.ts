/**
 * AVR-8 GPIO Port implementation
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */
import { CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface AVRPortConfig {
  // Register addresses
  PIN: u8;
  DDR: u8;
  PORT: u8;
}

export type GPIOListener = (value: u8, oldValue: u8) => void;

export const portAConfig: AVRPortConfig = {
  PIN: 0x20,
  DDR: 0x21,
  PORT: 0x22,
};

export const portBConfig: AVRPortConfig = {
  PIN: 0x23,
  DDR: 0x24,
  PORT: 0x25,
};

export const portCConfig: AVRPortConfig = {
  PIN: 0x26,
  DDR: 0x27,
  PORT: 0x28,
};

export const portDConfig: AVRPortConfig = {
  PIN: 0x29,
  DDR: 0x2a,
  PORT: 0x2b,
};

export const portEConfig: AVRPortConfig = {
  PIN: 0x2c,
  DDR: 0x2d,
  PORT: 0x2e,
};

export const portFConfig: AVRPortConfig = {
  PIN: 0x2f,
  DDR: 0x30,
  PORT: 0x31,
};

export const portGConfig: AVRPortConfig = {
  PIN: 0x32,
  DDR: 0x33,
  PORT: 0x34,
};

export const portHConfig: AVRPortConfig = {
  PIN: 0x100,
  DDR: 0x101,
  PORT: 0x102,
};

export const portJConfig: AVRPortConfig = {
  PIN: 0x103,
  DDR: 0x104,
  PORT: 0x105,
};

export const portKConfig: AVRPortConfig = {
  PIN: 0x106,
  DDR: 0x107,
  PORT: 0x108,
};

export const portLConfig: AVRPortConfig = {
  PIN: 0x109,
  DDR: 0x10a,
  PORT: 0x10b,
};

export enum PinState {
  Low,
  High,
  Input,
  InputPullUp,
}

export class AVRIOPort {
  private listeners: GPIOListener[] = [];
  private pinValue: u8 = 0;

  constructor(private cpu: CPU, private portConfig: AVRPortConfig) {
    cpu.writeHooks[portConfig.DDR] = (value, oldValue) => {
      const portValue = cpu.data[portConfig.PORT];
      this.updatePinRegister(portValue, value);
      this.writeGpio(value & portValue, oldValue & oldValue);
    };
    cpu.writeHooks[portConfig.PORT] = (value: u8, oldValue: u8) => {
      const ddrMask = cpu.data[portConfig.DDR];
      cpu.data[portConfig.PORT] = value;
      value &= ddrMask;
      cpu.data[portConfig.PIN] = (cpu.data[portConfig.PIN] & ~ddrMask) | value;
      this.updatePinRegister(value, ddrMask);
      this.writeGpio(value, oldValue & ddrMask);
      return true;
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

  /**
   * Get the state of a given GPIO pin
   *
   * @param index Pin index to return from 0 to 7
   * @returns PinState.Low or PinState.High if the pin is set to output, PinState.Input if the pin is set
   *   to input, and PinState.InputPullUp if the pin is set to input and the internal pull-up resistor has
   *   been enabled.
   */
  pinState(index: number) {
    const ddr = this.cpu.data[this.portConfig.DDR];
    const port = this.cpu.data[this.portConfig.PORT];
    const bitMask = 1 << index;
    if (ddr & bitMask) {
      return port & bitMask ? PinState.High : PinState.Low;
    } else {
      return port & bitMask ? PinState.InputPullUp : PinState.Input;
    }
  }

  /**
   * Sets the input value for the given pin. This is the value that
   * will be returned when reading from the PIN register.
   */
  setPin(index: number, value: boolean) {
    const bitMask = 1 << index;
    this.pinValue &= ~bitMask;
    if (value) {
      this.pinValue |= bitMask;
    }
    this.updatePinRegister(this.cpu.data[this.portConfig.PORT], this.cpu.data[this.portConfig.DDR]);
  }

  private updatePinRegister(port: u8, ddr: u8) {
    this.cpu.data[this.portConfig.PIN] = (this.pinValue & ~ddr) | (port & ddr);
  }

  private writeGpio(value: u8, oldValue: u8) {
    for (const listener of this.listeners) {
      listener(value, oldValue);
    }
  }
}
