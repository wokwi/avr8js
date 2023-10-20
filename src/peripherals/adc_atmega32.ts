import { ADCConfig, ADCMuxConfiguration, ADCMuxInputType, ADCReference } from './adc';

export const atmega32Channels: ADCMuxConfiguration = {
  0: { type: ADCMuxInputType.SingleEnded, channel: 0 },
  1: { type: ADCMuxInputType.SingleEnded, channel: 1 },
  2: { type: ADCMuxInputType.SingleEnded, channel: 2 },
  3: { type: ADCMuxInputType.SingleEnded, channel: 3 },
  4: { type: ADCMuxInputType.SingleEnded, channel: 4 },
  5: { type: ADCMuxInputType.SingleEnded, channel: 5 },
  6: { type: ADCMuxInputType.SingleEnded, channel: 6 },
  7: { type: ADCMuxInputType.SingleEnded, channel: 7 },
  8: { type: ADCMuxInputType.Differential, positiveChannel: 0, negativeChannel: 0, gain: 10 },
  9: { type: ADCMuxInputType.Differential, positiveChannel: 1, negativeChannel: 0, gain: 10 },
  10: { type: ADCMuxInputType.Differential, positiveChannel: 0, negativeChannel: 0, gain: 200 },
  11: { type: ADCMuxInputType.Differential, positiveChannel: 1, negativeChannel: 0, gain: 200 },
  12: { type: ADCMuxInputType.Differential, positiveChannel: 2, negativeChannel: 2, gain: 10 },
  13: { type: ADCMuxInputType.Differential, positiveChannel: 3, negativeChannel: 2, gain: 10 },
  14: { type: ADCMuxInputType.Differential, positiveChannel: 2, negativeChannel: 2, gain: 200 },
  15: { type: ADCMuxInputType.Differential, positiveChannel: 3, negativeChannel: 2, gain: 200 },
  16: { type: ADCMuxInputType.Differential, positiveChannel: 0, negativeChannel: 1, gain: 1 },
  17: { type: ADCMuxInputType.Differential, positiveChannel: 1, negativeChannel: 1, gain: 1 },
  18: { type: ADCMuxInputType.Differential, positiveChannel: 2, negativeChannel: 1, gain: 1 },
  19: { type: ADCMuxInputType.Differential, positiveChannel: 3, negativeChannel: 1, gain: 1 },
  20: { type: ADCMuxInputType.Differential, positiveChannel: 4, negativeChannel: 1, gain: 1 },
  21: { type: ADCMuxInputType.Differential, positiveChannel: 5, negativeChannel: 1, gain: 1 },
  22: { type: ADCMuxInputType.Differential, positiveChannel: 6, negativeChannel: 1, gain: 1 },
  23: { type: ADCMuxInputType.Differential, positiveChannel: 7, negativeChannel: 1, gain: 1 },
  24: { type: ADCMuxInputType.Differential, positiveChannel: 0, negativeChannel: 2, gain: 1 },
  25: { type: ADCMuxInputType.Differential, positiveChannel: 1, negativeChannel: 2, gain: 1 },
  26: { type: ADCMuxInputType.Differential, positiveChannel: 2, negativeChannel: 2, gain: 1 },
  27: { type: ADCMuxInputType.Differential, positiveChannel: 3, negativeChannel: 2, gain: 1 },
  28: { type: ADCMuxInputType.Differential, positiveChannel: 4, negativeChannel: 2, gain: 1 },
  29: { type: ADCMuxInputType.Differential, positiveChannel: 5, negativeChannel: 2, gain: 1 },
  30: { type: ADCMuxInputType.Constant, voltage: 1.22 },
  31: { type: ADCMuxInputType.Constant, voltage: 0 },
};

export const adcConfig: ADCConfig = {
  ADMUX: 0x27,
  ADCSRA: 0x26,
  ADCSRB: 0, // Not aviliable on ATmega32
  ADCL: 0x24,
  ADCH: 0x25,

  // ADCSRA bits
  ADPS_MASK: 0x7,
  ADIE: 0x8,
  ADIF: 0x10,
  ADSC: 0x40,
  ADEN: 0x80,

  // ADMUX bits
  MUX_MASK: 0x1f,
  REFS_SHIFT: 0x6,
  REFS_MASK: 0x3,
  REFS2: 0, // Not supported
  ADLAR: 0x20,
  MUX5: 0,

  adcInterrupt: 0x20,
  numChannels: 32,
  muxInputMask: 0x1f,
  muxChannels: atmega32Channels,

  adcReferences: [
    ADCReference.AREF,
    ADCReference.AVCC,
    ADCReference.Reserved,
    ADCReference.Internal2V56,
  ],
};
