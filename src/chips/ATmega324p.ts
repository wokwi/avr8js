import { adcConfig } from '../peripherals/adc_atmega324p';
import { clockConfig } from '../peripherals/clock';
import { eepromConfig } from '../peripherals/eeprom_atmega324p';
import { portAConfig } from '../peripherals/gpio_atmega2560';
import { portBConfig, portCConfig, portDConfig } from '../peripherals/gpio_atmega328p';
import { spiConfig } from '../peripherals/spi';
import { timer0Config, timer1Config, timer2Config } from '../peripherals/timer_atmega324p';
import { twiConfig } from '../peripherals/twi_atmega324p';
import { usart0Config } from '../peripherals/usart_atmega324p';
import { Chip } from './chip';

export const ATmega324p: Chip = {
  flashSize: 0x8000,
  ramSize: 0x800,
  eepromSize: 0x400,
  registerSpace: 0x100,
  defaultFrequency: 16e6,
  clock: clockConfig,
  eeprom: eepromConfig,
  gpio: { A: portAConfig, B: portBConfig, C: portCConfig, D: portDConfig },
  timers: [timer0Config, timer1Config, timer2Config],
  spi: [spiConfig],
  usart: [usart0Config],
  twi: [twiConfig],
  adc: adcConfig,
};
