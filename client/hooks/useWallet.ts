import { useState, useEffect } from "react";
import { WalletService } from "../services/wallet.service";
import { supabase } from "../lib/supabase";
import { ethers } from "ethers";
import type { ProviderEvent } from "ethers";

export function useWallet() {
  const [walletInfo, setWalletInfo] = useState<{
    address: string | null;
    privateKey: string | null;
    mnemonic: string | null;
  }>({
    address: null,
    privateKey: null,
    mnemonic: null,
  });
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<{ token: number; eth: string }>({
    token: 0,
    eth: "0",
  });
  const [prices, setPrices] = useState<{ eth: number; usdt: number }>({
    eth: 180000,
    usdt: 83,
  });

  useEffect(() => {
    let mounted = true;
    const initWallet = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        // Get or create the initial wallet record
        const { data: walletRecord } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!walletRecord) {
          // Create initial wallet record if none exists
          await supabase.from("wallets").insert([
            {
              user_id: user.id,
              token_balance: 1000,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        }

        // Now try to get or create the blockchain wallet
        const existingWallet = await WalletService.getWalletInfo();
        if (existingWallet && mounted) {
          console.log("Using existing wallet:", existingWallet.address);
          setWalletInfo({
            address: existingWallet.address,
            privateKey: existingWallet.privateKey,
            mnemonic: existingWallet.mnemonic,
          });
          return; // Exit early if wallet exists
        }

        // Only create new wallet if none exists
        if (!existingWallet && mounted) {
          console.log("No wallet found, creating new one");
          const newWallet = await WalletService.createWallet();
          setWalletInfo({
            address: newWallet.address,
            privateKey: newWallet.privateKey,
            mnemonic: newWallet.mnemonic,
          });
        }
      } catch (error) {
        console.error("Error initializing wallet:", error);
      }
    };

    initWallet();

    // Load initial ETH balance
    const loadEthBalance = async () => {
      if (walletInfo.address) {
        try {
          const { balance } = await WalletService.getWalletBalance(
            walletInfo.address,
            "onchain"
          );
          if (mounted) {
            setBalance((prev) => ({ ...prev, eth: balance }));
          }
        } catch (error) {
          console.error("Error loading ETH balance:", error);
        }
      }
    };

    // Poll ETH balance more frequently (every 10 seconds)
    loadEthBalance();
    const pollEthBalance = setInterval(loadEthBalance, 10000);

    // Real-time subscription to wallet changes
    const walletSubscription = supabase
      .channel("wallet_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets" },
        async (payload) => {
          if (mounted) {
            setBalance((prev) => ({
              ...prev,
              token: payload.new.token_balance,
            }));
            // Also refresh ETH balance when token balance changes
            loadEthBalance();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(pollEthBalance);
      walletSubscription.unsubscribe();
    };
  }, [walletInfo.address]); // Add address as dependency

  useEffect(() => {
    let mounted = true;
    const pollInterval = 15000; // 15 seconds

    const loadEthBalance = async () => {
      if (walletInfo.address) {
        try {
          const { balance } = await WalletService.getWalletBalance(
            walletInfo.address,
            "onchain"
          );
          if (mounted) {
            setBalance((prev) => ({ ...prev, eth: balance }));
          }
        } catch (error) {
          console.error("Error loading ETH balance:", error);
        }
      }
    };

    // Load initial balance
    loadEthBalance();

    // Set up polling
    const intervalId = setInterval(loadEthBalance, pollInterval);

    // Set up block listener for quicker updates
    if (walletInfo.address) {
      const provider = WalletService.provider;
      provider.on("block", async () => {
        if (mounted) {
          await loadEthBalance();
        }
      });

      return () => {
        mounted = false;
        clearInterval(intervalId);
        provider.removeAllListeners("block");
      };
    }

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [walletInfo.address]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tether&vs_currencies=inr"
        );
        const data = await response.json();
        setPrices({
          eth: data.ethereum.inr,
          usdt: data.tether.inr,
        });
      } catch (error) {
        console.error("Error fetching prices:", error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const createWallet = async () => {
    try {
      setLoading(true);
      const info = await WalletService.createWallet();
      setWalletInfo({
        address: info.address,
        privateKey: info.privateKey,
        mnemonic: info.mnemonic,
      });
      return info;
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    address: walletInfo.address,
    loading,
    createWallet,
    balance,
    prices,
  };
}
