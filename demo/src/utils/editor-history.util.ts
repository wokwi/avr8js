const AVRJS8_EDITOR_HISTORY = 'AVRJS8_EDITOR_HISTORY';

export class EditorHistoryUtil {
  static storeSnippet(codeSnippet: string) {
    if (window.localStorage) {
      window.localStorage.setItem(AVRJS8_EDITOR_HISTORY, codeSnippet);
    } else throw new Error('no localStorage support');
  }

  static clearSnippet() {
    localStorage.removeItem(AVRJS8_EDITOR_HISTORY);
  }

  static getValue() {
    return localStorage.getItem(AVRJS8_EDITOR_HISTORY);
  }
}
