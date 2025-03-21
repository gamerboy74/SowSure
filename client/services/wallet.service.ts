import { supabase } from "../lib/supabase";
import type { WalletTransaction } from "../types/types";
import { Wallet, ethers, JsonRpcProvider, TransactionResponse } from "ethers";
import * as CryptoJS from "crypto-js";
import EventEmitter from "eventemitter3"; // Updated import

export class WalletService {
  private static TESTNET_RPC_URL = import.meta.env.VITE_PUBLIC_ALCHEMY_RPC_URL;
  private static ENCRYPTION_KEY = import.meta.env.VITE_WALLET_ENCRYPTION_KEY;
  public static provider = new JsonRpcProvider(WalletService.TESTNET_RPC_URL);
  private static eventEmitter = new EventEmitter(); // Updated to use eventemitter3

  static subscribeToBalanceUpdates(
    address: string,
    callback: (balance: string) => void
  ) {
    this.eventEmitter.on(`balance:${address}`, callback);
    return () => this.eventEmitter.off(`balance:${address}`, callback);
  }

  static async getWalletBalance(
    addressOrUserId: string,
    type: "onchain" | "token" = "token"
  ) {
    try {
      if (type === "onchain") {
        // Add cache busting and retry logic for ETH balance
        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
          try {
            const balance = await this.provider.getBalance(addressOrUserId);
            const formattedBalance = ethers.formatEther(balance);

            // Emit balance update event
            this.eventEmitter.emit(
              `balance:${addressOrUserId}`,
              formattedBalance
            );

            console.log(
              "ETH Balance fetched:",
              formattedBalance,
              "for address:",
              addressOrUserId
            );
            return {
              balance: formattedBalance,
              type: "ETH",
            };
          } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s between retries
          }
        }
        throw lastError;
      } else {
        // Get off-chain token balance from Supabase
        const { data, error } = await supabase
          .from("wallets")
          .select("token_balance")
          .eq("user_id", addressOrUserId)
          .single();

        if (error) throw error;
        return {
          balance: data.token_balance,
          type: "TOKEN",
        };
      }
    } catch (error) {
      console.error("Error getting balance:", error);
      throw error;
    }
  }

  static async createTransaction(
    walletId: string,
    amount: number,
    type: WalletTransaction["type"],
    metadata?: WalletTransaction["metadata"]
  ) {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        amount,
        type,
        status: "PENDING",
        metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getTransactionHistory(walletId: string, limit = 10) {
    try {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("wallet_address")
        .eq("id", walletId)
        .single();

      if (!wallet?.wallet_address) throw new Error("Wallet not found");

      // First get transactions from database
      const { data: dbTx } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .limit(limit);

      // Get latest block number
      const latestBlock = await this.provider.getBlockNumber();
      const blockRange = 100; // Reduced block range to avoid RPC limits

      // Get recent transactions in smaller chunks
      const address = wallet.wallet_address.toLowerCase();
      let transactions: any[] = [];

      try {
        const filter = {
          address,
          fromBlock: latestBlock - blockRange,
          toBlock: latestBlock,
        };

        const logs = await this.provider.getLogs(filter);

        // Process new transactions
        for (const log of logs) {
          const tx = await this.provider.getTransaction(log.transactionHash);
          if (!tx) continue;

          const existingTx = dbTx?.find((t) => t.metadata?.txHash === tx.hash);
          if (!existingTx) {
            const isReceived = tx.to?.toLowerCase() === address;
            const value = parseFloat(ethers.formatEther(tx.value));

            // Create new transaction record
            await this.createTransaction(
              walletId,
              value,
              isReceived ? "DEPOSIT" : "WITHDRAWAL",
              {
                txHash: tx.hash,
                fromAddress: tx.from,
                toAddress: tx.to,
                network: "sepolia",
              }
            );
          }
        }
      } catch (error) {
        console.warn("Error fetching recent logs:", error);
      }

      // Get final updated transactions
      const { data: finalTx } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return finalTx || [];
    } catch (error) {
      console.error("Error getting transaction history:", error);
      throw error;
    }
  }

  static async transferTokens(
    fromWalletId: string,
    toAddress: string,
    amount: number | string,
    isEth: boolean = false
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const walletInfo = await this.getWalletInfo();
      if (!walletInfo?.privateKey) throw new Error("No wallet found");

      if (isEth) {
        // Convert amount to string for ETH transactions
        const amountString = amount.toString();
        const tx = await this.sendTransaction(
          walletInfo.privateKey,
          toAddress,
          amountString
        );
        return tx;
      } else {
        // Transfer USDT tokens (existing token transfer logic)
        const { data, error } = await supabase.rpc("transfer_tokens", {
          from_wallet_id: fromWalletId,
          to_wallet_id: toAddress,
          amount: typeof amount === "string" ? parseFloat(amount) : amount,
        });

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error("Error transferring funds:", error);
      throw error;
    }
  }

  static async createWallet(): Promise<{
    address: string;
    privateKey: string;
    mnemonic: string;
  }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create new wallet
      const wallet = Wallet.createRandom().connect(this.provider);
      const address = wallet.address;
      const privateKey = wallet.privateKey;
      const mnemonic = wallet.mnemonic?.phrase || "";

      // First check if wallet exists
      const { data: existingWallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existingWallet) {
        // Update existing wallet
        const { error: updateError } = await supabase
          .from("wallets")
          .update({
            wallet_address: address,
            encrypted_private_key: await this.encrypt(privateKey),
            encrypted_mnemonic: await this.encrypt(mnemonic),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingWallet.id);

        if (updateError) throw updateError;
      } else {
        // Insert new wallet
        const { error: insertError } = await supabase.from("wallets").insert([
          {
            user_id: user.id,
            wallet_address: address,
            encrypted_private_key: await this.encrypt(privateKey),
            encrypted_mnemonic: await this.encrypt(mnemonic),
            token_balance: 1000,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        if (insertError) throw insertError;
      }

      await this.requestTestEth(address);
      return { address, privateKey, mnemonic };
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  static async requestTestEth(address: string) {
    console.log(
      `Please get test ETH from Sepolia faucet for address: ${address}`
    );
    console.log("Faucet URL: https://sepoliafaucet.com/");
  }

  static async sendTransaction(
    fromPrivateKey: string,
    toAddress: string,
    amount: string
  ) {
    try {
      const wallet = new Wallet(fromPrivateKey, this.provider);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      // Wait for transaction to be mined
      await tx.wait();

      // Create transaction record in database
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: walletData } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!walletData) throw new Error("Wallet not found");

      await this.createTransaction(
        walletData.id,
        parseFloat(amount),
        "WITHDRAWAL",
        {
          txHash: tx.hash,
          toAddress,
          network: "sepolia",
        }
      );

      return tx;
    } catch (error) {
      console.error("Error sending transaction:", error);
      throw error;
    }
  }

  static async getWalletInfo(): Promise<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("wallet_address, encrypted_private_key, encrypted_mnemonic")
        .eq("user_id", user.id)
        .single();

      // Add null checks
      if (
        !wallet?.wallet_address ||
        !wallet?.encrypted_private_key ||
        !wallet?.encrypted_mnemonic
      ) {
        return null;
      }

      const privateKey = await this.decrypt(wallet.encrypted_private_key);
      const mnemonic = await this.decrypt(wallet.encrypted_mnemonic);

      return {
        address: wallet.wallet_address,
        privateKey,
        mnemonic,
      };
    } catch (error) {
      console.error("Error getting wallet info:", error);
      return null;
    }
  }

  static async getOrCreateWallet(): Promise<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // First check for existing wallet
      const { data: existingWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // If wallet exists but doesn't have address, update it
      if (existingWallet && !existingWallet.wallet_address) {
        const wallet = Wallet.createRandom().connect(this.provider);
        const address = wallet.address;
        const privateKey = wallet.privateKey;
        const mnemonic = wallet.mnemonic?.phrase || "";

        await supabase
          .from("wallets")
          .update({
            wallet_address: address,
            encrypted_private_key: await this.encrypt(privateKey),
            encrypted_mnemonic: await this.encrypt(mnemonic),
            network: "sepolia",
          })
          .eq("id", existingWallet.id);

        return { address, privateKey, mnemonic };
      }

      // If wallet exists with address, return it
      if (existingWallet?.wallet_address) {
        return {
          address: existingWallet.wallet_address,
          privateKey: await this.decrypt(existingWallet.encrypted_private_key),
          mnemonic: await this.decrypt(existingWallet.encrypted_mnemonic),
        };
      }

      // If no wallet exists at all, create new one
      return await this.createWallet();
    } catch (error) {
      console.error("Error in getOrCreateWallet:", error);
      throw error;
    }
  }

  static async sendFunds(toAddress: string, amount: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const walletInfo = await this.getWalletInfo();
      if (!walletInfo?.privateKey) throw new Error("No wallet found");

      const tx = await this.sendTransaction(
        walletInfo.privateKey,
        toAddress,
        amount
      );

      // Create transaction record
      await this.createTransaction(
        walletInfo.address,
        parseFloat(amount),
        "WITHDRAWAL",
        {
          txHash: tx.hash,
          toAddress,
        }
      );

      return true;
    } catch (error) {
      console.error("Error sending funds:", error);
      throw error;
    }
  }

  static async fundWallet(amount: number): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!wallet) throw new Error("No wallet found");

      // Create funding request
      const { error } = await supabase.from("wallet_funding_requests").insert([
        {
          user_id: user.id,
          wallet_id: wallet.id,
          amount_usdt: amount,
          amount_inr: amount * 83, // Using fixed rate for example
          status: "PENDING",
        },
      ]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error funding wallet:", error);
      throw error;
    }
  }

  private static async encrypt(text: string): Promise<string> {
    return CryptoJS.AES.encrypt(text, this.ENCRYPTION_KEY).toString();
  }

  private static async decrypt(text: string | null): Promise<string> {
    if (!text) throw new Error("Cannot decrypt null value");
    const bytes = CryptoJS.AES.decrypt(text, this.ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}