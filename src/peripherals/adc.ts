/**
 * AVR-8 ADC
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */

import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export enum ADCReference {
  AVCC,
  AREF,
  Internal1V1,
  Internal2V56,
  Reserved,
}

export enum ADCMuxInputType {
  SingleEnded,
  Differential,
  Constant,
  Temperature,
}

export type ADCMuxInput =
  | { type: ADCMuxInputType.Temperature }
  | { type: ADCMuxInputType.Constant; voltage: number }
  | { type: ADCMuxInputType.SingleEnded; channel: number }
  | {
      type: ADCMuxInputType.Differential;
      positiveChannel: number;
      negativeChannel: number;
      gain: number;
    };

export type ADCMuxConfiguration = { [key: number]: ADCMuxInput };

// ATMega32 vs 328p: 32 has No ADCSRB. 32 has MUX4 in ADCSRA, only difference
// 2650: MUX5 exists in ADCSRB

export interface ADCConfig {
  // Register addresses
  ADMUX: u8;
  ADCSRA: u8;
  ADCSRB: u8; // Optional, 0 = unsupported
  ADCL: u8;
  ADCH: u8;

  // ADCSRA bits
  ADPS_MASK: u8;
  ADIE: u8;
  ADIF: u8;
  ADSC: u8;
  ADEN: u8;

  // ADMUX bits
  MUX_MASK: u8;
  REFS_SHIFT: u8;
  REFS_MASK: u8;
  REFS2: u8; // Optional, 0 = unsupported
  ADLAR: u8;

  // ADCSRB bits
  MUX5: u8; // Optional, 0 = unsupported. Also not used if ADCSRB === 0

  adcInterrupt: u8;
  numChannels: u8;
  muxInputMask: u8;
  muxChannels: ADCMuxConfiguration;
  adcReferences: ADCReference[];
}

const fallbackMuxInput = {
  type: ADCMuxInputType.Constant,
  voltage: 0,
};

export class AVRADC {
  /**
   * ADC Channel values, in voltage (0..5). The number of channels depends on the chip.
   *
   * Changing the values here will change the ADC reading, unless you override onADCRead() with a custom implementation.
   */
  readonly channelValues = new Array(this.config.numChannels);

  /** AVCC Reference voltage */
  avcc = 5;

  /** AREF Reference voltage */
  aref = 5;

  private hasADCSRB = this.config.ADCSRB > 0;

  /**
   * Invoked whenever the code performs an ADC read.
   *
   * The default implementation reads the result from the `channelValues` array, and then calls
   * `completeADCRead()` after `sampleCycles` CPU cycles.
   *
   * If you override the default implementation, make sure to call `completeADCRead()` after
   * `sampleCycles` cycles (or else the ADC read will never complete).
   */
  onADCRead: (input: ADCMuxInput) => void = (input) => {
    // Default implementation
    let voltage = 0;
    switch (input.type) {
      case ADCMuxInputType.Constant:
        voltage = input.voltage;
        break;
      case ADCMuxInputType.SingleEnded:
        voltage = this.channelValues[input.channel] ?? 0;
        break;
      case ADCMuxInputType.Differential:
        voltage =
          input.gain *
          ((this.channelValues[input.positiveChannel] || 0) -
            (this.channelValues[input.negativeChannel] || 0));
        break;
      case ADCMuxInputType.Temperature:
        voltage = 0.378125; // 25 celcius
        break;
    }
    const rawValue = (voltage / this.referenceVoltage) * 1024;
    const result = Math.min(Math.max(Math.floor(rawValue), 0), 1023);
    this.cpu.addClockEvent(() => this.completeADCRead(result), this.sampleCycles);
  };

  private converting = false;
  private conversionCycles = 25;

  // Interrupts
  private ADC: AVRInterruptConfig = {
    address: this.config.adcInterrupt,
    flagRegister: this.config.ADCSRA,
    flagMask: this.config.ADIF,
    enableRegister: this.config.ADCSRA,
    enableMask: this.config.ADIE,
  };

  constructor(private cpu: CPU, private config: ADCConfig) {
    cpu.writeHooks[config.ADCSRA] = (value, oldValue) => {
      if (value & this.config.ADEN && !(oldValue && this.config.ADEN)) {
        this.conversionCycles = 25;
      }
      cpu.data[config.ADCSRA] = value;
      cpu.updateInterruptEnable(this.ADC, value);
      if (!this.converting && value & this.config.ADSC) {
        if (!(value & this.config.ADEN)) {
          // Special case: reading while the ADC is not enabled should return 0
          this.cpu.addClockEvent(() => this.completeADCRead(0), this.sampleCycles);
          return true;
        }
        let channel = this.cpu.data[this.config.ADMUX] & this.config.MUX_MASK;
        if (this.hasADCSRB && cpu.data[config.ADCSRB] & this.config.MUX5) {
          channel |= 0x20;
        }
        channel &= config.muxInputMask;
        const muxInput = config.muxChannels[channel] ?? fallbackMuxInput;
        this.converting = true;
        this.onADCRead(muxInput);
        return true; // don't update
      }
    };
  }

  completeADCRead(value: number) {
    const { ADCL, ADCH, ADMUX, ADCSRA } = this.config;
    this.converting = false;
    this.conversionCycles = 13;
    if (this.cpu.data[ADMUX] & this.config.ADLAR) {
      this.cpu.data[ADCL] = (value << 6) & 0xff;
      this.cpu.data[ADCH] = value >> 2;
    } else {
      this.cpu.data[ADCL] = value & 0xff;
      this.cpu.data[ADCH] = (value >> 8) & 0x3;
    }
    this.cpu.data[ADCSRA] &= ~this.config.ADSC;
    this.cpu.setInterruptFlag(this.ADC);
  }

  get prescaler() {
    const { ADCSRA } = this.config;
    const adcsra = this.cpu.data[ADCSRA];
    const adps = adcsra & this.config.ADPS_MASK;
    switch (adps) {
      case 0:
      case 1:
        return 2;
      case 2:
        return 4;
      case 3:
        return 8;
      case 4:
        return 16;
      case 5:
        return 32;
      case 6:
        return 64;
      case 7:
      default:
        return 128;
    }
  }

  get referenceVoltageType() {
    const { ADMUX, adcReferences } = this.config;
    let refs = (this.cpu.data[ADMUX] >> this.config.REFS_SHIFT) & this.config.REFS_MASK;
    if (adcReferences.length > 4 && this.cpu.data[ADMUX] & this.config.REFS2) {
      refs |= 0x4;
    }
    return adcReferences[refs] ?? ADCReference.Reserved;
  }

  get referenceVoltage() {
    switch (this.referenceVoltageType) {
      case ADCReference.AVCC:
        return this.avcc;
      case ADCReference.AREF:
        return this.aref;
      case ADCReference.Internal1V1:
        return 1.1;
      case ADCReference.Internal2V56:
        return 2.56;
      default:
        return this.avcc;
    }
  }

  get sampleCycles() {
    return this.conversionCycles * this.prescaler;
  }
}
