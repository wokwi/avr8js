import { Chip } from './chips/chip';
import { CPU } from './cpu/cpu';
import { AVRClock } from './peripherals/clock';
import { AVREEPROM, EEPROMBackend, EEPROMMemoryBackend } from './peripherals/eeprom';
import { AVRIOPort } from './peripherals/gpio';
import { AVRSPI } from './peripherals/spi';
import { AVRTimer } from './peripherals/timer';
import { AVRTWI } from './peripherals/twi';
import { AVRUSART } from './peripherals/usart';

export interface CreateAVROptions {
  eepromBackend?: EEPROMBackend;
  program?: Uint16Array;
  clockSpeedHz?: number;
}

export interface AVR {
  cpu: CPU;
  timers: AVRTimer[];
  clock: AVRClock;
  eeprom?: AVREEPROM;
  spi: AVRSPI[];
  usart: AVRUSART[];
  twi: AVRTWI[];
  gpio: {
    [key: string]: AVRIOPort;
  };
}

export function createAVR(config: Chip, options: CreateAVROptions = {}): AVR {
  const frequency = options.clockSpeedHz ?? config.defaultFrequency;
  const cpu = new CPU(options.program ?? new Uint16Array(config.flashSize / 2), config.ramSize);
  const timers = config.timers.map((timerConfig) => new AVRTimer(cpu, timerConfig));
  const clock = new AVRClock(cpu, frequency, config.clock);
  const eeprom =
    config.eeprom &&
    new AVREEPROM(
      cpu,
      options.eepromBackend ?? new EEPROMMemoryBackend(config.eepromSize),
      config.eeprom
    );
  const spi = config.spi.map((spiConfig) => new AVRSPI(cpu, spiConfig, frequency));
  const usart = config.usart.map((usartConfig) => new AVRUSART(cpu, usartConfig, frequency));
  const twi = config.twi.map((twiConfig) => new AVRTWI(cpu, twiConfig, frequency));
  const gpio: { [key: string]: AVRIOPort } = {};
  for (const port of Object.keys(config.gpio)) {
    gpio[port] = new AVRIOPort(cpu, config.gpio[port]);
  }
  return { cpu, timers, clock, eeprom, spi, usart, twi, gpio };
}
