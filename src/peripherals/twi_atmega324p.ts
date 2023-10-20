import { TWIConfig } from './twi';
import { twiConfig as twiconfigAtmega328p } from './twi';

export const twiConfig: TWIConfig = {
  ...twiconfigAtmega328p,
  twiInterrupt: 0x34,
};
