import { CPU } from '../cpu/cpu';
import { avrInterrupt } from '../cpu/interrupt';
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
const UCSRB_RXCIE = 0x80; // RX Complete Interrupt Enable
const UCSRB_TXCIE = 0x40; // TX Complete Interrupt Enable
const UCSRB_UDRIE = 0x20; // USART Data Register Empty Interrupt Enable
const UCSRB_RXEN = 0x10; // Receiver Enable
const UCSRB_TXEN = 0x8; // Transmitter Enable
const UCSRB_UCSZ2 = 0x4; // Character Size 2
const UCSRB_RXB8 = 0x2; // Receive Data Bit 8
const UCSRB_TXB8 = 0x1; // Transmit Data Bit 8
const UCSRC_UMSEL1 = 0x80; // USART Mode Select 1
const UCSRC_UMSEL0 = 0x40; // USART Mode Select 0
const UCSRC_UPM1 = 0x20; // Parity Mode 1
const UCSRC_UPM0 = 0x10; // Parity Mode 0
const UCSRC_USBS = 0x8; // Stop Bit Select
const UCSRC_UCSZ1 = 0x4; // Character Size 1
const UCSRC_UCSZ0 = 0x2; // Character Size 0
const UCSRC_UCPOL = 0x1; // Clock Polarity
/* eslint-enable @typescript-eslint/no-unused-vars */

export class AVRUSART {
  public onByteTransmit: USARTTransmitCallback | null = null;
  public onLineTransmit: USARTLineTransmitCallback | null = null;

  private lineBuffer = '';

  constructor(private cpu: CPU, private config: USARTConfig, private freqMHz: number) {
    this.cpu.writeHooks[config.UCSRA] = (value) => {
      this.cpu.data[config.UCSRA] = value | UCSRA_UDRE | UCSRA_TXC;
      return true;
    };
    this.cpu.writeHooks[config.UCSRB] = (value, oldValue) => {
      if (value & UCSRB_TXEN && !(oldValue & UCSRB_TXEN)) {
        // Enabling the transmission - mark UDR as empty
        this.cpu.data[config.UCSRA] |= UCSRA_UDRE;
      }
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
      this.cpu.data[config.UCSRA] |= UCSRA_UDRE | UCSRA_TXC;
    };
  }

  tick() {
    if (this.cpu.interruptsEnabled) {
      const ucsra = this.cpu.data[this.config.UCSRA];
      const ucsrb = this.cpu.data[this.config.UCSRB];
      if (ucsra & UCSRA_UDRE && ucsrb & UCSRB_UDRIE) {
        avrInterrupt(this.cpu, this.config.dataRegisterEmptyInterrupt);
        this.cpu.data[this.config.UCSRA] &= ~UCSRA_UDRE;
      }
      if (ucsra & UCSRA_TXC && ucsrb & UCSRB_TXCIE) {
        avrInterrupt(this.cpu, this.config.txCompleteInterrupt);
        this.cpu.data[this.config.UCSRA] &= ~UCSRA_TXC;
      }
    }
  }

  get baudRate() {
    const UBRR = (this.cpu.data[this.config.UBRRH] << 8) | this.cpu.data[this.config.UBRRL];
    const multiplier = this.cpu.data[this.config.UCSRA] & UCSRA_U2X ? 8 : 16;
    return Math.floor(this.freqMHz / (multiplier * (1 + UBRR)));
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
}
