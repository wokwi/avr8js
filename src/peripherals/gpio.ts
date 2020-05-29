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

/* This mechanism allows timers to override specific GPIO pins */
export enum PinOverrideMode {
  None,
  Enable,
  Set,
  Clear,
  Toggle,
}

export class AVRIOPort {
  private listeners: GPIOListener[] = [];
  private pinValue: u8 = 0;
  private overrideMask: u8 = 0xff;
  private overrideValue: u8;
  private lastValue: u8 = 0;
  private lastDdr: u8 = 0;

  constructor(private cpu: CPU, private portConfig: AVRPortConfig) {
    cpu.writeHooks[portConfig.DDR] = (value: u8) => {
      const portValue = cpu.data[portConfig.PORT];
      cpu.data[portConfig.DDR] = value;
      this.updatePinRegister(portValue, value);
      this.writeGpio(portValue, value);
      return true;
    };
    cpu.writeHooks[portConfig.PORT] = (value: u8) => {
      const ddrMask = cpu.data[portConfig.DDR];
      cpu.data[portConfig.PORT] = value;
      this.updatePinRegister(value, ddrMask);
      this.writeGpio(value, ddrMask);
      return true;
    };
    cpu.writeHooks[portConfig.PIN] = (value: u8) => {
      // Writing to 1 PIN toggles PORT bits
      const oldPortValue = cpu.data[portConfig.PORT];
      const ddrMask = cpu.data[portConfig.DDR];
      const portValue = oldPortValue ^ value;
      cpu.data[portConfig.PORT] = portValue;
      cpu.data[portConfig.PIN] = (cpu.data[portConfig.PIN] & ~ddrMask) | (portValue & ddrMask);
      this.writeGpio(portValue, ddrMask);
      return true;
    };
    // The following hook is used by the timer compare output to override GPIO pins:
    cpu.gpioTimerHooks[portConfig.PORT] = (pin: u8, mode: PinOverrideMode) => {
      const pinMask = 1 << pin;
      if (mode == PinOverrideMode.None) {
        this.overrideMask |= pinMask;
      } else {
        this.overrideMask &= ~pinMask;
        switch (mode) {
          case PinOverrideMode.Enable:
            this.overrideValue &= ~pinMask;
            this.overrideValue |= cpu.data[portConfig.PORT] & pinMask;
            break;
          case PinOverrideMode.Set:
            this.overrideValue |= pinMask;
            break;
          case PinOverrideMode.Clear:
            this.overrideValue &= ~pinMask;
            break;
          case PinOverrideMode.Toggle:
            this.overrideValue ^= pinMask;
            break;
        }
      }
      this.writeGpio(cpu.data[portConfig.PORT], cpu.data[portConfig.DDR]);
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
      return this.lastValue & bitMask ? PinState.High : PinState.Low;
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

  private writeGpio(value: u8, ddr: u8) {
    const newValue = ((value & this.overrideMask) | this.overrideValue) & ddr;
    const prevValue = this.lastValue;
    if (newValue !== prevValue || ddr !== this.lastDdr) {
      this.lastValue = newValue;
      this.lastDdr = ddr;
      for (const listener of this.listeners) {
        listener(newValue, prevValue);
      }
    }
  }
}
