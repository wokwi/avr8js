import { USARTConfig } from './usart';

export const atmega32Usart0Config: USARTConfig = {
  rxCompleteInterrupt: 0x1a,
  dataRegisterEmptyInterrupt: 0x1c,
  txCompleteInterrupt: 0x1e,
  UCSRA: 0x2b,
  UCSRB: 0x2a,
  UCSRC: 0x40, // <----------- TODO
  UBRRL: 0x29,
  UBRRH: 0x40, // <----------- TODO
  UDR: 0x2c,
};
