import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "MineShield OCC", description: "Mine subsidence operations control center" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
