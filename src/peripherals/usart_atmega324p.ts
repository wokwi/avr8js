import { USARTConfig } from './usart';
import { usart0Config as usart0ConfigAtmega328p } from './usart_atmega328p';

export const usart0Config: USARTConfig = {
  ...usart0ConfigAtmega328p,
  rxCompleteInterrupt: 0x28,
  dataRegisterEmptyInterrupt: 0x2a,
  txCompleteInterrupt: 0x2c,
};
