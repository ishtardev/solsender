'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import the wallet provider to prevent SSR issues
const WalletContextProvider = dynamic(
  () => import('./WalletContextProvider').then((mod) => ({ default: mod.WalletContextProvider })),
  {
    ssr: false,
    loading: () => <div>Loading wallet...</div>
  }
);

interface ClientWalletProviderProps {
  children: ReactNode;
}

export default function ClientWalletProvider({ children }: ClientWalletProviderProps) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
