'use client';

import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getWalletStats } from '../firebase/services';
import { WalletUser } from '../firebase/services';

interface FirebaseStatsProps {
  publicKey: PublicKey;
}

const FirebaseStats = ({ publicKey }: FirebaseStatsProps) => {
  const [stats, setStats] = useState<WalletUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const walletStats = await getWalletStats(publicKey);
        setStats(walletStats);
        setError(null);
      } catch (err) {
        console.error('Error fetching wallet stats:', err);
        setError('Failed to load wallet statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [publicKey]);

  if (loading) {
    return (
      <div className="bg-indigo-500/20 border border-indigo-500/50 rounded-lg p-3 animate-pulse">
        <p className="text-indigo-300 text-center">Loading stats...</p>
      </div>
    );
  }

  if (error) {
    return null; // Don't show errors to user
  }

  // If no stats yet or first-time user
  if (!stats) {
    return null;
  }

  return (
    <div className="bg-indigo-500/20 border border-indigo-500/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-indigo-300 mb-2">Your Wallet Activity</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-600/30 rounded-lg p-2 text-center">
          <p className="text-xs text-indigo-300">Connections</p>
          <p className="text-xl font-bold text-white">{stats.connectionCount}</p>
        </div>
        
        <div className="bg-indigo-600/30 rounded-lg p-2 text-center">
          <p className="text-xs text-indigo-300">Transactions</p>
          <p className="text-xl font-bold text-white">{stats.transactionCount}</p>
        </div>
        
        <div className="bg-indigo-600/30 rounded-lg p-2 text-center">
          <p className="text-xs text-indigo-300">Total Sent</p>
          <p className="text-lg font-bold text-white">{stats.totalSent.toFixed(1)} SOL</p>
        </div>
        
        <div className="bg-indigo-600/30 rounded-lg p-2 text-center">
          <p className="text-xs text-indigo-300">Total Received</p>
          <p className="text-lg font-bold text-white">{stats.totalReceived.toFixed(1)} SOL</p>
        </div>
      </div>
      
      <p className="text-xs text-indigo-200 mt-2 text-center">
        First connected: {stats.firstConnection instanceof Date 
          ? stats.firstConnection.toLocaleDateString() 
          : new Date(stats.firstConnection).toLocaleDateString()}
      </p>
    </div>
  );
};

export default FirebaseStats;
