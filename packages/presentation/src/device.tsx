import { createContext, useContext, type ReactNode } from 'react';

export type DeviceProfile = 'phone' | 'car';
const DeviceContext = createContext<DeviceProfile>('phone');
export const useDeviceProfile = () => useContext(DeviceContext);

export function DeviceProvider({ device = 'phone', children }: { device?: DeviceProfile; children: ReactNode }) {
  return <DeviceContext value={device}><div data-device={device}>{children}</div></DeviceContext>;
}
