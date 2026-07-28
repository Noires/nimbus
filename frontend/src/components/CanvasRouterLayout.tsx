import type { ReactNode, Ref } from "react";
import { SpatialCommandCenterShell } from "./SpatialCommandCenterShell";

interface CanvasRouterLayoutProps {
  spatialCommandCenterShell?: boolean;
  navigationLabel: string;
  commandLabel: string;
  railLabel?: string;
  navigation: ReactNode;
  commands: ReactNode;
  rail?: ReactNode;
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
  overlays: ReactNode;
}

export function CanvasRouterLayout({
  spatialCommandCenterShell,
  navigationLabel,
  commandLabel,
  railLabel,
  navigation,
  commands,
  rail,
  mainRef,
  children,
  overlays,
}: CanvasRouterLayoutProps) {
  if (spatialCommandCenterShell === true) {
    return (
      <>
        <SpatialCommandCenterShell
          navigationLabel={navigationLabel}
          commandLabel={commandLabel}
          railLabel={railLabel}
          navigation={navigation}
          commands={commands}
          rail={rail}
          mainRef={mainRef}
        >
          {children}
        </SpatialCommandCenterShell>
        {overlays}
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f13] text-gray-100 font-sans">
      <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-[#1a1d24]/90 backdrop-blur-sm p-4 overflow-y-auto">
        {navigation}
      </aside>
      <main ref={mainRef} className="flex-1 h-full overflow-hidden relative">
        {commands}
        {children}
      </main>
      {overlays}
    </div>
  );
}
