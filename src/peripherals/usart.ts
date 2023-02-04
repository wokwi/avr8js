/**
 * AVR-8 USART Peripheral
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */

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
