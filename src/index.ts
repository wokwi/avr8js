/**
 * AVR8js
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */

export { CPU } from './cpu/cpu';
export type { CPUMemoryHook, CPUMemoryHooks } from './cpu/cpu';
export { avrInstruction } from './cpu/instruction';
export { avrInterrupt } from './cpu/interrupt';
export { ADCMuxInputType, ADCReference, AVRADC } from './peripherals/adc';
export { atmega328AdcConfig, atmega328Channels } from './peripherals/adc_atmega328p';
export type { ADCConfig, ADCMuxConfiguration, ADCMuxInput } from './peripherals/adc';
export { AVRClock, clockConfig } from './peripherals/clock';
export type { AVRClockConfig } from './peripherals/clock';
export { AVREEPROM, eepromConfig, EEPROMMemoryBackend } from './peripherals/eeprom';
export type { AVREEPROMConfig, EEPROMBackend } from './peripherals/eeprom';
export { AVRIOPort, PinState } from './peripherals/gpio';
export {
  INT0,
  INT1,
  PCINT0,
  PCINT1,
  PCINT2,
  portBConfig,
  portCConfig,
  portDConfig,
} from './peripherals/gpio_atmega328p';
export {
  portAConfig,
  portEConfig,
  portFConfig,
  portGConfig,
  portHConfig,
  portJConfig,
  portKConfig,
  portLConfig,
} from './peripherals/gpio_atmega2560';
export {
  atmega32PortAConfig,
  atmega32PortBConfig,
  atmega32PortCConfig,
  atmega32PortDConfig,
} from './peripherals/gpio_atmega32';
export {
  atmga32Timer0Config,
  atmga32Timer1Config,
  atmga32Timer2Config,
} from './peripherals/timer_atmega32';
export { atmega32Usart0Config } from './peripherals/usart_atmega32';
export type {
  AVRExternalInterrupt,
  AVRPinChangeInterrupt,
  AVRPortConfig,
  GPIOListener,
} from './peripherals/gpio';
export { AVRSPI, spiConfig } from './peripherals/spi';
export type { SPIConfig, SPITransferCallback } from './peripherals/spi';
export { AVRTimer } from './peripherals/timer';
export {
  atmega328pTimer0Config,
  atmega328pTimer1Config,
  atmega328pTimer2Config,
} from './peripherals/timer_atmega328p';
export type { AVRTimerConfig } from './peripherals/timer';
export * from './peripherals/twi';
export { AVRUSART, atmega328pUsart0Config } from './peripherals/usart_atmega328p';
export { AVRUSI } from './peripherals/usi';
export { AVRWatchdog, watchdogConfig } from './peripherals/watchdog';
export type { WatchdogConfig } from './peripherals/watchdog';
