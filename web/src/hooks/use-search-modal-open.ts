import { createContext, useContext } from 'react'

export const SearchModalOpenContext = createContext(false)

export function useSearchModalOpen() {
  return useContext(SearchModalOpenContext)
}
