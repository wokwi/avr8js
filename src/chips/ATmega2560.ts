import { adcConfig } from '../peripherals/adc_atmega328p';
import { clockConfig } from '../peripherals/clock';
import { eepromConfig } from '../peripherals/eeprom';
import {
  portAConfig,
  portEConfig,
  portFConfig,
  portGConfig,
  portHConfig,
  portJConfig,
} from '../peripherals/gpio_atmega2560';
import { portBConfig, portCConfig, portDConfig } from '../peripherals/gpio_atmega328p';
import { spiConfig } from '../peripherals/spi';
import { timer0Config, timer1Config, timer2Config } from '../peripherals/timer_atmega328p';
import { twiConfig } from '../peripherals/twi';
import { usart0Config } from '../peripherals/usart_atmega328p';
import { Chip } from './chip';

export const ATmega2560: Chip = {
  flashSize: 0x40000,
  ramSize: 0x2000,
  eepromSize: 0x1000,
  registerSpace: 0x100,
  defaultFrequency: 16e6,
  clock: clockConfig,
  eeprom: eepromConfig,
  gpio: {
    A: portAConfig,
    B: portBConfig,
    C: portCConfig,
    D: portDConfig,
    E: portEConfig,
    F: portFConfig,
    G: portGConfig,
    H: portHConfig,
    J: portJConfig,
  },
  timers: [timer0Config, timer1Config, timer2Config],
  spi: [spiConfig],
  usart: [usart0Config],
  twi: [twiConfig],
  adc: adcConfig,
};
