/**
 * AVR-8 USART Peripheral
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */
import { CPU } from '../cpu/cpu';
import { u8 } from '../types';
import { standardUartRegisterBits, USARTConfig } from './usart';
import { AVRUSART } from './usart';

export const usart0Config: USARTConfig = {
  rxCompleteInterrupt: 0x1a,
  dataRegisterEmptyInterrupt: 0x1c,
  txCompleteInterrupt: 0x1e,
  UCSRA: 0x2b,
  UCSRB: 0x2a,
  UCSRC: 0x40,
  UBRRL: 0x29,
  UBRRH: 0x40,
  UDR: 0x2c,

  ...standardUartRegisterBits,
  UCSRC_URSEL: 0x80,
  UCSRC_UMSEL1: 0, // Not in Atmega32
  UCSRC_UMSEL0: 0x40,
};

//
// In the Atmega32 (and ATmega16, but not ATmega64):
// https://ww1.microchip.com/downloads/en/DeviceDoc/doc2503.pdf
// Reference ATmega32 datasheet section "Accessing UBRRH/ UCSRC Registers"
//
// The UBRRH Register shares the same I/O location as the UCSRC Register. Therefore some
// special consideration must be taken when accessing this I/O location.
//

export class AVRUSARTATmega32 extends AVRUSART {
  private UBRRH: u8 = 0;
  private UCSRC: u8 = 0;
  private lastUbrrhReadCycle = 0;

  constructor(cpu: CPU, config: USARTConfig, freqHz: number) {
    super(cpu, config, freqHz);
    this.cpu.writeHooks[config.UCSRC] = (value) => this.writeUCSRCOrUBRRH(value);
    this.cpu.readHooks[config.UCSRC] = () => this.readUCSRCOrUBRRH();
    this.cpu.writeHooks[config.UBRRH] = (value) => this.writeUCSRCOrUBRRH(value);
    this.cpu.readHooks[config.UBRRH] = () => this.readUCSRCOrUBRRH();
  }

  reset() {
    const { UCSRC_URSEL, UCSRC_UCSZ1, UCSRC_UCSZ0 } = this.config;
    super.reset();
    this.UCSRC = UCSRC_URSEL | UCSRC_UCSZ1 | UCSRC_UCSZ0; // default: 8 bits per byte
  }

  private writeUCSRCOrUBRRH(value: number) {
    if (value & this.config.UCSRC_URSEL) {
      this.UCSRC = value & ~this.config.UCSRC_URSEL;
    } else {
      this.UBRRH = value;
    }
    this.onConfigurationChange?.();
    return true;
  }

  // See Atmega32 Datasheet
  // https://ww1.microchip.com/downloads/en/DeviceDoc/doc2503.pdf
  //  Reading the I/O location once returns the UBRRH Register contents.
  //  If the register location was read in previous system clock cycle,
  //  reading the register in the current clock cycle will return the UCSRC contents.
  //
  private readUCSRCOrUBRRH() {
    if (this.cpu.cycles > 0 && this.lastUbrrhReadCycle === this.cpu.cycles - 1) {
      return this.UCSRC;
    }
    this.lastUbrrhReadCycle = this.cpu.cycles;
    return this.UBRRH;
  }

  get Ubrrh() {
    return this.UBRRH;
  }

  get Ucsrc() {
    return this.UCSRC;
  }
}
