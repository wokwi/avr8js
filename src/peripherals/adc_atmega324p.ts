import { ADCConfig } from './adc';
import { adcConfig as adcConfigAtmega328p } from './adc_atmega328p';

export const adcConfig: ADCConfig = {
  ...adcConfigAtmega328p,
  adcInterrupt: 0x2a,
};
