/**
 * AVR-8 ADC
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */

import { ICPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface ADCConfig {
  ADMUX: u8;
  ADCSRA: u8;
  ADCSRB: u8;
  ADCL: u8;
  ADCH: u8;
  DIDR0: u8;
  adcInterrupt: u8;
}

export const adcConfig: ADCConfig = {
  ADMUX: 0x7c,
  ADCSRA: 0x7a,
  ADCSRB: 0x7b,
  ADCL: 0x78,
  ADCH: 0x79,
  DIDR0: 0x7e,
  adcInterrupt: 0x2a,
};

export class AVRADC {
  constructor(private CPU: ICPU, private config: ADCConfig) {}
}
