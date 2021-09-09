/**
 * AVR8js
 *
 * Copyright (C) 2019, 2020, Uri Shaked
 */

export { CPU, ICPU, CPUMemoryHook, CPUMemoryHooks } from './cpu/cpu';
export { avrInstruction } from './cpu/instruction';
export { avrInterrupt } from './cpu/interrupt';
export {
  AVRTimer,
  AVRTimerConfig,
  timer0Config,
  timer1Config,
  timer2Config,
} from './peripherals/timer';
export {
  AVRIOPort,
  GPIOListener,
  AVRPortConfig,
  AVRPinChangeInterrupt,
  AVRExternalInterrupt,
  PCINT0,
  PCINT1,
  PCINT2,
  INT0,
  INT1,
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
  PinState,
} from './peripherals/gpio';
export { AVRUSART, usart0Config } from './peripherals/usart';
export {
  AVREEPROM,
  AVREEPROMConfig,
  EEPROMBackend,
  EEPROMMemoryBackend,
  eepromConfig,
} from './peripherals/eeprom';
export * from './peripherals/twi';
export { spiConfig, SPIConfig, SPITransferCallback, AVRSPI } from './peripherals/spi';
export { AVRClock, AVRClockConfig, clockConfig } from './peripherals/clock';
export { AVRWatchdog, watchdogConfig, WatchdogConfig } from './peripherals/watchdog';
