import { Result } from 'neverthrow'

export const getStorageItem = Result.fromThrowable((key: string) =>
  localStorage.getItem(key),
)
export const setStorageItem = Result.fromThrowable(
  (key: string, value: string) => {
    localStorage.setItem(key, value)
  },
)
