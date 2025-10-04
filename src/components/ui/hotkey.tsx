"use client";

import { useHotkeys } from "react-hotkeys-hook";

interface HotkeyProps {
  hint: string | number;
  onPress: () => void;
}

export const Hotkey = ({ hint, onPress }: HotkeyProps) => {
  useHotkeys(hint.toString(), () => {
    onPress();
  });

  return <div className="hotkey">{hint}</div>;
};
