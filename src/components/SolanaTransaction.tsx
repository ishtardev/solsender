'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  PublicKey,
} from '@solana/web3.js';

// Import Firebase services
import { recordWalletConnection, recordTransaction, updateTransactionStatus, getWalletStats } from '../firebase/services';
import { initializeAnalytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';
import FirebaseStats from './FirebaseStats';

// Destination address for the transaction (replace with your desired address)
// Using a known devnet address - replace with your own receiving address
const DESTINATION_ADDRESS = 'DemoKEY1111111111111111111111111111111111111'; // Demo address - replace with actual recipient

export default function SolanaTransaction() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [recipientAddress, setRecipientAddress] = useState(DESTINATION_ADDRESS);
  const [transactions, setTransactions] = useState<{
    signature: string;
    status: 'pending' | 'confirmed' | 'failed';
    amount: number;
    type: 'send' | 'receive';
    timestamp: number;
  }[]>([]);
  
  // Function to validate Solana addresses
  const isValidAddress = useCallback((address: string) => {
    try {
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // Function to fetch wallet balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const balance = await connection.getBalance(publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error("Failed to fetch balance", error);
    }
  }, [publicKey, connection]);

  // Fetch balance when wallet connects or after transactions
  useEffect(() => {
    if (publicKey) {
      fetchBalance();
      
      // Record wallet connection in Firebase
      recordWalletConnection(publicKey).catch(error => 
        console.error("Failed to record wallet connection:", error)
      );
      
      // Initialize analytics and log wallet connection event
      initializeAnalytics().then(analytics => {
        if (analytics) {
          logEvent(analytics, 'wallet_connected', {
            wallet_address: publicKey.toString()
          });
        }
      });
    } else {
      setBalance(null);
    }
  }, [publicKey, fetchBalance]);

  // Update balance after confirmed transactions
  useEffect(() => {
    if (message.includes('confirmed') || message.includes('✅')) {
      fetchBalance();
    }
  }, [message, fetchBalance]);

  const handleTransaction = useCallback(async () => {
    if (!publicKey) {
      setMessage('Please connect your wallet first');
      return;
    }
    
    if (!isValidAddress(recipientAddress)) {
      setMessage('Invalid recipient address');
      return;
    }

    setIsLoading(true);
    setMessage('');
    let retries = 3;

    while (retries > 0) {
      try {
        // Check wallet balance
        const balance = await connection.getBalance(publicKey);
        const balanceInSol = balance / LAMPORTS_PER_SOL;
        
        if (balanceInSol < 0.5) {
          setMessage(`Insufficient balance. You have ${balanceInSol.toFixed(4)} SOL, but need at least 0.5 SOL plus gas fees.`);
          break;
        }

        // Create transaction
        const transaction = new Transaction();
        
        // Set the fee payer and get recent blockhash first
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;
        
        // Add the transfer instruction
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(recipientAddress),
            lamports: 0.5 * LAMPORTS_PER_SOL, // 0.5 SOL
          })
        );

        // Simulate transaction
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          setMessage(`Simulation failed: ${simulation.value.err.toString()}`);
          break;
        }

        // Send transaction
        const signature = await sendTransaction(transaction, connection);
        console.log('Transaction sent with signature:', signature);
        
        // Add to transaction history
        const newTx = {
          signature,
          status: 'pending' as const,
          amount: 0.5,
          type: 'send' as const,
          timestamp: Date.now()
        };
        setTransactions(prev => [newTx, ...prev]);
        
        // Record transaction in Firebase
        recordTransaction(
          signature,
          publicKey,
          0.5,
          'send',
          'pending'
        ).catch(error => console.error("Failed to record transaction:", error));
        
        // Log analytics event
        initializeAnalytics().then(analytics => {
          if (analytics) {
            logEvent(analytics, 'transaction_sent', {
              amount: 0.5,
              recipient: recipientAddress
            });
          }
        });
        
        setMessage(`Transaction sent! Confirming... Signature: ${signature}`);
        
        // Wait for confirmation with specific config
        try {
          const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');
          
          if (confirmation.value.err) {
            throw new Error(`Transaction confirmed but failed: ${confirmation.value.err.toString()}`);
          }
          
          // Update transaction status
          setTransactions(prev => 
            prev.map(tx => 
              tx.signature === signature 
                ? {...tx, status: 'confirmed'} 
                : tx
            )
          );
          
          // Update transaction status in Firebase
          updateTransactionStatus(signature, 'confirmed')
            .catch(error => console.error("Failed to update transaction status:", error));
          
          // Log analytics event
          initializeAnalytics().then(analytics => {
            if (analytics) {
              logEvent(analytics, 'transaction_confirmed', {
                signature: signature
              });
            }
          });
          
          setMessage(`Transaction confirmed! ✅ Signature: ${signature}`);
        } catch (confirmError) {
          console.error('Confirmation error:', confirmError);
          setMessage(`Transaction may have failed: ${confirmError instanceof Error ? confirmError.message : 'Unknown error'}`);
          
          // Check if transaction was actually confirmed despite the error
          try {
            const status = await connection.getSignatureStatus(signature);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
              setTransactions(prev => 
                prev.map(tx => 
                  tx.signature === signature 
                    ? {...tx, status: 'confirmed'} 
                    : tx
                )
              );
              setMessage(`Transaction confirmed! ✅ Signature: ${signature}`);
            } else {
              throw new Error('Transaction not confirmed');
            }
          } catch (statusError) {
            // Mark transaction as failed in history
            setTransactions(prev => 
              prev.map(tx => 
                tx.signature === signature 
                  ? {...tx, status: 'failed'} 
                  : tx
              )
            );
            setMessage(`Transaction failed: Could not confirm status`);
          }
        }
        
        setMessage(`Transaction confirmed! ✅ Signature: ${signature}`);
        setTotalInvested(prev => prev + 0.5);
        fetchBalance();
        break;
        
      } catch (error: any) {
        console.error('Transaction attempt failed:', error);
        retries--;
        
        if (error.message?.includes('blockhash')) {
          // Retry with fresh blockhash
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        if (retries === 0) {
          // Format user-friendly error message
          let errorMsg = 'Transaction failed';
          if (error.message?.includes('insufficient funds')) {
            errorMsg = 'Insufficient funds for transaction';
          } else if (error.message?.includes('user rejected')) {
            errorMsg = 'Transaction cancelled by user';
          } else {
            errorMsg = `Error: ${error.message || 'Unknown error'}`;
          }
          setMessage(errorMsg);
          
          // Update any pending transaction as failed
          setTransactions(prev => 
            prev.map(tx => 
              tx.status === 'pending' 
                ? {...tx, status: 'failed'} 
                : tx
            )
          );
        }
      }
    }
    
    setIsLoading(false);
  }, [publicKey, connection, sendTransaction, recipientAddress, isValidAddress, fetchBalance]);
  
  const handleReceive = useCallback(async () => {
    if (!publicKey) {
      setMessage('Please connect your wallet first');
      return;
    }

    setIsReceiving(true);
    setMessage('');
    let retries = 2;

    while (retries > 0) {
      try {
        // Get recent blockhash first to use for confirmation
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        
        // Request airdrop (0.5 SOL)
        const signature = await connection.requestAirdrop(
          publicKey,
          0.5 * LAMPORTS_PER_SOL
        );
        
        console.log('Airdrop requested with signature:', signature);
        
        // Add to transaction history
        const newTx = {
          signature,
          status: 'pending' as const,
          amount: 0.5,
          type: 'receive' as const,
          timestamp: Date.now()
        };
        setTransactions(prev => [newTx, ...prev]);
        
        // Record transaction in Firebase
        recordTransaction(
          signature,
          publicKey,
          0.5,
          'receive',
          'pending'
        ).catch(error => console.error("Failed to record transaction:", error));
        
        // Log analytics event
        initializeAnalytics().then(analytics => {
          if (analytics) {
            logEvent(analytics, 'airdrop_requested', {
              amount: 0.5
            });
          }
        });
        
        setMessage(`Airdrop requested! Confirming... Signature: ${signature}`);
        
        // Wait for confirmation with more reliable method
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction confirmed but failed: ${confirmation.value.err.toString()}`);
        }
        
        // Update transaction status
        setTransactions(prev => 
          prev.map(tx => 
            tx.signature === signature 
              ? {...tx, status: 'confirmed'} 
              : tx
          )
        );
        
        // Update transaction status in Firebase
        updateTransactionStatus(signature, 'confirmed')
          .catch(error => console.error("Failed to update transaction status:", error));
          
        // Log analytics event
        initializeAnalytics().then(analytics => {
          if (analytics) {
            logEvent(analytics, 'airdrop_confirmed', {
              signature: signature,
              amount: 0.5
            });
          }
        });
        
        setMessage(`Airdrop of 0.5 SOL received! ✅ Signature: ${signature}`);
        setTotalReceived(prev => prev + 0.5);
        fetchBalance();
        break;
        
      } catch (error: any) {
        console.error('Airdrop failed:', error);
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: error.code,
        });
        
        retries--;
        
        if (retries === 0) {
          // Try to provide more helpful error messages
          let errorMessage = 'Unknown error. Devnet faucet may be rate-limited or down.';
          
          if (error.message?.includes('429')) {
            errorMessage = 'Faucet rate limit exceeded. Please try again later.';
          } else if (error.message?.includes('blockhash')) {
            errorMessage = 'Blockhash expired. Network may be congested.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          setMessage(`Airdrop failed: ${errorMessage}`);
          
          // Update any pending transaction as failed
          setTransactions(prev => 
            prev.map(tx => 
              tx.status === 'pending' 
                ? {...tx, status: 'failed'} 
                : tx
            )
          );
        } else {
          // Wait a bit before retrying
          console.log(`Retrying airdrop, ${retries} attempts left`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    setIsReceiving(false);
  }, [publicKey, connection, fetchBalance]);

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
            
            {/* Firebase Stats Fetcher */}
            {publicKey && <FirebaseStats publicKey={publicKey} />}

            {/* Wallet Status and Balance */}
            {publicKey && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <p className="text-green-300 text-sm">
                    Connected: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                  </p>
                  <div className="text-right">
                    <p className="text-sm text-gray-300">Balance:</p>
                    <p className="text-lg font-bold text-white">
                      {balance !== null ? `${balance.toFixed(4)} SOL` : 
                        <span className="text-gray-400 text-sm">Loading...</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recipient Address Input */}
            {publicKey && (
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm">Recipient Address</label>
                <input 
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter Solana address"
                  className="w-full bg-white/10 rounded-lg border border-white/20 p-3 text-white text-sm"
                />
                {recipientAddress && !isValidAddress(recipientAddress) && (
                  <p className="text-red-400 text-xs mt-1">Invalid Solana address</p>
                )}
              </div>
            )}

            {/* Transaction Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleTransaction}
                disabled={!publicKey || isLoading || isReceiving || !isValidAddress(recipientAddress)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
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
              
              <button
                onClick={handleReceive}
                disabled={!publicKey || isLoading || isReceiving}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
              >
                {isReceiving ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Requesting...
                  </span>
                ) : (
                  'Receive 0.5 SOL Transaction'
                )}
              </button>
            </div>

            {/* Transaction Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-6 text-center">
                <h3 className="text-xl font-semibold text-blue-300 mb-2">Total SOL Invested</h3>
                <p className="text-3xl font-bold text-white">{totalInvested.toFixed(1)} SOL</p>
              </div>
              
              <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-lg p-6 text-center">
                <h3 className="text-xl font-semibold text-emerald-300 mb-2">Total SOL Received</h3>
                <p className="text-3xl font-bold text-white">{totalReceived.toFixed(1)} SOL</p>
              </div>
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
            
            {/* Transaction History */}
            {transactions.length > 0 && (
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 mt-6">
                <h3 className="text-xl font-semibold text-white mb-3">Transaction History</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.signature} 
                      className={`border rounded-lg p-3 text-sm ${
                        tx.status === 'confirmed'
                          ? 'bg-green-500/10 border-green-500/30'
                          : tx.status === 'failed'
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-yellow-500/10 border-yellow-500/30'
                      }`}
                    >
                      <div className="flex justify-between mb-1">
                        <span className={`font-medium ${
                          tx.type === 'send' ? 'text-orange-400' : 'text-emerald-400'
                        }`}>
                          {tx.type === 'send' ? 'Sent' : 'Received'} {tx.amount} SOL
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tx.status === 'confirmed'
                            ? 'bg-green-500/20 text-green-300'
                            : tx.status === 'failed'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {tx.status === 'confirmed' ? 'Success' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 truncate" title={tx.signature}>
                        Signature: {tx.signature.slice(0, 12)}...{tx.signature.slice(-12)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                      <div className="mt-1">
                        <a 
                          href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View on Explorer ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-500/20 border border-gray-500/50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-300 mb-2">Instructions:</h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Connect your wallet (Phantom, Solflare, or others)</li>
                <li>Make sure you're on Solana Devnet</li>
                <li>Click "Receive 0.5 SOL" to get test SOL from the devnet faucet</li>
                <li>Enter a recipient address or use the default</li>
                <li>Click "Send 0.5 SOL" to make a transaction (ensure you have SOL + gas fees)</li>
                <li>Confirm any transactions in your wallet when prompted</li>
                <li>View your transaction history below</li>
              </ol>
              <p className="text-xs text-gray-500 mt-3">
                💡 Note: The receive button uses Solana's devnet faucet which may have rate limits
              </p>
              <p className="text-xs text-gray-500 mt-1">
                💡 Click "View on Explorer" to see detailed transaction information
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
