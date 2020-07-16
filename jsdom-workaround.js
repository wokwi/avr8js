// Workaround for jsdom issue: https://github.com/jsdom/jsdom/issues/2961
if (typeof globalThis === 'undefined') {
  global.globalThis = global;
}
