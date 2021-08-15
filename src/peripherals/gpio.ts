/**
 * AVR-8 GPIO Port implementation
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */
import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface AVRExternalInterrupt {
  EICRA: u8;
  EICRB: u8;
  EIMSK: u8;
  EIFR: u8;
  index: u8; // 0..7
  interrupt: u8;
}

export interface AVRPinChangeInterrupt {
  PCIE: u8; // bit index in PCICR/PCIFR
  PCICR: u8;
  PCIFR: u8;
  PCMSK: u8;
  pinChangeInterrupt: u8;
  mask: u8;
  offset: u8;
}

export interface AVRPortConfig {
  // Register addresses
  PIN: u8;
  DDR: u8;
  PORT: u8;

  // Interrupt settings
  pinChange?: AVRPinChangeInterrupt;
  externalInterrupts: (AVRExternalInterrupt | null)[];
}

export const INT0: AVRExternalInterrupt = {
  EICRA: 0x69,
  EICRB: 0,
  EIMSK: 0x3d,
  EIFR: 0x3c,
  index: 0,
  interrupt: 2,
};

export const INT1: AVRExternalInterrupt = {
  EICRA: 0x69,
  EICRB: 0,
  EIMSK: 0x3d,
  EIFR: 0x3c,
  index: 1,
  interrupt: 4,
};

export const PCINT0 = {
  PCIE: 0,
  PCICR: 0x68,
  PCIFR: 0x3b,
  PCMSK: 0x6b,
  pinChangeInterrupt: 6,
  mask: 0xff,
  offset: 0,
};

export const PCINT1 = {
  PCIE: 1,
  PCICR: 0x68,
  PCIFR: 0x3b,
  PCMSK: 0x6c,
  pinChangeInterrupt: 8,
  mask: 0xff,
  offset: 0,
};

export const PCINT2 = {
  PCIE: 2,
  PCICR: 0x68,
  PCIFR: 0x3b,
  PCMSK: 0x6d,
  pinChangeInterrupt: 10,
  mask: 0xff,
  offset: 0,
};

export type GPIOListener = (value: u8, oldValue: u8) => void;
export type ExternalClockListener = (pinValue: boolean) => void;

export const portAConfig: AVRPortConfig = {
  PIN: 0x20,
  DDR: 0x21,
  PORT: 0x22,
  externalInterrupts: [],
};

export const portBConfig: AVRPortConfig = {
  PIN: 0x23,
  DDR: 0x24,
  PORT: 0x25,

  // Interrupt settings
  pinChange: PCINT0,
  externalInterrupts: [],
};

export const portCConfig: AVRPortConfig = {
  PIN: 0x26,
  DDR: 0x27,
  PORT: 0x28,

  // Interrupt settings
  pinChange: PCINT1,
  externalInterrupts: [],
};

export const portDConfig: AVRPortConfig = {
  PIN: 0x29,
  DDR: 0x2a,
  PORT: 0x2b,

  // Interrupt settings
  pinChange: PCINT2,
  externalInterrupts: [null, null, INT0, INT1],
};

export const portEConfig: AVRPortConfig = {
  PIN: 0x2c,
  DDR: 0x2d,
  PORT: 0x2e,
  externalInterrupts: [],
};

export const portFConfig: AVRPortConfig = {
  PIN: 0x2f,
  DDR: 0x30,
  PORT: 0x31,
  externalInterrupts: [],
};

export const portGConfig: AVRPortConfig = {
  PIN: 0x32,
  DDR: 0x33,
  PORT: 0x34,
  externalInterrupts: [],
};

export const portHConfig: AVRPortConfig = {
  PIN: 0x100,
  DDR: 0x101,
  PORT: 0x102,
  externalInterrupts: [],
};

export const portJConfig: AVRPortConfig = {
  PIN: 0x103,
  DDR: 0x104,
  PORT: 0x105,
  externalInterrupts: [],
};

export const portKConfig: AVRPortConfig = {
  PIN: 0x106,
  DDR: 0x107,
  PORT: 0x108,
  externalInterrupts: [],
};

