export const SPATIAL_COMMAND_CENTER_SHELL_FLAG = "nimbus:spatial-command-center-shell";

type StorageReader = Pick<Storage, "getItem">;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSpatialCommandCenterShellFlag(storage: StorageReader | null = browserStorage()): boolean {
  try {
    return storage?.getItem(SPATIAL_COMMAND_CENTER_SHELL_FLAG) === "true";
  } catch {
    return false;
  }
}
