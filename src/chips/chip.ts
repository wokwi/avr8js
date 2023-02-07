import { ADCConfig } from '../peripherals/adc';
import { AVRClockConfig } from '../peripherals/clock';
import { AVREEPROMConfig } from '../peripherals/eeprom';
import { AVRPortConfig } from '../peripherals/gpio';
import { SPIConfig } from '../peripherals/spi';
import { AVRTimerConfig } from '../peripherals/timer';
import { TWIConfig } from '../peripherals/twi';
import { USARTConfig } from '../peripherals/usart';

export interface Chip {
  flashSize: number;
  ramSize: number;
  eepromSize: number;
  registerSpace: number;
  defaultFrequency: number;
  clock: AVRClockConfig;
  eeprom?: AVREEPROMConfig;
  gpio: { [key: string]: AVRPortConfig };
  timers: AVRTimerConfig[];
  spi: SPIConfig[];
  usart: USARTConfig[];
  twi: TWIConfig[];
  adc: ADCConfig;
}
