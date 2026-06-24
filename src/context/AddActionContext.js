import { createContext, useContext } from 'react';

// Provides the shell's "add" handler (the action behind the Material FAB) to
// any component below AppShell — notably the iOS-skin TopBar, which surfaces it
// as a "+" button in the navigation bar instead of a floating action button.
export const AddActionContext = createContext(null);

export function useAddAction() {
  return useContext(AddActionContext);
}
