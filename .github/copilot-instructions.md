# Solana Devnet Transaction Demo - Copilot Instructions

This workspace contains a Next.js application with Phantom wallet integration for Solana devnet transactions.

## Project Overview
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Solana (Devnet)
- **Wallet**: Phantom Wallet Integration

## Key Features Implemented
✅ Next.js application with TypeScript and Tailwind CSS
✅ Phantom wallet connection via @solana/wallet-adapter
✅ Real Solana devnet integration
✅ Transaction button that sends 0.5 SOL
✅ Transaction confirmation through Phantom wallet
✅ Counter to track total SOL invested
✅ Proper error handling and user feedback
✅ Beautiful gradient UI with loading states

## Architecture

### Components
- `src/app/layout.tsx` - Root layout with WalletContextProvider
- `src/app/page.tsx` - Main page that renders SolanaTransaction component
- `src/components/SolanaTransaction.tsx` - Main transaction interface
- `src/contexts/WalletContextProvider.tsx` - Wallet adapter setup for Solana

### Key Dependencies
- `@solana/web3.js` - Core Solana blockchain interaction
- `@solana/wallet-adapter-*` - Wallet connection and UI components
- `next` - React framework
- `tailwindcss` - Utility-first CSS framework

## Development Guidelines

### When modifying transaction logic:
- Always test on Solana devnet first
- Verify transaction amounts and destinations
- Include proper error handling for network issues
- Update loading states for better UX

### When styling components:
- Use Tailwind CSS classes for consistency
- Maintain the gradient theme (purple/blue/indigo)
- Ensure responsive design for mobile devices
- Keep accessibility in mind

### When adding new features:
- Follow the existing TypeScript patterns
- Add proper error boundaries
- Include loading states for async operations
- Update the README.md with new instructions

## Configuration Notes
- Network: Solana Devnet (configurable in WalletContextProvider)
- Transaction amount: 0.5 SOL (configurable in SolanaTransaction)
- Destination address: Currently set to System Program (placeholder)

## Security Considerations
- This is a demo/educational application
- Always validate inputs and transaction details
- Never expose private keys or sensitive data
- Use devnet only for testing

## Common Development Tasks

### To change transaction amount:
Edit the lamports value in `src/components/SolanaTransaction.tsx`

### To change destination address:
Update the DESTINATION_ADDRESS constant in `src/components/SolanaTransaction.tsx`

### To add new wallet providers:
Add them to the wallets array in `src/contexts/WalletContextProvider.tsx`

### To modify network:
Change the network constant in `src/contexts/WalletContextProvider.tsx`

## Troubleshooting
- Webpack fallbacks are configured in `next.config.ts` for browser compatibility
- Wallet adapter CSS is imported in the context provider
- Development server runs on http://localhost:3000
