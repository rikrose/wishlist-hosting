import { createContext, useContext } from "react";
import { THEMES, type ThemeDefinition, type ThemeId } from "#/themes/registry";

const ThemeContext = createContext<ThemeDefinition>(THEMES.playful);

export function ThemeProvider({ theme, children }: { theme: ThemeId; children: React.ReactNode }) {
  return <ThemeContext.Provider value={THEMES[theme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeDefinition {
  return useContext(ThemeContext);
}
