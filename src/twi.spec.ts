import { CPU } from './cpu';
import { AVRTWI, twiConfig } from './twi';
import { assemble } from './utils/assembler';
import { avrInstruction } from './instruction';

const FREQ_16MHZ = 16e6;

function asmProgram(source: string) {
  const { bytes, errors, lines } = assemble(source);
  if (errors.length) {
    throw new Error('Assembly failed: ' + errors);
  }
  return { program: new Uint16Array(bytes.buffer), lines };
}

function runInstructions(cpu: CPU, twi: AVRTWI, count: number) {
  for (let i = 0; i < count; i++) {
    if (cpu.progMem[cpu.pc] === 0x9598) {
      console.log(cpu.data[0xbc].toString(16));
      console.log(cpu.data[16]);
      throw new Error('BREAK instruction encountered');
    }
    avrInstruction(cpu);
    twi.tick();
  }
}

describe('TWI', () => {
  const TWINT = 7;
  const TWSTA = 5;
  const TWEN = 2;

  it('should correctly calculate the sclFrequency from TWBR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
    cpu.writeData(0xb8, 0x48); // TWBR <- 0x48
    cpu.writeData(0xb9, 0); // TWSR <- 0 (prescaler: 1)
    expect(twi.sclFrequency).toEqual(100000);
  });

  it('should take the prescaler into consideration when calculating sclFrequency', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
    cpu.writeData(0xb8, 0x03); // TWBR <- 0x03
    cpu.writeData(0xb9, 0x01); // TWSR <- 1 (prescaler: 4)
    expect(twi.sclFrequency).toEqual(400000);
  });

  describe('Master mode', () => {
    it('should call the startEvent handler when TWSTA bit is written 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
      jest.spyOn(twi.eventHandler, 'start');
      cpu.writeData(0xbc, (1 << TWINT) | (1 << TWSTA) | (1 << TWEN));
      twi.tick();
      expect(twi.eventHandler.start).toHaveBeenCalledWith(false);
    });

    it('should successfully transmit a byte to a slave', () => {
      // based on the example in page 225 of the datasheet:
      // https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
      const { program } = asmProgram(`
        ; register addresses
        _REPLACE TWSR, 0xb9
        _REPLACE TWDR, 0xbb
        _REPLACE TWCR, 0xbc

        ; TWCR bits
        _REPLACE TWEN, 0x04
        _REPLACE TWSTO, 0x10
        _REPLACE TWSTA, 0x20
        _REPLACE TWINT, 0x80

        ; TWSR states
        _REPLACE START, 0x8         ; TWI start
        _REPLACE MT_SLA_ACK, 0x18   ; Slave Adresss ACK has been received
        _REPLACE MT_DATA_ACK, 0x28  ; Data ACK has been received

        ; Send start condition
        ldi r16, TWEN
        sbr r16, TWSTA
        sbr r16, TWINT
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the START condition has been transmitted
        call wait_for_twint
        
        ; Check value of TWI Status Register. Mask prescaler bits. If status different from START go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, START
        brne error

        ; Load SLA_W into TWDR Register. Clear TWINT bit in TWCR to start transmission of address
        ; 0x44 = Address 0x22, write mode (R/W bit clear)
        _REPLACE SLA_W, 0x44
        ldi r16, SLA_W
        sts TWDR, r16
        ldi r16, TWINT
        sbr r16, TWEN
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the SLA+W has been transmitted, and ACK/NACK has been received.
        call wait_for_twint

        ; Check value of TWI Status Register. Mask prescaler bits. If status different from MT_SLA_ACK go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, MT_SLA_ACK
        brne error

        ; Load DATA into TWDR Register. Clear TWINT bit in TWCR to start transmission of data
        _replace DATA, 0x55
        ldi r16, DATA
        sts TWDR, r16
        ldi r16, TWINT
        sbr r16, TWEN
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the DATA has been transmitted, and ACK/NACK has been received
        call wait_for_twint

        ; Check value of TWI Status Register. Mask prescaler bits. If status different from MT_DATA_ACK go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, MT_DATA_ACK
        brne error

        ; Transmit STOP condition
        ldi r16, TWINT
        sbr r16, TWEN
        sbr r16, TWSTO
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the STOP condition has been sent
        call wait_for_twint

        ; Check value of TWI Status Register. The masked value should be 0xf8 once done
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, 0xf8
        brne error

        ; Indicate success by loading 0x42 into r17
        ldi r17, 0x42

        loop:
        jmp loop

        ; Busy-waits for the TWINT flag to be set
        wait_for_twint:
        lds r16, TWCR
        andi r16, TWINT
        breq wait_for_twint
        ret

        ; In case of an error, toggle a breakpoint
        error:
        break
      `);
      const cpu = new CPU(program);
      const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
      twi.eventHandler = {
        start: jest.fn(),
        stop: jest.fn(),
        connectToSlave: jest.fn(),
        writeByte: jest.fn(),
        readByte: jest.fn()
      };

      // Step 1: wait for start condition
      runInstructions(cpu, twi, 4);
      expect(twi.eventHandler.start).toHaveBeenCalledWith(false);

      runInstructions(cpu, twi, 16);
      twi.completeStart();

      // Step 2: wait for slave connect in write mode
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.connectToSlave).toHaveBeenCalledWith(0x22, true);

      runInstructions(cpu, twi, 16);
      twi.completeConnect(true);

      // Step 3: wait for first data byte
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.writeByte).toHaveBeenCalledWith(0x55);

      runInstructions(cpu, twi, 16);
      twi.completeWrite(true);

      // Step 4: wait for stop condition
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.stop).toHaveBeenCalled();

      runInstructions(cpu, twi, 16);
      twi.completeStop();

      // Step 5: wait for the assembly code to indicate success by settings r17 to 0x42
      runInstructions(cpu, twi, 16);
      expect(cpu.data[17]).toEqual(0x42);
    });

    it('should successfully receive a byte from a slave', () => {
      const { program } = asmProgram(`
        ; register addresses
        _REPLACE TWSR, 0xb9
        _REPLACE TWDR, 0xbb
        _REPLACE TWCR, 0xbc
        
        ; TWCR bits
        _REPLACE TWEN, 0x04
        _REPLACE TWSTO, 0x10
        _REPLACE TWSTA, 0x20
        _REPLACE TWEA, 0x40
        _REPLACE TWINT, 0x80

        ; TWSR states
        _REPLACE START, 0x8         ; TWI start
        _REPLACE MT_SLAR_ACK, 0x40  ; Slave Adresss ACK has been received
        _REPLACE MT_DATA_RECV, 0x50 ; Data has been received
        _REPLACE MT_DATA_RECV_NACK, 0x58 ; Data has been received, NACK has been returned

        ; Send start condition
        ldi r16, TWEN
        sbr r16, TWSTA
        sbr r16, TWINT
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the START condition has been transmitted
        call wait_for_twint
        
        ; Check value of TWI Status Register. Mask prescaler bits. If status different from START go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        ldi r18, START
        cpse r16, r18
        jmp error   ; only jump if r16 != r18 (START)

        ; Load SLA_R into TWDR Register. Clear TWINT bit in TWCR to start transmission of address
        ; 0xa1 = Address 0x50, read mode (R/W bit set)
        _REPLACE SLA_R, 0xa1
        ldi r16, SLA_R
        sts TWDR, r16
        ldi r16, TWINT
        sbr r16, TWEN
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the SLA+W has been transmitted, and ACK/NACK has been received.
        call wait_for_twint

        ; Check value of TWI Status Register. Mask prescaler bits. If status different from MT_SLA_ACK go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, MT_SLAR_ACK
        brne error

        ; Clear TWINT bit in TWCR to receive the next byte, set TWEA to send ACK
        ldi r16, TWINT
        sbr r16, TWEA
        sbr r16, TWEN
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the DATA has been received, and ACK has been transmitted
        call wait_for_twint

        ; Check value of TWI Status Register. Mask prescaler bits. If status different from MT_DATA_RECV go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, MT_DATA_RECV
        brne error

        ; Validate that we recieved the desired data - first byte should be 0x66
        lds r16, TWDR
        cpi r16, 0x66
        brne error

        ; Clear TWINT bit in TWCR to receive the next byte, this time we don't ACK
        ldi r16, TWINT
        sbr r16, TWEN
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the DATA has been received, and NACK has been transmitted
        call wait_for_twint

        ; Check value of TWI Status Register. Mask prescaler bits. If status different from MT_DATA_RECV_NACK go to ERROR
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, MT_DATA_RECV_NACK
        brne error

        ; Validate that we recieved the desired data - second byte should be 0x77
        lds r16, TWDR
        cpi r16, 0x77
        brne error

        ; Transmit STOP condition
        ldi r16, TWINT
        sbr r16, TWEN
        sbr r16, TWSTO
        sts TWCR, r16

        ; Wait for TWINT Flag set. This indicates that the STOP condition has been sent
        call wait_for_twint

        ; Check value of TWI Status Register. The masked value should be 0xf8 once done
        lds r16, TWSR
        andi r16, 0xf8
        cpi r16, 0xf8
        brne error

        ; Indicate success by loading 0x42 into r17
        ldi r17, 0x42

        loop:
        jmp loop

        ; Busy-waits for the TWINT flag to be set
        wait_for_twint:
        lds r16, TWCR
        andi r16, TWINT
        breq wait_for_twint
        ret

        ; In case of an error, toggle a breakpoint
        error:
        break
      `);
      const cpu = new CPU(program);
      const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
      twi.eventHandler = {
        start: jest.fn(),
        stop: jest.fn(),
        connectToSlave: jest.fn(),
        writeByte: jest.fn(),
        readByte: jest.fn()
      };

      // Step 1: wait for start condition
      runInstructions(cpu, twi, 4);
      expect(twi.eventHandler.start).toHaveBeenCalledWith(false);

      runInstructions(cpu, twi, 16);
      twi.completeStart();

      // Step 2: wait for slave connect in read mode
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.connectToSlave).toHaveBeenCalledWith(0x50, false);

      runInstructions(cpu, twi, 16);
      twi.completeConnect(true);

      // Step 3: send the first byte to the master, expect ack
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.readByte).toHaveBeenCalledWith(true);

      runInstructions(cpu, twi, 16);
      twi.completeRead(0x66);

      // Step 4: send the first byte to the master, expect nack
      runInstructions(cpu, twi, 16);
      expect(twi.eventHandler.readByte).toHaveBeenCalledWith(false);

      runInstructions(cpu, twi, 16);
      twi.completeRead(0x77);

      // Step 5: wait for stop condition
      runInstructions(cpu, twi, 24);
      expect(twi.eventHandler.stop).toHaveBeenCalled();

      runInstructions(cpu, twi, 16);
      twi.completeStop();

      // Step 6: wait for the assembly code to indicate success by settings r17 to 0x42
      runInstructions(cpu, twi, 16);
      expect(cpu.data[17]).toEqual(0x42);
    });
  });
});