export const portLConfig: AVRPortConfig = {
  PIN: 0x109,
  DDR: 0x10a,
  PORT: 0x10b,
  externalInterrupts: [],
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

enum InterruptMode {
  LowLevel,
  Change,
  FallingEdge,
  RisingEdge,
}

export class AVRIOPort {
  readonly externalClockListeners: (ExternalClockListener | null)[] = [];

  private readonly externalInts: (AVRInterruptConfig | null)[];
  private readonly PCINT: AVRInterruptConfig | null;
  private listeners: GPIOListener[] = [];
  private pinValue: u8 = 0;
  private overrideMask: u8 = 0xff;
  private overrideValue: u8 = 0;
  private lastValue: u8 = 0;
  private lastDdr: u8 = 0;
  private lastPin: u8 = 0;

  constructor(private cpu: CPU, readonly portConfig: Readonly<AVRPortConfig>) {
    cpu.gpioPorts.add(this);
    cpu.gpioByPort[portConfig.PORT] = this;

    cpu.writeHooks[portConfig.DDR] = (value: u8) => {
      const portValue = cpu.data[portConfig.PORT];
      cpu.data[portConfig.DDR] = value;
      this.writeGpio(portValue, value);
      this.updatePinRegister(value);
      return true;
    };
    cpu.writeHooks[portConfig.PORT] = (value: u8) => {
      const ddrMask = cpu.data[portConfig.DDR];
      cpu.data[portConfig.PORT] = value;
      this.writeGpio(value, ddrMask);
      this.updatePinRegister(ddrMask);
      return true;
    };
    cpu.writeHooks[portConfig.PIN] = (value: u8) => {
      // Writing to 1 PIN toggles PORT bits
      const oldPortValue = cpu.data[portConfig.PORT];
      const ddrMask = cpu.data[portConfig.DDR];
      const portValue = oldPortValue ^ value;
      cpu.data[portConfig.PORT] = portValue;
      this.writeGpio(portValue, ddrMask);
      this.updatePinRegister(ddrMask);
      return true;
    };

    // External interrupts
    const { externalInterrupts } = portConfig;
    this.externalInts = externalInterrupts.map((externalConfig) =>
      externalConfig
        ? {
            address: externalConfig.interrupt,
            flagRegister: externalConfig.EIFR,
            flagMask: 1 << externalConfig.index,
            enableRegister: externalConfig.EIMSK,
            enableMask: 1 << externalConfig.index,
          }
        : null
    );
    const EICRA = externalInterrupts.find((item) => item && item.EICRA)?.EICRA ?? 0;
    this.attachInterruptHook(EICRA);
    const EICRB = externalInterrupts.find((item) => item && item.EICRB)?.EICRB ?? 0;
    this.attachInterruptHook(EICRB);
    const EIMSK = externalInterrupts.find((item) => item && item.EIMSK)?.EIMSK ?? 0;
    this.attachInterruptHook(EIMSK, 'mask');
    const EIFR = externalInterrupts.find((item) => item && item.EIFR)?.EIFR ?? 0;
    this.attachInterruptHook(EIFR, 'flag');

    // Pin change interrupts
    const { pinChange } = portConfig;
    this.PCINT = pinChange
      ? {
          address: pinChange.pinChangeInterrupt,
          flagRegister: pinChange.PCIFR,
          flagMask: 1 << pinChange.PCIE,
          enableRegister: pinChange.PCICR,
          enableMask: 1 << pinChange.PCIE,
        }
      : null;
    if (pinChange) {
      const { PCIFR, PCMSK } = pinChange;
      cpu.writeHooks[PCIFR] = (value) => {
        for (const gpio of this.cpu.gpioPorts) {
          const { PCINT } = gpio;
          if (PCINT) {
            cpu.clearInterruptByFlag(PCINT, value);
          }
        }
        return true;
      };
      cpu.writeHooks[PCMSK] = (value) => {
        cpu.data[PCMSK] = value;
        for (const gpio of this.cpu.gpioPorts) {
          const { PCINT } = gpio;
          if (PCINT) {
            cpu.updateInterruptEnable(PCINT, value);
          }
        }
        return true;
      };
    }
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
    this.updatePinRegister(this.cpu.data[this.portConfig.DDR]);
  }

  /**
   * Internal method - do not call this directly!
   * Used by the timer compare output units to override GPIO pins.
   */
  timerOverridePin(pin: u8, mode: PinOverrideMode) {
    const { cpu, portConfig } = this;
    const pinMask = 1 << pin;
    if (mode === PinOverrideMode.None) {
      this.overrideMask |= pinMask;
      this.overrideValue &= ~pinMask;
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
    const ddrMask = cpu.data[portConfig.DDR];
    this.writeGpio(cpu.data[portConfig.PORT], ddrMask);
    this.updatePinRegister(ddrMask);
  }

  private updatePinRegister(ddr: u8) {
    const newPin = (this.pinValue & ~ddr) | (this.lastValue & ddr);
    this.cpu.data[this.portConfig.PIN] = newPin;
    if (this.lastPin !== newPin) {
      for (let index = 0; index < 8; index++) {
        if ((newPin & (1 << index)) !== (this.lastPin & (1 << index))) {
          const value = !!(newPin & (1 << index));
          this.toggleInterrupt(index, value);
          this.externalClockListeners[index]?.(value);
        }
      }
      this.lastPin = newPin;
    }
  }

  private toggleInterrupt(pin: u8, risingEdge: boolean) {
    const { cpu, portConfig, externalInts, PCINT } = this;
    const { externalInterrupts, pinChange } = portConfig;
    const externalConfig = externalInterrupts[pin];
    const external = externalInts[pin];
    if (external && externalConfig) {
      const { index, EICRA, EICRB, EIMSK } = externalConfig;
      if (cpu.data[EIMSK] & (1 << index)) {
        const configRegister = index >= 4 ? EICRB : EICRA;
        const configShift = (index % 4) * 2;
        const configuration = (cpu.data[configRegister] >> configShift) & 0x3;
        let generateInterrupt = false;
        external.constant = false;
        switch (configuration) {
          case InterruptMode.LowLevel:
            generateInterrupt = !risingEdge;
            external.constant = true;
            break;
          case InterruptMode.Change:
            generateInterrupt = true;
            break;
          case InterruptMode.FallingEdge:
            generateInterrupt = !risingEdge;
            break;
          case InterruptMode.RisingEdge:
            generateInterrupt = risingEdge;
            break;
        }
        if (generateInterrupt) {
          cpu.setInterruptFlag(external);
        } else if (external.constant) {
          cpu.clearInterrupt(external, true);
        }
      }
    }

    if (pinChange && PCINT && pinChange.mask & (1 << pin)) {
      const { PCMSK } = pinChange;
      if (cpu.data[PCMSK] & (1 << (pin + pinChange.offset))) {
        cpu.setInterruptFlag(PCINT);
      }
    }
  }

  private attachInterruptHook(register: number, registerType: 'flag' | 'mask' | 'other' = 'other') {
    if (!register) {
      return;
    }

    const { cpu } = this;

    cpu.writeHooks[register] = (value: u8) => {
      if (registerType !== 'flag') {
        cpu.data[register] = value;
      }
      for (const gpio of cpu.gpioPorts) {
        for (const external of gpio.externalInts) {
          if (external && registerType === 'mask') {
            cpu.updateInterruptEnable(external, value);
          }
          if (external && !external.constant && registerType === 'flag') {
            cpu.clearInterruptByFlag(external, value);
          }
        }

        gpio.checkExternalInterrupts();
      }

      return true;
    };
  }

  private checkExternalInterrupts() {
    const { cpu } = this;
    const { externalInterrupts } = this.portConfig;
    for (let pin = 0; pin < 8; pin++) {
      const external = externalInterrupts[pin];
      if (!external) {
        continue;
      }
      const pinValue = !!(this.lastPin & (1 << pin));
      const { index, EICRA, EICRB, EIMSK, EIFR, interrupt } = external;
      if (!(cpu.data[EIMSK] & (1 << index)) || pinValue) {
        continue;
      }
      const configRegister = index >= 4 ? EICRB : EICRA;
      const configShift = (index % 4) * 2;
      const configuration = (cpu.data[configRegister] >> configShift) & 0x3;
      if (configuration === InterruptMode.LowLevel) {
        cpu.queueInterrupt({
          address: interrupt,
          flagRegister: EIFR,
          flagMask: 1 << index,
          enableRegister: EIMSK,
          enableMask: 1 << index,
          constant: true,
        });
      }
    }
  }

  private writeGpio(value: u8, ddr: u8) {
    const newValue = (((value & this.overrideMask) | this.overrideValue) & ddr) | (value & ~ddr);
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
