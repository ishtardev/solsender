import { db } from './config';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  increment, 
  Timestamp,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { PublicKey } from '@solana/web3.js';

// Type definitions for better TypeScript support
export interface Transaction {
  signature: string;
  walletAddress: string;
  amount: number;
  type: 'send' | 'receive';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  network: string;
}

export interface WalletUser {
  walletAddress: string;
  firstConnection: Date;
  lastConnection: Date;
  connectionCount: number;
  totalSent: number;
  totalReceived: number;
  transactionCount: number;
}

/**
 * Record a wallet connection in Firebase
 */
export const recordWalletConnection = async (publicKey: PublicKey) => {
  try {
    const walletAddress = publicKey.toString();
    const userRef = doc(db, "users", walletAddress);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        lastConnection: Timestamp.now(),
        connectionCount: increment(1)
      });
    } else {
      // Create new user
      await setDoc(userRef, {
        walletAddress,
        firstConnection: Timestamp.now(),
        lastConnection: Timestamp.now(),
        connectionCount: 1,
        totalSent: 0,
        totalReceived: 0,
        transactionCount: 0,
        network: "devnet" // or process.env.NEXT_PUBLIC_SOLANA_NETWORK
      });
    }
    
    console.log("Wallet connection recorded successfully");
    return true;
  } catch (error) {
    console.error("Error recording wallet connection:", error);
    return false;
  }
};

/**
 * Record a transaction in Firebase
 */
export const recordTransaction = async (
  signature: string,
  publicKey: PublicKey,
  amount: number,
  type: 'send' | 'receive',
  status: 'pending' | 'confirmed' | 'failed'
) => {
  try {
    const walletAddress = publicKey.toString();
    
    // Add transaction to transactions collection
    await addDoc(collection(db, "transactions"), {
      signature,
      walletAddress,
      amount,
      type,
      status,
      timestamp: Timestamp.now(),
      network: "devnet" // or process.env.NEXT_PUBLIC_SOLANA_NETWORK
    });
    
    // Update user stats
    const userRef = doc(db, "users", walletAddress);
    
    // Update different fields based on transaction type
    if (status === 'confirmed') {
      if (type === 'send') {
        await updateDoc(userRef, {
          totalSent: increment(amount),
          transactionCount: increment(1)
        });
      } else {
        await updateDoc(userRef, {
          totalReceived: increment(amount),
          transactionCount: increment(1)
        });
      }
    }
    
    console.log("Transaction recorded successfully");
    return true;
  } catch (error) {
    console.error("Error recording transaction:", error);
    return false;
  }
};

/**
 * Update a transaction's status in Firebase
 */
export const updateTransactionStatus = async (
  signature: string,
  status: 'confirmed' | 'failed'
) => {
  try {
    // Query to find the transaction with this signature
    const transactionsRef = collection(db, "transactions");
    const q = query(transactionsRef, where("signature", "==", signature));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("No transaction found with signature:", signature);
      return false;
    }
    
    // Update the first matching transaction
    const transactionDoc = querySnapshot.docs[0];
    await updateDoc(doc(db, "transactions", transactionDoc.id), {
      status
    });
    
    // If the transaction is confirmed, update user stats if not already done
    if (status === 'confirmed') {
      const transactionData = transactionDoc.data() as Transaction;
      const userRef = doc(db, "users", transactionData.walletAddress);
      
      // Only update stats if the transaction was previously pending
      if (transactionData.status === 'pending') {
        if (transactionData.type === 'send') {
          await updateDoc(userRef, {
            totalSent: increment(transactionData.amount),
            transactionCount: increment(1)
          });
        } else {
          await updateDoc(userRef, {
            totalReceived: increment(transactionData.amount),
            transactionCount: increment(1)
          });
        }
      }
    }
    
    console.log("Transaction status updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating transaction status:", error);
    return false;
  }
};

/**
 * Get wallet statistics for a user
 */
export const getWalletStats = async (publicKey: PublicKey) => {
  try {
    const walletAddress = publicKey.toString();
    const userRef = doc(db, "users", walletAddress);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return userDoc.data() as WalletUser;
  } catch (error) {
    console.error("Error getting wallet stats:", error);
    return null;
  }
};
