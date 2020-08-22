import { CPU } from '../cpu/cpu';
import { u8 } from '../types';
import { avrInterrupt } from '../cpu/interrupt';

export interface SPIConfig {
  spiInterrupt: u8;

  SPCR: u8;
  SPSR: u8;
  SPDR: u8;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Register bits:
const SPCR_SPIE = 0x80; //  SPI Interrupt Enable
const SPCR_SPE = 0x40; // SPI Enable
const SPCR_DORD = 0x20; // Data Order
const SPCR_MSTR = 0x10; //  Master/Slave Select
const SPCR_CPOL = 0x8; // Clock Polarity
const SPCR_CPHA = 0x4; // Clock Phase
const SPCR_SPR1 = 0x2; // SPI Clock Rate Select 1
const SPCR_SPR0 = 0x1; // SPI Clock Rate Select 0
const SPSR_SPR_MASK = SPCR_SPR1 | SPCR_SPR0;

const SPSR_SPIF = 0x80; // SPI Interrupt Flag
const SPSR_WCOL = 0x40; // Write COLlision Flag
const SPSR_SPI2X = 0x1; // Double SPI Speed Bit
/* eslint-enable @typescript-eslint/no-unused-vars */

export const spiConfig: SPIConfig = {
  spiInterrupt: 0x22,
  SPCR: 0x4c,
  SPSR: 0x4d,
  SPDR: 0x4e,
};

export type SPITransferCallback = (value: u8) => u8;

const bitsPerByte = 8;

export class AVRSPI {
  public onTransfer: SPITransferCallback | null = null;

  private transmissionCompleteCycles = 0;
  private receivedByte: u8 = 0;

  constructor(private cpu: CPU, private config: SPIConfig, private freqMHz: number) {
    const { SPCR, SPSR, SPDR } = config;
    cpu.writeHooks[SPDR] = (value: u8) => {
      if (!(cpu.data[SPCR] & SPCR_SPE)) {
        // SPI not enabled, ignore write
        return;
      }

      // Write collision
      if (this.transmissionCompleteCycles > this.cpu.cycles) {
        cpu.data[SPSR] |= SPSR_WCOL;
        return true;
      }

      // Clear write collision / interrupt flags
      cpu.data[SPSR] &= ~SPSR_WCOL & ~SPSR_SPIF;

      this.receivedByte = this.onTransfer?.(value) ?? 0;
      this.transmissionCompleteCycles = this.cpu.cycles + this.clockDivider * bitsPerByte;
      return true;
    };
  }

  tick() {
    if (this.transmissionCompleteCycles && this.cpu.cycles >= this.transmissionCompleteCycles) {
      const { SPSR, SPDR } = this.config;
      this.cpu.data[SPSR] |= SPSR_SPIF;
      this.cpu.data[SPDR] = this.receivedByte;
      this.transmissionCompleteCycles = 0;
    }
    if (this.cpu.interruptsEnabled) {
      const { SPSR, SPCR, spiInterrupt } = this.config;
      if (this.cpu.data[SPCR] & SPCR_SPIE && this.cpu.data[SPSR] & SPSR_SPIF) {
        avrInterrupt(this.cpu, spiInterrupt);
        this.cpu.data[SPSR] &= ~SPSR_SPIF;
      }
    }
  }

  get isMaster() {
    return this.cpu.data[this.config.SPCR] & SPCR_MSTR ? true : false;
  }

  get dataOrder() {
    return this.cpu.data[this.config.SPCR] & SPCR_DORD ? 'lsbFirst' : 'msbFirst';
  }

  get spiMode() {
    const CPHA = this.cpu.data[this.config.SPCR] & SPCR_CPHA;
    const CPOL = this.cpu.data[this.config.SPCR] & SPCR_CPOL;
    return ((CPHA ? 2 : 0) | (CPOL ? 1 : 0)) as 0 | 1 | 2 | 3;
  }

  /**
   * The clock divider is only relevant for Master mode
   */
  get clockDivider() {
    const base = this.cpu.data[this.config.SPSR] & SPSR_SPI2X ? 2 : 4;
    switch (this.cpu.data[this.config.SPCR] & SPSR_SPR_MASK) {
      case 0b00:
        return base;

      case 0b01:
        return base * 4;

      case 0b10:
        return base * 16;

      case 0b11:
        return base * 32;
    }
    // We should never get here:
    throw new Error('Invalid divider value!');
  }

  /**
   * The SPI freqeuncy is only relevant to Master mode.
   * In slave mode, the frequency can be as high as F(osc) / 4.
   */
  get spiFrequency() {
    return this.freqMHz / this.clockDivider;
  }
}
