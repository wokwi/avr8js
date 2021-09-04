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

export interface ADCConfig {
  ADMUX: u8;
  ADCSRA: u8;
  ADCSRB: u8;
  ADCL: u8;
  ADCH: u8;
  DIDR0: u8;
  adcInterrupt: u8;
  numChannels: u8;
  muxInputMask: u8;
  muxChannels: ADCMuxConfiguration;
  adcReferences: ADCReference[];
}

export const atmega328Channels: ADCMuxConfiguration = {
  0: { type: ADCMuxInputType.SingleEnded, channel: 0 },
  1: { type: ADCMuxInputType.SingleEnded, channel: 1 },
  2: { type: ADCMuxInputType.SingleEnded, channel: 2 },
  3: { type: ADCMuxInputType.SingleEnded, channel: 3 },
  4: { type: ADCMuxInputType.SingleEnded, channel: 4 },
  5: { type: ADCMuxInputType.SingleEnded, channel: 5 },
  6: { type: ADCMuxInputType.SingleEnded, channel: 6 },
  7: { type: ADCMuxInputType.SingleEnded, channel: 7 },
  8: { type: ADCMuxInputType.Temperature },
  14: { type: ADCMuxInputType.Constant, voltage: 1.1 },
  15: { type: ADCMuxInputType.Constant, voltage: 0 },
};

const fallbackMuxInput = {
  type: ADCMuxInputType.Constant,
  voltage: 0,
};

export const adcConfig: ADCConfig = {
  ADMUX: 0x7c,
  ADCSRA: 0x7a,
  ADCSRB: 0x7b,
  ADCL: 0x78,
  ADCH: 0x79,
  DIDR0: 0x7e,
  adcInterrupt: 0x2a,
  numChannels: 8,
  muxInputMask: 0xf,
  muxChannels: atmega328Channels,
  adcReferences: [
    ADCReference.AREF,
    ADCReference.AVCC,
    ADCReference.Reserved,
    ADCReference.Internal1V1,
  ],
};

// Register bits:
const ADPS_MASK = 0x7;
const ADIE = 0x8;
const ADIF = 0x10;
const ADSC = 0x40;
const ADEN = 0x80;

const MUX_MASK = 0x1f;
const ADLAR = 0x20;
const MUX5 = 0x8;
const REFS2 = 0x8;
const REFS_MASK = 0x3;
const REFS_SHIFT = 6;

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
    flagMask: ADIF,
    enableRegister: this.config.ADCSRA,
    enableMask: ADIE,
  };

  constructor(private cpu: CPU, private config: ADCConfig) {
    cpu.writeHooks[config.ADCSRA] = (value, oldValue) => {
      if (value & ADEN && !(oldValue && ADEN)) {
        this.conversionCycles = 25;
      }
      cpu.data[config.ADCSRA] = value;
      cpu.updateInterruptEnable(this.ADC, value);
      if (!this.converting && value & ADEN && value & ADSC) {
        let channel = this.cpu.data[this.config.ADMUX] & MUX_MASK;
        if (cpu.data[config.ADCSRB] & MUX5) {
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
    if (this.cpu.data[ADMUX] & ADLAR) {
      this.cpu.data[ADCL] = (value << 6) & 0xff;
      this.cpu.data[ADCH] = value >> 2;
    } else {
      this.cpu.data[ADCL] = value & 0xff;
      this.cpu.data[ADCH] = (value >> 8) & 0x3;
    }
    this.cpu.data[ADCSRA] &= ~ADSC;
    this.cpu.setInterruptFlag(this.ADC);
  }

  get prescaler() {
    const { ADCSRA } = this.config;
    const adcsra = this.cpu.data[ADCSRA];
    const adps = adcsra & ADPS_MASK;
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
    let refs = (this.cpu.data[ADMUX] >> REFS_SHIFT) & REFS_MASK;
    if (adcReferences.length > 4 && this.cpu.data[ADMUX] & REFS2) {
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
