import keytar from 'keytar';
import { AppName } from './strings';
import { isDev } from './utils';

const ServiceName = isDev() ? AppName + ' (Development)' : AppName;
const AccountName = 'Standard Notes Account';

export async function getKeychainValue(): Promise<unknown> {
  const value = await keytar.getPassword(ServiceName, AccountName);
  if (value) {
    return JSON.parse(value);
  }
}

export function setKeychainValue(value: unknown): Promise<void> {
  return keytar.setPassword(ServiceName, AccountName, JSON.stringify(value));
}

export function clearKeychainValue(): Promise<boolean> {
  return keytar.deletePassword(ServiceName, AccountName);
}
