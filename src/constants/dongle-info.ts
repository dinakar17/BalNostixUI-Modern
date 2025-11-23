/**
 * Dongle serial number store
 * Singleton store for current dongle serial number
 */
let currentSerialNo: string | null = null;

export const dongleStore = {
  getSerialNo: (): string | null => currentSerialNo,
  setSerialNo: (serial: string): void => {
    currentSerialNo = serial;
  },
  clearSerialNo: (): void => {
    currentSerialNo = null;
  },
};
