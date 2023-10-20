import { portBConfig, portDConfig } from './gpio_atmega328p';
import { AVRTimerConfig, TimerDividers } from './timer';

/** These are differnet for some devices (e.g. ATtiny85) */
const defaultTimerBits = {
  // TIFR bits
  TOV: 1,
  OCFA: 2,
  OCFB: 4,
  OCFC: 0, // Unused

  // TIMSK bits
  TOIE: 1,
  OCIEA: 2,
  OCIEB: 4,
  OCIEC: 0, // Unused
};

const timer01Dividers: TimerDividers = {
  0: 0,
  1: 1,
  2: 8,
  3: 64,
  4: 256,
  5: 1024,
  6: 0, // External clock - see ExternalClockMode
  7: 0, // Ditto
};

export const timer0Config: AVRTimerConfig = {
  bits: 8,
  captureInterrupt: 0, // not available
  compAInterrupt: 0x1c,
  compBInterrupt: 0x1e,
  compCInterrupt: 0,
  ovfInterrupt: 0x20,
  TIFR: 0x35,
  OCRA: 0x47,
  OCRB: 0x48,
  OCRC: 0, // not available
  ICR: 0, // not available
  TCNT: 0x46,
  TCCRA: 0x44,
  TCCRB: 0x45,
  TCCRC: 0, // not available
  TIMSK: 0x6e,
  dividers: timer01Dividers,
  compPortA: portDConfig.PORT,
  compPinA: 6,
  compPortB: portDConfig.PORT,
  compPinB: 5,
  compPortC: 0, // Not available
  compPinC: 0,
  externalClockPort: portDConfig.PORT,
  externalClockPin: 4,
  ...defaultTimerBits,
};

export const timer1Config: AVRTimerConfig = {
  bits: 16,
  captureInterrupt: 0x14,
  compAInterrupt: 0x16,
  compBInterrupt: 0x18,
  compCInterrupt: 0,
  ovfInterrupt: 0x1a,
  TIFR: 0x36,
  OCRA: 0x88,
  OCRB: 0x8a,
  OCRC: 0, // not available
  ICR: 0x86,
  TCNT: 0x84,
  TCCRA: 0x80,
  TCCRB: 0x81,
  TCCRC: 0x82,
  TIMSK: 0x6f,
  dividers: timer01Dividers,
  compPortA: portBConfig.PORT,
  compPinA: 1,
  compPortB: portBConfig.PORT,
  compPinB: 2,
  compPortC: 0, // Not available
  compPinC: 0,
  externalClockPort: portDConfig.PORT,
  externalClockPin: 5,
  ...defaultTimerBits,
};

export const timer2Config: AVRTimerConfig = {
  bits: 8,
  captureInterrupt: 0, // not available
  compAInterrupt: 0x0e,
  compBInterrupt: 0x10,
  compCInterrupt: 0,
  ovfInterrupt: 0x12,
  TIFR: 0x37,
  OCRA: 0xb3,
  OCRB: 0xb4,
  OCRC: 0, // not available
  ICR: 0, // not available
  TCNT: 0xb2,
  TCCRA: 0xb0,
  TCCRB: 0xb1,
  TCCRC: 0, // not available
  TIMSK: 0x70,
  dividers: {
    0: 0,
    1: 1,
    2: 8,
    3: 32,
    4: 64,
    5: 128,
    6: 256,
    7: 1024,
  },
  compPortA: portBConfig.PORT,
  compPinA: 3,
  compPortB: portDConfig.PORT,
  compPinB: 3,
  compPortC: 0, // Not available
  compPinC: 0,
  externalClockPort: 0, // Not available
  externalClockPin: 0,
  ...defaultTimerBits,
};
