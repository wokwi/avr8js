import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface SPIConfig {
  spiInterrupt: u8;

  SPCR: u8;
  SPSR: u8;
  SPDR: u8;
}

// Register bits:
const SPCR_SPIE = 0x80; // SPI Interrupt Enable
const SPCR_SPE = 0x40; // SPI Enable
const SPCR_DORD = 0x20; // Data Order
const SPCR_MSTR = 0x10; // Master/Slave Select
const SPCR_CPOL = 0x8; // Clock Polarity
const SPCR_CPHA = 0x4; // Clock Phase
const SPCR_SPR1 = 0x2; // SPI Clock Rate Select 1
const SPCR_SPR0 = 0x1; // SPI Clock Rate Select 0
const SPSR_SPR_MASK = SPCR_SPR1 | SPCR_SPR0;

const SPSR_SPIF = 0x80; // SPI Interrupt Flag
const SPSR_WCOL = 0x40; // Write COLlision Flag
const SPSR_SPI2X = 0x1; // Double SPI Speed Bit

export const spiConfig: SPIConfig = {
  spiInterrupt: 0x22,
  SPCR: 0x4c,
  SPSR: 0x4d,
  SPDR: 0x4e,
};

export type SPITransferCallback = (value: u8) => number;
export type SPIByteTransferCallback = (value: u8) => void;

const bitsPerByte = 8;

export class AVRSPI {
  /** @deprecated Use onByte() instead */
  public onTransfer: SPITransferCallback = () => 0;

  /**
   * SPI byte transfer callback. Invoked whenever the user code starts an SPI transaction.
   * You can override this with your own SPI handler logic.
   *
   * The callback receives a argument: the byte sent over the SPI MOSI line.
   * It should call `completeTransfer()` within `transferCycles` CPU cycles.
   */
  public onByte: SPIByteTransferCallback = (value) => {
    const valueIn = this.onTransfer(value);
    this.cpu.addClockEvent(() => this.completeTransfer(valueIn), this.transferCycles);
  };

  private transmissionActive = false;

  // Interrupts
  private SPI: AVRInterruptConfig = {
    address: this.config.spiInterrupt,
    flagRegister: this.config.SPSR,
    flagMask: SPSR_SPIF,
    enableRegister: this.config.SPCR,
    enableMask: SPCR_SPIE,
  };

  constructor(private cpu: CPU, private config: SPIConfig, private freqHz: number) {
    const { SPCR, SPSR, SPDR } = config;
    cpu.writeHooks[SPDR] = (value: u8) => {
      if (!(cpu.data[SPCR] & SPCR_SPE)) {
        // SPI not enabled, ignore write
        return;
      }

      // Write collision
      if (this.transmissionActive) {
        cpu.data[SPSR] |= SPSR_WCOL;
        return true;
      }

      // Clear write collision / interrupt flags
      cpu.data[SPSR] &= ~SPSR_WCOL;
      this.cpu.clearInterrupt(this.SPI);

      this.transmissionActive = true;
      this.onByte(value);
      return true;
    };
    cpu.writeHooks[SPCR] = (value: u8) => {
      this.cpu.updateInterruptEnable(this.SPI, value);
    };
    cpu.writeHooks[SPSR] = (value: u8) => {
      this.cpu.data[SPSR] = value;
      this.cpu.clearInterruptByFlag(this.SPI, value);
    };
  }

  reset() {
    this.transmissionActive = false;
  }

  /**
   * Completes an SPI transaction. Call this method only from the `onByte` callback.
   *
   * @param receivedByte Byte read from the SPI MISO line.
   */
  completeTransfer(receivedByte: number) {
    const { SPDR } = this.config;
    this.cpu.data[SPDR] = receivedByte;
    this.cpu.setInterruptFlag(this.SPI);
    this.transmissionActive = false;
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

  /** Number of cycles to complete a single byte SPI transaction */
  get transferCycles() {
    return this.clockDivider * bitsPerByte;
  }

  /**
   * The SPI freqeuncy is only relevant to Master mode.
   * In slave mode, the frequency can be as high as F(osc) / 4.
   */
  get spiFrequency() {
    return this.freqHz / this.clockDivider;
  }
}
