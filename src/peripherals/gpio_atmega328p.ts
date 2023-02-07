import { AVRExternalInterrupt, AVRPortConfig } from './gpio';

export const INT0: AVRExternalInterrupt = {
  EICR: 0x69,
  EIMSK: 0x3d,
  EIFR: 0x3c,
  index: 0,
  iscOffset: 0,
  interrupt: 2,
};

export const INT1: AVRExternalInterrupt = {
  EICR: 0x69,
  EIMSK: 0x3d,
  EIFR: 0x3c,
  index: 1,
  iscOffset: 2,
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