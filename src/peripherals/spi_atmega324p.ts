import { SPIConfig } from './spi';
import { spiConfig as spiConfigAtmega328p } from './spi';

export const spiConfig: SPIConfig = {
  ...spiConfigAtmega328p,
  spiInterrupt: 0x26,
};
