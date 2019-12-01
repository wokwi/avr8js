export function* permutations(pattern: string) {
  let totalPerms = 1;
  for (const char of pattern) {
    if (char !== '0' && char !== '1') {
      totalPerms *= 2;
    }
  }

  for (let permIndex = 0; permIndex < totalPerms; permIndex++) {
    let varIndex = 0;
    let value = 0;
    for (const char of pattern) {
      value *= 2;
      if (char === '1') {
        value++;
      } else if (char !== '0') {
        value += permIndex & (1 << varIndex) ? 1 : 0;
        varIndex++;
      }
    }
    yield value;
  }
}
