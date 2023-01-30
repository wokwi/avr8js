import { atmega32PortBConfig, atmega32PortDConfig } from './gpio_atmega32';
import { AVRTimerConfig, TimerDividers } from './timer';

const atmega32TimerDividers: TimerDividers = {
  0: 0,
  1: 1,
  2: 8,
  3: 64,
  4: 256,
  5: 1024,
  6: 0, // External clock - see ExternalClockMode
  7: 0, // Ditto
};

export const atmga32Timer0Config: AVRTimerConfig = {
  bits: 8,
  dividers: atmega32TimerDividers,

  // Interrupt vectors
  captureInterrupt: 0, // not used,
  compAInterrupt: 0x14,
  compBInterrupt: 0, // not used,
  compCInterrupt: 0, // not used,
  ovfInterrupt: 0x16,

  // Register addresses
  TIFR: 0x58,
  OCRA: 0x5c,
  OCRB: 0, // No timer 0 OCRB on Atmega32
  OCRC: 0, // No timer 0 OCRC on Atmega32
  ICR: 0, // not avilible,
  TCNT: 0x52,
  TCCRA: 0x53,
  TCCRB: 0, // No timer 0 TCCRB on Atmega32
  TCCRC: 0, // No TCCRC on Atmega32,
  TIMSK: 0x59,

  // TIFR bits
  TOV: 1 << 0,
  OCFA: 1 << 1,
  OCFB: 0, // No timer 0 OCFB on Atmega32
  OCFC: 0, // No OCFC on Atmega32,

  // TIMSK bits
  TOIE: 1 << 0,
  OCIEA: 1 << 1,
  OCIEB: 0, // No OCIEB on Atmega32
  OCIEC: 0, // No OCFC on Atmega32,

  // Output compare pins
  compPortA: atmega32PortBConfig.PORT,
  compPinA: 3,
  compPortB: 0, // Not available
  compPinB: 0, // Not available
  compPortC: 0, // Not available
  compPinC: 0, // Not available

  externalClockPort: 0, // Unimplement ? Not available
  externalClockPin: 0, // Unimplement ? Not available
};

export const atmga32Timer1Config: AVRTimerConfig = {
  bits: 16,
  dividers: atmega32TimerDividers,

  // Interrupt vectors
  captureInterrupt: 0x0c,
  compAInterrupt: 0x0e,
  compBInterrupt: 0x10,
  compCInterrupt: 0, // not used,
  ovfInterrupt: 0x12,

  // Register addresses
  TIFR: 0x58,
  OCRA: 0x4a,
  OCRB: 0x48,
  OCRC: 0, // Optional, 0 = unused
  ICR: 0x46,
  TCNT: 0x4c,
  TCCRA: 0x4f,
  TCCRB: 0x4e,
  TCCRC: 0, // No TCCRC on Atmega32,
  TIMSK: 0x59,

  // TIFR bits
  TOV: 1 << 2,
  OCFA: 1 << 4,
  OCFB: 1 << 3,
  OCFC: 0, // No OCFC on Atmega32,

  // TIMSK bits
  TOIE: 1 << 2,
  OCIEA: 1 << 4,
  OCIEB: 1 << 3,
  OCIEC: 0, // No OCFC on Atmega32,

  // Output compare pins
  compPortA: atmega32PortDConfig.PORT,
  compPinA: 5,
  compPortB: atmega32PortDConfig.PORT,
  compPinB: 4,
  compPortC: 0, // Not available
  compPinC: 0, // Not available

  externalClockPort: 0, // Unimplemented ? Not available
  externalClockPin: 0, // Unimplemented ? Not available
};

export const atmga32Timer2Config: AVRTimerConfig = {
  bits: 8,
  dividers: atmega32TimerDividers,

  // Interrupt vectors
  captureInterrupt: 0, // not used,
  compAInterrupt: 0x08, // not used,
  compBInterrupt: 0, // not used,
  compCInterrupt: 0, // not used,
  ovfInterrupt: 0x0a,

  // Register addresses
  TIFR: 0x58,
  OCRA: 0x43,
  OCRB: 0, // No timer 2 OCRB on Atmega32
  OCRC: 0, // Optional, 0 = unused
  ICR: 0, // not avilible,
  TCNT: 0x44,
  TCCRA: 0x45,
  TCCRB: 0, // No timer 2 TCCRB on Atmega32
  TCCRC: 0, // No TCCRC on Atmega32,
  TIMSK: 0x59,

  // TIFR bits
  TOV: 1 << 6,
  OCFA: 1 << 7,
  OCFB: 0, // No timer 2 OCFB on Atmega32
  OCFC: 0, // No OCFC on Atmega32,

  // TIMSK bits
  TOIE: 1 << 6,
  OCIEA: 1 << 7,
  OCIEB: 0, // No timer 2 OCIEB on Atmega32
  OCIEC: 0, // No OCFC on Atmega32,

  // Output compare pins
  compPortA: atmega32PortBConfig.PORT,
  compPinA: 3,
  compPortB: 0, // Not available
  compPinB: 0, // Not available
  compPortC: 0, // Not available
  compPinC: 0, // Not available

  externalClockPort: 0, // Unimplement ? Not available
  externalClockPin: 0, // Unimplement ? Not available
};
