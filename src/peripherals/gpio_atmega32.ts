import { AVRPortConfig } from './gpio';

export const atmega32PortAConfig: AVRPortConfig = {
  PORT: 0x3b,
  DDR: 0x3a,
  PIN: 0x39,
  externalInterrupts: [],
};

export const atmega32PortBConfig: AVRPortConfig = {
  PORT: 0x38,
  DDR: 0x37,
  PIN: 0x36,
  externalInterrupts: [],
};

export const atmega32PortCConfig: AVRPortConfig = {
  PORT: 0x35,
  DDR: 0x34,
  PIN: 0x33,
  externalInterrupts: [],
};

export const atmega32PortDConfig: AVRPortConfig = {
  PORT: 0x32,
  DDR: 0x31,
  PIN: 0x30,
  externalInterrupts: [],
};
