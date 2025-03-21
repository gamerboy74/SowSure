import { useState, useEffect } from "react";
import {
  connectWallet as connect,
  disconnectWallet as disconnect,
} from "../lib/wallet";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const storedAddress = localStorage.getItem("walletAddress");
    if (storedAddress) {
      setAddress(storedAddress);
    }
  }, []);

  const connectWallet = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      const { address: newAddress } = await connect();
      setAddress(newAddress);
      return { address: newAddress };
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    await disconnect();
    setAddress(null);
  };

  return {
    address,
    isConnecting,
    connect: connectWallet,
    disconnect: disconnectWallet,
  };
}