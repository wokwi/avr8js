/**
 * AVR8js
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */

export { CPU } from './cpu/cpu';
export type { CPUMemoryHook, CPUMemoryHooks } from './cpu/cpu';
export { avrInstruction } from './cpu/instruction';
export { avrInterrupt } from './cpu/interrupt';
export { adcConfig, atmega328Channels, AVRADC } from './peripherals/adc';
export type {
  ADCConfig,
  ADCMuxConfiguration,
  ADCMuxInput,
  ADCMuxInputType,
  ADCReference,
} from './peripherals/adc';
export { AVRClock, clockConfig } from './peripherals/clock';
export type { AVRClockConfig } from './peripherals/clock';
export { AVREEPROM, eepromConfig, EEPROMMemoryBackend } from './peripherals/eeprom';
export type { EEPROMBackend, AVREEPROMConfig } from './peripherals/eeprom';
export {
  AVRIOPort,
  INT0,
  INT1,
  PCINT0,
  PCINT1,
  PCINT2,
  PinState,
  portAConfig,
  portBConfig,
  portCConfig,
  portDConfig,
  portEConfig,
  portFConfig,
  portGConfig,
  portHConfig,
  portJConfig,
  portKConfig,
  portLConfig,
} from './peripherals/gpio';
export type {
  AVRExternalInterrupt,
  AVRPinChangeInterrupt,
  AVRPortConfig,
  GPIOListener,
} from './peripherals/gpio';
export { AVRSPI, spiConfig } from './peripherals/spi';
export type { SPIConfig, SPITransferCallback } from './peripherals/spi';
export { AVRTimer, timer0Config, timer1Config, timer2Config } from './peripherals/timer';
export type { AVRTimerConfig } from './peripherals/timer';
export * from './peripherals/twi';
export { AVRUSART, usart0Config } from './peripherals/usart';
export { AVRUSI } from './peripherals/usi';
export { AVRWatchdog, watchdogConfig } from './peripherals/watchdog';
