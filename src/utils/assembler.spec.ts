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
      lines: [{ byteOffset: 0, bytes: '0d0b', line: 1, text: 'ADD r16, r11' }]
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
      lines: []
    });
  });

  it('should return an empty byte array in case of program error', () => {
    expect(assemble('LDI r15, 20')).toEqual({
      bytes: new Uint8Array(0),
      errors: ['Line 0: Rd out of range: 16<>31'],
      lines: []
    });
  });
});
