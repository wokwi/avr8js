/**
 * AVR-8 USART Peripheral
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */

import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

interface USARTRegisterBits {
  // UCSRA bits
  UCSRA_RXC: u8; // USART Receive Complete
  UCSRA_TXC: u8; // USART Transmit Complete
  UCSRA_UDRE: u8; // USART Data Register Empty
  UCSRA_FE: u8; // Frame Error
  UCSRA_DOR: u8; // Data OverRun
  UCSRA_UPE: u8; // USART Parity Error
  UCSRA_U2X: u8; // Double the USART Transmission Speed
  UCSRA_MPCM: u8; // Multi-processor Communication Mode

  // UCSRB bits
  UCSRB_RXCIE: u8; // RX Complete Interrupt Enable
  UCSRB_TXCIE: u8; // TX Complete Interrupt Enable
  UCSRB_UDRIE: u8; // USART Data Register Empty Interrupt Enable
  UCSRB_RXEN: u8; // Receiver Enable
  UCSRB_TXEN: u8; // Transmitter Enable
  UCSRB_UCSZ2: u8; // Character Size 2
  UCSRB_RXB8: u8; // Receive Data Bit 8
  UCSRB_TXB8: u8; // Transmit Data Bit 8

  // UCSRC bits
  UCSRC_URSEL: u8; // Register select, 0 = unsupported
  UCSRC_UMSEL1: u8; // USART Mode Select 1, 0 = unsupported
  UCSRC_UMSEL0: u8; // USART Mode Select 0
  UCSRC_UPM1: u8; // Parity Mode 1
  UCSRC_UPM0: u8; // Parity Mode 0
  UCSRC_USBS: u8; // Stop Bit Select
  UCSRC_UCSZ1: u8; // Character Size 1
  UCSRC_UCSZ0: u8; // Character Size 0
  UCSRC_UCPOL: u8; // Clock Polarity
}

// Bits shared amongst "many" AVRs: 328p, 2650, 16, 32, and 64
export const standardUartRegisterBits: Omit<USARTRegisterBits, 'UCSRC_URSEL' | 'UCSRC_UMSEL1'> = {
  UCSRA_RXC: 0x80,
  UCSRA_TXC: 0x40,
  UCSRA_UDRE: 0x20,
  UCSRA_FE: 0x10,
  UCSRA_DOR: 0x8,
  UCSRA_UPE: 0x4,
  UCSRA_U2X: 0x2,
  UCSRA_MPCM: 0x1,

  UCSRB_RXCIE: 0x80,
  UCSRB_TXCIE: 0x40,
  UCSRB_UDRIE: 0x20,
  UCSRB_RXEN: 0x10,
  UCSRB_TXEN: 0x8,
  UCSRB_UCSZ2: 0x4,
  UCSRB_RXB8: 0x2,
  UCSRB_TXB8: 0x1,

  UCSRC_UMSEL0: 0x40,
  UCSRC_UPM1: 0x20,
  UCSRC_UPM0: 0x10,
  UCSRC_USBS: 0x8,
  UCSRC_UCSZ1: 0x4,
  UCSRC_UCSZ0: 0x2,
  UCSRC_UCPOL: 0x1,
};

export interface USARTConfig extends USARTRegisterBits {
  rxCompleteInterrupt: u8;
  dataRegisterEmptyInterrupt: u8;
  txCompleteInterrupt: u8;

  UCSRA: u8;
  UCSRB: u8;
  UCSRC: u8;
  UBRRL: u8;
  UBRRH: u8;
  UDR: u8;
}

export type USARTTransmitCallback = (value: u8) => void;
export type USARTLineTransmitCallback = (value: string) => void;
export type USARTConfigurationChangeCallback = () => void;

const rxMasks = {
  5: 0x1f,
  6: 0x3f,
  7: 0x7f,
  8: 0xff,
  9: 0xff,
};

export class AVRUSART {
  public onByteTransmit: USARTTransmitCallback | null = null;
  public onLineTransmit: USARTLineTransmitCallback | null = null;
  public onRxComplete: (() => void) | null = null;
  public onConfigurationChange: USARTConfigurationChangeCallback | null = null;

  private rxBusyValue = false;
  private rxByte = 0;
  private lineBuffer = '';

  private RXC: AVRInterruptConfig = {
    address: this.config.rxCompleteInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: this.config.UCSRA_RXC,
    enableRegister: this.config.UCSRB,
    enableMask: this.config.UCSRB_RXCIE,
    constant: true,
  };
  private UDRE: AVRInterruptConfig = {
    address: this.config.dataRegisterEmptyInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: this.config.UCSRA_UDRE,
    enableRegister: this.config.UCSRB,
    enableMask: this.config.UCSRB_UDRIE,
  };
  private TXC: AVRInterruptConfig = {
    address: this.config.txCompleteInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: this.config.UCSRA_TXC,
    enableRegister: this.config.UCSRB,
    enableMask: this.config.UCSRB_TXCIE,
  };

