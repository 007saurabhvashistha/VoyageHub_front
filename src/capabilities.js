import { createContext, useContext } from 'react';

export const CapabilitiesContext = createContext([]);

export function useCan(capability) {
  return useContext(CapabilitiesContext).includes(capability);
}
