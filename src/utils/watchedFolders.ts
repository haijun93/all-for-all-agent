const STORAGE_KEY = 'picasa_watched_folders';
export const WATCHED_FOLDERS_CHANGED_EVENT = 'picasa-watched-folders-changed';

export function getWatchedFolders(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function setWatchedFolders(folders: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  window.dispatchEvent(new Event(WATCHED_FOLDERS_CHANGED_EVENT));
}
