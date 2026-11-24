"use client";

import dynamic from "next/dynamic";
import { usePlayer } from "./player-provider";

// The player UI is downloaded the first time something is played, not on every page load.
const PlayerBar = dynamic(() => import("./player-bar").then((m) => m.PlayerBar), { ssr: false });

export function PlayerBarLazy() {
  const p = usePlayer();
  return p.current ? <PlayerBar /> : null;
}
