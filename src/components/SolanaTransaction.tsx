'use client';

import React, { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  PublicKey 
} from '@solana/web3.js';

export default function SolanaTransaction() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [totalInvested, setTotalInvested] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Destination address for the transaction (replace with your desired address)
  // Using a known devnet address - replace with your own receiving address
  const DESTINATION_ADDRESS = 'DemoKEY1111111111111111111111111111111111111'; // Demo address - replace with actual recipient

  const handleTransaction = useCallback(async () => {
    if (!publicKey) {
      setMessage('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Check wallet balance
      const balance = await connection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      
      if (balanceInSol < 0.5) {
        setMessage(`Insufficient balance. You have ${balanceInSol.toFixed(4)} SOL, but need at least 0.5 SOL plus gas fees.`);
        setIsLoading(false);
        return;
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(DESTINATION_ADDRESS),
          lamports: 0.5 * LAMPORTS_PER_SOL, // 0.5 SOL
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      setMessage(`Transaction sent! Signature: ${signature}`);
      
      // Wait for confirmation
      setMessage(`Transaction sent! Confirming... Signature: ${signature}`);
      
      await connection.confirmTransaction(signature, 'confirmed');
      
      setMessage(`Transaction confirmed! ✅ Signature: ${signature}`);
      setTotalInvested(prev => prev + 0.5);
      
    } catch (error: any) {
      console.error('Transaction failed:', error);
      setMessage(`Transaction failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection, sendTransaction]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-8 text-center">
            SOL Sender - Multi-Wallet Support
          </h1>
          
          <div className="space-y-6">
            {/* Wallet Connection */}
            <div className="text-center">
              <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700 !rounded-xl !px-6 !py-3 !text-white !font-semibold !transition-all !duration-200" />
            </div>

            {/* Wallet Status */}
            {publicKey && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  Connected: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                </p>
              </div>
            )}

            {/* Transaction Button */}
            <div className="text-center">
              <button
                onClick={handleTransaction}
                disabled={!publicKey || isLoading}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Send 0.5 SOL Transaction'
                )}
              </button>
            </div>

            {/* Total Investment Counter */}
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-blue-300 mb-2">Total SOL Invested</h3>
              <p className="text-3xl font-bold text-white">{totalInvested.toFixed(1)} SOL</p>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`border rounded-lg p-4 break-all ${
                message.includes('confirmed') || message.includes('✅') 
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : message.includes('failed') || message.includes('Insufficient')
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-500/20 border border-gray-500/50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-300 mb-2">Instructions:</h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Connect your wallet (Phantom, Solflare, or others)</li>
                <li>Make sure you're on Solana Devnet</li>
                <li>Ensure you have at least 0.5 SOL + gas fees</li>
                <li>Click the transaction button to send 0.5 SOL</li>
                <li>Confirm the transaction in your wallet</li>
              </ol>
              <p className="text-xs text-gray-500 mt-3">
                💡 Get free devnet SOL at: https://faucet.solana.com/
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
