import { AVREEPROMConfig } from './eeprom';
import { eepromConfig as eepromConfigAtmega328p } from './eeprom';

export const eepromConfig: AVREEPROMConfig = {
  ...eepromConfigAtmega328p,
  eepromReadyInterrupt: 0x32,
};
