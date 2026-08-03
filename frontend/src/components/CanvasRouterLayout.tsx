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
  fullWidth?: boolean;
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
  fullWidth = false,
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
        fullWidth={fullWidth}
        mainRef={mainRef}
      >
        {children}
      </SpatialCommandCenterShell>
      {overlays}
    </>
  );
}
