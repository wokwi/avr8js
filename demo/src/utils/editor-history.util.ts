const AVRJS8_EDITOR_HISTORY = 'AVRJS8_EDITOR_HISTORY';

export class EditorHistoryUtil {
  static hasLocalStorage = !!window.localStorage;

  static storeSnippet(codeSnippet: string) {
    if (!EditorHistoryUtil.hasLocalStorage) {
      return;
    }
    window.localStorage.setItem(AVRJS8_EDITOR_HISTORY, codeSnippet);
  }

  static clearSnippet() {
    if (!EditorHistoryUtil.hasLocalStorage) {
      return;
    }
    localStorage.removeItem(AVRJS8_EDITOR_HISTORY);
  }

  static getValue() {
    if (!EditorHistoryUtil.hasLocalStorage) {
      return;
    }
    return localStorage.getItem(AVRJS8_EDITOR_HISTORY);
  }
}
