import type { ReactNode, Ref } from "react";
import { SpatialCommandCenterShell } from "./SpatialCommandCenterShell";

interface CanvasRouterLayoutProps {
  navigationLabel: string;
  commandLabel: string;
  railLabel?: string;
  closeRailLabel?: string;
  onCloseRail?: () => void;
  navigation: ReactNode;
  commands: ReactNode;
  rail?: ReactNode;
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
  overlays: ReactNode;
}

export function CanvasRouterLayout({
  navigationLabel,
  commandLabel,
  railLabel,
  closeRailLabel,
  onCloseRail,
  navigation,
  commands,
  rail,
  mainRef,
  children,
  overlays,
}: CanvasRouterLayoutProps) {
  return (
    <>
      <SpatialCommandCenterShell
        navigationLabel={navigationLabel}
        commandLabel={commandLabel}
        railLabel={railLabel}
        closeRailLabel={closeRailLabel}
        onCloseRail={onCloseRail}
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
