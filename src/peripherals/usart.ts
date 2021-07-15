/**
 * AVR-8 USART Peripheral
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */

import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u8 } from '../types';

export interface USARTConfig {
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

export const usart0Config: USARTConfig = {
  rxCompleteInterrupt: 0x24,
  dataRegisterEmptyInterrupt: 0x26,
  txCompleteInterrupt: 0x28,
  UCSRA: 0xc0,
  UCSRB: 0xc1,
  UCSRC: 0xc2,
  UBRRL: 0xc4,
  UBRRH: 0xc5,
  UDR: 0xc6,
};

export type USARTTransmitCallback = (value: u8) => void;
export type USARTLineTransmitCallback = (value: string) => void;
export type USARTConfigurationChangeCallback = () => void;

/* eslint-disable @typescript-eslint/no-unused-vars */
// Register bits:
const UCSRA_RXC = 0x80; // USART Receive Complete
const UCSRA_TXC = 0x40; // USART Transmit Complete
const UCSRA_UDRE = 0x20; // USART Data Register Empty
const UCSRA_FE = 0x10; // Frame Error
const UCSRA_DOR = 0x8; // Data OverRun
const UCSRA_UPE = 0x4; // USART Parity Error
const UCSRA_U2X = 0x2; // Double the USART Transmission Speed
const UCSRA_MPCM = 0x1; // Multi-processor Communication Mode
const UCSRA_CFG_MASK = UCSRA_U2X;
const UCSRB_RXCIE = 0x80; // RX Complete Interrupt Enable
const UCSRB_TXCIE = 0x40; // TX Complete Interrupt Enable
const UCSRB_UDRIE = 0x20; // USART Data Register Empty Interrupt Enable
const UCSRB_RXEN = 0x10; // Receiver Enable
const UCSRB_TXEN = 0x8; // Transmitter Enable
const UCSRB_UCSZ2 = 0x4; // Character Size 2
const UCSRB_RXB8 = 0x2; // Receive Data Bit 8
const UCSRB_TXB8 = 0x1; // Transmit Data Bit 8
const UCSRB_CFG_MASK = UCSRB_UCSZ2 | UCSRB_RXEN | UCSRB_TXEN;
const UCSRC_UMSEL1 = 0x80; // USART Mode Select 1
const UCSRC_UMSEL0 = 0x40; // USART Mode Select 0
const UCSRC_UPM1 = 0x20; // Parity Mode 1
const UCSRC_UPM0 = 0x10; // Parity Mode 0
const UCSRC_USBS = 0x8; // Stop Bit Select
const UCSRC_UCSZ1 = 0x4; // Character Size 1
const UCSRC_UCSZ0 = 0x2; // Character Size 0
const UCSRC_UCPOL = 0x1; // Clock Polarity
/* eslint-enable @typescript-eslint/no-unused-vars */

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

  // Interrupts
  private RXC: AVRInterruptConfig = {
    address: this.config.rxCompleteInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: UCSRA_RXC,
    enableRegister: this.config.UCSRB,
    enableMask: UCSRB_RXCIE,
    constant: true,
  };
  private UDRE: AVRInterruptConfig = {
    address: this.config.dataRegisterEmptyInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: UCSRA_UDRE,
    enableRegister: this.config.UCSRB,
    enableMask: UCSRB_UDRIE,
  };
  private TXC: AVRInterruptConfig = {
    address: this.config.txCompleteInterrupt,
    flagRegister: this.config.UCSRA,
    flagMask: UCSRA_TXC,
    enableRegister: this.config.UCSRB,
    enableMask: UCSRB_TXCIE,
  };

  constructor(private cpu: CPU, private config: USARTConfig, private freqHz: number) {
    this.reset();
    this.cpu.writeHooks[config.UCSRA] = (value, oldValue) => {
      cpu.data[config.UCSRA] = value & (UCSRA_MPCM | UCSRA_U2X);
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
      if (value & UCSRB_RXEN && oldValue & UCSRB_RXEN) {
        cpu.clearInterrupt(this.RXC);
      }
      if (value & UCSRB_TXEN && !(oldValue & UCSRB_TXEN)) {
        // Enabling the transmission - mark UDR as empty
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
    this.cpu.data[this.config.UCSRA] = UCSRA_UDRE;
    this.cpu.data[this.config.UCSRB] = 0;
    this.cpu.data[this.config.UCSRC] = UCSRC_UCSZ1 | UCSRC_UCSZ0; // default: 8 bits per byte
    this.rxBusyValue = false;
    this.rxByte = 0;
    this.lineBuffer = '';
  }

  get rxBusy() {
    return this.rxBusyValue;
  }

  writeByte(value: number) {
    const { cpu, config } = this;
    if (this.rxBusyValue || !(cpu.data[config.UCSRB] & UCSRB_RXEN)) {
      return false;
    }
    this.rxBusyValue = true;
    cpu.addClockEvent(() => {
      this.rxByte = value;
      this.rxBusyValue = false;
      cpu.setInterruptFlag(this.RXC);
      this.onRxComplete?.();
    }, this.cyclesPerChar);
    return true;
  }

  private get cyclesPerChar() {
    const symbolsPerChar = 1 + this.bitsPerChar + this.stopBits + (this.parityEnabled ? 1 : 0);
    return (this.UBRR * this.multiplier + 1) * symbolsPerChar;
  }

  private get UBRR() {
    const { UBRRH, UBRRL } = this.config;
    return (this.cpu.data[UBRRH] << 8) | this.cpu.data[UBRRL];
  }

  private get multiplier() {
    return this.cpu.data[this.config.UCSRA] & UCSRA_U2X ? 8 : 16;
  }

  get rxEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & UCSRB_RXEN);
  }

  get txEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & UCSRB_TXEN);
  }

  get baudRate() {
    return Math.floor(this.freqHz / (this.multiplier * (1 + this.UBRR)));
  }

  get bitsPerChar() {
    const ucsz =
      ((this.cpu.data[this.config.UCSRC] & (UCSRC_UCSZ1 | UCSRC_UCSZ0)) >> 1) |
      (this.cpu.data[this.config.UCSRB] & UCSRB_UCSZ2);
    switch (ucsz) {
      case 0:
        return 5;
      case 1:
        return 6;
      case 2:
        return 7;
      case 3:
        return 8;
      default: // 4..6 are reserved
      case 7:
        return 9;
    }
  }

  get stopBits() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_USBS ? 2 : 1;
  }

  get parityEnabled() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_UPM1 ? true : false;
  }

  get parityOdd() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_UPM0 ? true : false;
  }
}
