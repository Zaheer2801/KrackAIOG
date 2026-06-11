declare global {
  interface Window {
    electronAPI?: {
      toggleProtection: (enable: boolean) => Promise<boolean>;
      getAudioSources: () => Promise<unknown[]>;
      requestAudioPermission: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      setOpacity: (value: number) => Promise<number | null>;
      minimize?: () => void;
      toggleMaximize?: () => void;
      close?: () => void;
    };
  }
}

export {};
