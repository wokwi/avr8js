/**
 * AVR-8 USART Peripheral
 * Part of AVR8js
 * Reference: http:
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */
import { standardUartRegisterBits, USARTConfig } from './usart';

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

  ...standardUartRegisterBits,
  UCSRC_URSEL: 0, // Not applicable
  UCSRC_UMSEL1: 0x80,
  UCSRC_UMSEL0: 0x40,
};
