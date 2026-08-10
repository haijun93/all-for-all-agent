export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
export const isWindows = typeof navigator !== 'undefined' && /Win/.test(navigator.userAgent);

export const modifierKey = isMac ? '⌘' : 'Ctrl';
export const modifierKeyName = isMac ? 'Command' : 'Ctrl';
export const fileExplorerName = isWindows ? 'Windows 파일 탐색기' : 'Finder';
