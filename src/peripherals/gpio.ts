/**
 * AVR-8 GPIO Port implementation
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019-2023 Uri Shaked
 */
import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface AVRExternalInterrupt {
  /** either EICRA or EICRB, depending on which register holds the ISCx0/ISCx1 bits for this interrupt */
  EICR: u8;
  EIMSK: u8;
  EIFR: u8;

  /* Offset of the ISCx0/ISCx1 bits in the EICRx register */
  iscOffset: u8;

  /** Bit index in the EIMSK / EIFR registers */
  index: u8; // 0..7

  /** Interrupt vector index */
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

export type GPIOListener = (value: u8, oldValue: u8) => void;
export type ExternalClockListener = (pinValue: boolean) => void;

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
  openCollector: u8 = 0;

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
    cpu.writeHooks[portConfig.PIN] = (value: u8, oldValue, addr, mask) => {
      // Writing to 1 PIN toggles PORT bits
      const oldPortValue = cpu.data[portConfig.PORT];
      const ddrMask = cpu.data[portConfig.DDR];
      const portValue = oldPortValue ^ (value & mask);
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
    const EICR = new Set(externalInterrupts.map((item) => item?.EICR));
    for (const EICRx of EICR) {
      this.attachInterruptHook(EICRx || 0);
    }
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
    const openState = port & bitMask ? PinState.InputPullUp : PinState.Input;
    const highValue = this.openCollector & bitMask ? openState : PinState.High;
    if (ddr & bitMask) {
      return this.lastValue & bitMask ? highValue : PinState.Low;
    } else {
      return openState;
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
      const { EIMSK, index, EICR, iscOffset } = externalConfig;
      if (cpu.data[EIMSK] & (1 << index)) {
        const configuration = (cpu.data[EICR] >> iscOffset) & 0x3;
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
      const { EIFR, EIMSK, index, EICR, iscOffset, interrupt } = external;
      if (!(cpu.data[EIMSK] & (1 << index)) || pinValue) {
        continue;
      }
      const configuration = (cpu.data[EICR] >> iscOffset) & 0x3;
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