  constructor(protected cpu: CPU, protected config: USARTConfig, protected freqHz: number) {
    const UCSRA_CFG_MASK = this.config.UCSRA_U2X;
    const UCSRB_CFG_MASK =
      this.config.UCSRB_UCSZ2 | this.config.UCSRB_RXEN | this.config.UCSRB_TXEN;
    const UCSRC_CFG_MASK =
      this.config.UCSRB_UCSZ2 | this.config.UCSRB_RXEN | this.config.UCSRB_TXEN;
    this.reset();
    this.cpu.writeHooks[config.UCSRA] = (value, oldValue) => {
      cpu.data[config.UCSRA] = value & (this.config.UCSRA_MPCM | this.config.UCSRA_U2X);
      cpu.clearInterruptByFlag(this.TXC, value);
      if ((value & UCSRA_CFG_MASK) !== (oldValue & UCSRA_CFG_MASK)) {
        this.onConfigurationChange?.();
      }
      return true;
    };
    this.cpu.writeHooks[config.UCSRB] = (value, oldValue) => {
      cpu.updateInterruptEnable(this.RXC, value);
      cpu.updateInterruptEnable(this.UDRE, value);
      cpu.updateInterruptEnable(this.TXC, value);
      if (value & this.config.UCSRB_RXEN && oldValue & this.config.UCSRB_RXEN) {
        cpu.clearInterrupt(this.RXC);
      }
      if (value & this.config.UCSRB_TXEN && !(oldValue & this.config.UCSRB_TXEN)) {
        cpu.setInterruptFlag(this.UDRE);
      }
      cpu.data[config.UCSRB] = value;
      if ((value & UCSRB_CFG_MASK) !== (oldValue & UCSRB_CFG_MASK)) {
        this.onConfigurationChange?.();
      }
      return true;
    };
    this.cpu.writeHooks[config.UCSRC] = (value) => {
      cpu.data[config.UCSRC] = value;
      this.onConfigurationChange?.();
      return true;
    };
    this.cpu.readHooks[config.UDR] = () => {
      const mask = rxMasks[this.bitsPerChar] ?? 0xff;
      const result = this.rxByte & mask;
      this.rxByte = 0;
      this.cpu.clearInterrupt(this.RXC);
      return result;
    };
    this.cpu.writeHooks[config.UDR] = (value) => {
      if (this.onByteTransmit) {
        this.onByteTransmit(value);
      }
      if (this.onLineTransmit) {
        const ch = String.fromCharCode(value);
        if (ch === '\n') {
          this.onLineTransmit(this.lineBuffer);
          this.lineBuffer = '';
        } else {
          this.lineBuffer += ch;
        }
      }
      this.cpu.addClockEvent(() => {
        cpu.setInterruptFlag(this.UDRE);
        cpu.setInterruptFlag(this.TXC);
      }, this.cyclesPerChar);
      this.cpu.clearInterrupt(this.TXC);
      this.cpu.clearInterrupt(this.UDRE);
    };
    this.cpu.writeHooks[config.UBRRH] = (value) => {
      this.cpu.data[config.UBRRH] = value;
      this.onConfigurationChange?.();
      return true;
    };
    this.cpu.writeHooks[config.UBRRL] = (value) => {
      this.cpu.data[config.UBRRL] = value;
      this.onConfigurationChange?.();
      return true;
    };
  }

  reset() {
    this.cpu.data[this.config.UCSRA] = this.config.UCSRA_UDRE;
    this.cpu.data[this.config.UCSRB] = 0;
    this.cpu.data[this.config.UCSRC] = this.config.UCSRC_UCSZ1 | this.config.UCSRC_UCSZ0;
    this.rxBusyValue = false;
    this.rxByte = 0;
    this.lineBuffer = '';
  }

  get rxBusy() {
    return this.rxBusyValue;
  }

  writeByte(value: number, immediate = false) {
    const { cpu } = this;
    if (this.rxBusyValue || !this.rxEnable) {
      return false;
    }
    if (immediate) {
      this.rxByte = value;
      cpu.setInterruptFlag(this.RXC);
      this.onRxComplete?.();
    } else {
      this.rxBusyValue = true;
      cpu.addClockEvent(() => {
        this.rxBusyValue = false;
        this.writeByte(value, true);
      }, this.cyclesPerChar);
      return true;
    }
  }

  private get cyclesPerChar() {
    const symbolsPerChar = 1 + this.bitsPerChar + this.stopBits + (this.parityEnabled ? 1 : 0);
    return (this.UBRR + 1) * this.multiplier * symbolsPerChar;
  }

  private get UBRR() {
    const { UBRRH, UBRRL } = this.config;
    return (this.cpu.data[UBRRH] << 8) | this.cpu.data[UBRRL];
  }

  private get multiplier() {
    return this.cpu.data[this.config.UCSRA] & this.config.UCSRA_U2X ? 8 : 16;
  }

  get rxEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & this.config.UCSRB_RXEN);
  }

  get txEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & this.config.UCSRB_TXEN);
  }

  get baudRate() {
    return Math.floor(this.freqHz / (this.multiplier * (1 + this.UBRR)));
  }

  get bitsPerChar() {
    const ucsz =
      ((this.cpu.data[this.config.UCSRC] & (this.config.UCSRC_UCSZ1 | this.config.UCSRC_UCSZ0)) >>
        1) |
      (this.cpu.data[this.config.UCSRB] & this.config.UCSRB_UCSZ2);
    switch (ucsz) {
      case 0:
        return 5;
      case 1:
        return 6;
      case 2:
        return 7;
      case 3:
        return 8;
      default:
      case 7:
        return 9;
    }
  }

  get stopBits() {
    return this.cpu.data[this.config.UCSRC] & this.config.UCSRC_USBS ? 2 : 1;
  }

  get parityEnabled() {
    return this.cpu.data[this.config.UCSRC] & this.config.UCSRC_UPM1 ? true : false;
  }

  get parityOdd() {
    return this.cpu.data[this.config.UCSRC] & this.config.UCSRC_UPM0 ? true : false;
  }
}
