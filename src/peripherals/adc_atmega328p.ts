import { ADCConfig, ADCMuxConfiguration, ADCMuxInputType, ADCReference } from './adc';

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

export const atmega328AdcConfig: ADCConfig = {
  ADMUX: 0x7c,
  ADCSRA: 0x7a,
  ADCSRB: 0x7b,
  ADCL: 0x78,
  ADCH: 0x79,

  ADPS_MASK: 0x7,
  ADIE: 0x8,
  ADIF: 0x10,
  ADSC: 0x40,
  ADEN: 0x80,

  MUX_MASK: 0xf,
  REFS_SHIFT: 0x6,
  REFS_MASK: 0x3,
  REFS2: 0,
  ADLAR: 0x20,
  MUX5: 0,

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
