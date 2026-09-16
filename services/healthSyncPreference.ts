import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'eatlog.syncToAppleHealth';

export const getAppleHealthSyncEnabled = async (): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === 'true';
};

export const setAppleHealthSyncEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
};
