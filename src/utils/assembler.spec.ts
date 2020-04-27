import { assemble } from './assembler';

function bytes(hex: string) {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return result;
}

describe('AVR assembler', () => {
  it('should assemble ADD instruction', () => {
    expect(assemble('ADD r16, r11')).toEqual({
      bytes: bytes('0b0d'),
      errors: [],
      lines: [{ byteOffset: 0, bytes: '0d0b', line: 1, text: 'ADD r16, r11' }],
    });
  });

  it('should support labels', () => {
    expect(assemble('loop: JMP loop').bytes).toEqual(bytes('0c940000'));
  });

  it('should support mutli-line programs', () => {
    const input = `
      start: 
      LDI r16, 15
      EOR r16, r0
      BREQ start
    `;
    expect(assemble(input).bytes).toEqual(bytes('0fe00025e9f3'));
  });

  it('should successfully assemble an empty program', () => {
    expect(assemble('')).toEqual({
      bytes: new Uint8Array(0),
      errors: [],
      lines: [],
    });
  });

  it('should return an empty byte array in case of program error', () => {
    expect(assemble('LDI r15, 20')).toEqual({
      bytes: new Uint8Array(0),
      errors: ['Line 0: Rd out of range: 16<>31'],
      lines: [],
    });
  });

  it('should correctly assemble `ADC r0, r1`', () => {
    expect(assemble('ADC r0, r1').bytes).toEqual(bytes('011c'));
  });

  it('should correctly assemble `BCLR 2`', () => {
    expect(assemble('BCLR 2').bytes).toEqual(bytes('a894'));
  });

  it('should correctly assemble `BLD r4, 7`', () => {
    expect(assemble('BLD r4, 7').bytes).toEqual(bytes('47f8'));
  });

  it('should correctly assemble `BRBC 0, +8`', () => {
    expect(assemble('BRBC 0, +8').bytes).toEqual(bytes('20f4'));
  });

  it('should correctly assemble `BRBS 3, 92`', () => {
    expect(assemble('BRBS 3, 92').bytes).toEqual(bytes('73f1'));
  });

  it('should correctly assemble `BRBS 3, -4`', () => {
    expect(assemble('BRBS 3, -4').bytes).toEqual(bytes('f3f3'));
  });

  it('should correctly assemble BREQ with forward label target', () => {
    expect(assemble('BREQ next \n next:').bytes).toEqual(bytes('01f0'));
  });

  it('should correctly assemble BRNE with forward label target', () => {
    expect(assemble('BRNE next \n next:').bytes).toEqual(bytes('01f4'));
  });

  it('should correctly assemble `CBI 0xc, 5`', () => {
    expect(assemble('CBI 0xc, 5').bytes).toEqual(bytes('6598'));
  });

  it('should correctly assemble `CALL 0xb8`', () => {
    expect(assemble('CALL 0xb8').bytes).toEqual(bytes('0e945c00'));
  });

  it('should correctly assemble `CPC r27, r18`', () => {
    expect(assemble('CPC r27, r18').bytes).toEqual(bytes('b207'));
  });

  it('should correctly assemble `CPC r24, r1`', () => {
    expect(assemble('CPC r24, r1').bytes).toEqual(bytes('8105'));
  });

  it('should correctly assemble `CPI r26, 0x9`', () => {
    expect(assemble('CPI r26, 0x9').bytes).toEqual(bytes('a930'));
  });

  it('should correctly assemble `CPSE r2, r3`', () => {
    expect(assemble('CPSE r2, r3`').bytes).toEqual(bytes('2310'));
  });

  it('should correctly assemble `ICALL`', () => {
    expect(assemble('ICALL').bytes).toEqual(bytes('0995'));
  });

  it('should correctly assemble `IJMP`', () => {
    expect(assemble('IJMP').bytes).toEqual(bytes('0994'));
  });

  it('should correctly assemble `IN r5, 0xb`', () => {
    expect(assemble('IN r5, 0xb').bytes).toEqual(bytes('5bb0'));
  });

  it('should correctly assemble `INC r5`', () => {
    expect(assemble('INC r5').bytes).toEqual(bytes('5394'));
  });

  it('should correctly assemble `JMP 0xb8`', () => {
    expect(assemble('JMP 0xb8').bytes).toEqual(bytes('0c945c00'));
  });

  it('should correctly assemble `LAC r19`', () => {
    expect(assemble('LAC Z, r19').bytes).toEqual(bytes('3693'));
  });

  it('should correctly assemble `LAS Z, r17`', () => {
    expect(assemble('LAS Z, r17').bytes).toEqual(bytes('1593'));
  });

  it('should correctly assemble `LAT Z, r0`', () => {
    expect(assemble('LAT Z, r0').bytes).toEqual(bytes('0792'));
  });

  it('should correctly assemble `LDI r28, 0xff`', () => {
    expect(assemble('LDI r28, 0xff').bytes).toEqual(bytes('cfef'));
  });

  it('should correctly assemble `LDS r5, 0x150`', () => {
    expect(assemble('LDS r5, 0x150').bytes).toEqual(bytes('50905001'));
  });

  it('should correctly assemble `LD r1, X`', () => {
    expect(assemble('LD r1, X').bytes).toEqual(bytes('1c90'));
  });

  it('should correctly assemble `LD r17, X+`', () => {
    expect(assemble('LD r17, X+').bytes).toEqual(bytes('1d91'));
  });

  it('should correctly assemble `LD r1, -X`', () => {
    expect(assemble('LD r1, -X').bytes).toEqual(bytes('1e90'));
  });

  it('should correctly assemble `LD r8, Y`', () => {
    expect(assemble('LD r8, Y').bytes).toEqual(bytes('8880'));
  });

  it('should correctly assemble `LD r3, Y+`', () => {
    expect(assemble('LD r3, Y+').bytes).toEqual(bytes('3990'));
  });

  it('should correctly assemble `LD r0, -Y`', () => {
    expect(assemble('LD r0, -Y').bytes).toEqual(bytes('0a90'));
  });

  it('should correctly assemble `LDD r4, Y+2`', () => {
    expect(assemble('LDD r4, Y+2').bytes).toEqual(bytes('4a80'));
  });

  it('should correctly assemble `LD r5, Z`', () => {
    expect(assemble('LD r5, Z').bytes).toEqual(bytes('5080'));
  });

  it('should correctly assemble `LD r7, Z+`', () => {
    expect(assemble('LD r7, Z+').bytes).toEqual(bytes('7190'));
  });

  it('should correctly assemble `LD r0, -Z`', () => {
    expect(assemble('LD r0, -Z').bytes).toEqual(bytes('0290'));
  });

  it('should correctly assemble `LDD r15, Z+31`', () => {
    expect(assemble('LDD r15, Z+31').bytes).toEqual(bytes('f78c'));
  });

  it('should correctly assemble `LPM`', () => {
    expect(assemble('LPM').bytes).toEqual(bytes('c895'));
  });

  it('should correctly assemble `LPM r2, Z`', () => {
    expect(assemble('LPM r2, Z').bytes).toEqual(bytes('2490'));
  });

  it('should correctly assemble `LPM r1, Z+`', () => {
    expect(assemble('LPM r1, Z+').bytes).toEqual(bytes('1590'));
  });

  it('should correctly assemble `LSR r7`', () => {
    expect(assemble('LSR r7').bytes).toEqual(bytes('7694'));
  });

  it('should correctly assemble `MOV r7, r8`', () => {
    expect(assemble('MOV r7, r8').bytes).toEqual(bytes('782c'));
  });

  it('should correctly assemble `MOVW r26, r22`', () => {
    expect(assemble('MOVW r26, r22').bytes).toEqual(bytes('db01'));
  });

  it('should correctly assemble `MUL r5, r6`', () => {
    expect(assemble('MUL r5, r6').bytes).toEqual(bytes('569c'));
  });

  it('should correctly assemble `MULS r18, r19`', () => {
    expect(assemble('MULS r18, r19').bytes).toEqual(bytes('2302'));
  });

  it('should correctly assemble `MULSU r16, r17`', () => {
    expect(assemble('MULSU r16, r17').bytes).toEqual(bytes('0103'));
  });

  it('should correctly assemble `NEG r20`', () => {
    expect(assemble('NEG r20').bytes).toEqual(bytes('4195'));
  });

  it('should correctly assemble `NOP`', () => {
    expect(assemble('NOP').bytes).toEqual(bytes('0000'));
  });

  it('should correctly assemble `OR r5, r2`', () => {
    expect(assemble('OR r5, r2').bytes).toEqual(bytes('5228'));
  });

  it('should correctly assemble `ORI r22, 0x81`', () => {
    expect(assemble('ORI r22, 0x81').bytes).toEqual(bytes('6168'));
  });

  it('should correctly assemble `OUT 0x3f, r1`', () => {
    expect(assemble('OUT 0x3f, r1').bytes).toEqual(bytes('1fbe'));
  });

  it('should correctly assemble `POP r26`', () => {
    expect(assemble('POP r26').bytes).toEqual(bytes('af91'));
  });

  it('should correctly assemble `PUSH r11`', () => {
    expect(assemble('PUSH r11').bytes).toEqual(bytes('bf92'));
  });

  it('should correctly assemble `RCALL +6`', () => {
    expect(assemble('RCALL +6').bytes).toEqual(bytes('03d0'));
  });

  it('should correctly assemble `RCALL -4`', () => {
    expect(assemble('RCALL -4').bytes).toEqual(bytes('fedf'));
  });

  it('should correctly assemble `RET`', () => {
    expect(assemble('RET').bytes).toEqual(bytes('0895'));
  });

  it('should correctly assemble `RETI`', () => {
    expect(assemble('RETI').bytes).toEqual(bytes('1895'));
  });

  it('should correctly assemble `RJMP 2`', () => {
    expect(assemble('RJMP 2').bytes).toEqual(bytes('01c0'));
  });

  it('should correctly assemble `ROR r0`', () => {
    expect(assemble('ROR r0').bytes).toEqual(bytes('0794'));
  });

  it('should correctly assemble `SBCI r23, 3`', () => {
    expect(assemble('SBCI r23, 3').bytes).toEqual(bytes('7340'));
  });

  it('should correctly assemble `SBI 0x0c, 5`', () => {
    expect(assemble('SBI 0x0c, 5').bytes).toEqual(bytes('659a'));
  });

  it('should correctly assemble `SBIS 0x0c, 5`', () => {
    expect(assemble('SBIS 0x0c, 5').bytes).toEqual(bytes('659b'));
  });

  it('should correctly assemble `SBIW r28, 2`', () => {
    expect(assemble('SBIW r28, 2').bytes).toEqual(bytes('2297'));
  });

  it('should correctly assemble `SLEEP`', () => {
    expect(assemble('SLEEP').bytes).toEqual(bytes('8895'));
  });

  it('should correctly assemble `SPM`', () => {
    expect(assemble('SPM').bytes).toEqual(bytes('e895'));
  });

  it('should correctly assemble `SPM Z+`', () => {
    expect(assemble('SPM Z+').bytes).toEqual(bytes('f895'));
  });

  it('should correctly assemble `STS 0x151, r31`', () => {
    expect(assemble('STS 0x151, r31').bytes).toEqual(bytes('f0935101'));
  });

  it('should correctly assemble `ST X, r1`', () => {
    expect(assemble('ST X, r1').bytes).toEqual(bytes('1c92'));
  });

  it('should correctly assemble `ST X+, r1`', () => {
    expect(assemble('ST X+, r1').bytes).toEqual(bytes('1d92'));
  });

  it('should correctly assemble `ST -X, r17`', () => {
    expect(assemble('ST -X, r17').bytes).toEqual(bytes('1e93'));
  });

  it('should correctly assemble `ST Y, r2`', () => {
    expect(assemble('ST Y, r2').bytes).toEqual(bytes('2882'));
  });

  it('should correctly assemble `ST Y+, r1`', () => {
    expect(assemble('ST Y+, r1').bytes).toEqual(bytes('1992'));
  });

  it('should correctly assemble `ST -Y, r1`', () => {
    expect(assemble('ST -Y, r1').bytes).toEqual(bytes('1a92'));
  });

  it('should correctly assemble `STD Y+17, r0`', () => {
    expect(assemble('STD Y+17, r0').bytes).toEqual(bytes('098a'));
  });

  it('should correctly assemble `ST Z, r16`', () => {
    expect(assemble('ST Z, r16').bytes).toEqual(bytes('0083'));
  });

  it('should correctly assemble `ST Z+, r0`', () => {
    expect(assemble('ST Z+, r0').bytes).toEqual(bytes('0192'));
  });

  it('should correctly assemble `ST -Z, r16`', () => {
    expect(assemble('ST -Z, r16').bytes).toEqual(bytes('0293'));
  });

  it('should correctly assemble `STD Z+1, r0`', () => {
    expect(assemble('STD Z+1, r0').bytes).toEqual(bytes('0182'));
  });

  it('should correctly assemble `SWAP r1`', () => {
    expect(assemble('SWAP r1').bytes).toEqual(bytes('1294'));
  });

  it('should correctly assemble `XCH Z, r21`', () => {
    expect(assemble('XCH Z, r21').bytes).toEqual(bytes('5493'));
  });
});
