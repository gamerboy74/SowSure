import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { WalletService } from "../../services/wallet.service";
import { useWallet } from "../../hooks/useWallet"; // Add this import
import { useNavigate } from "react-router-dom";
import type {
  Wallet,
  WalletTransaction,
  WalletFundingRequest,
} from "../../types/types";
import {
  Loader2,
  RefreshCw,
  ArrowUpDown,
  Plus,
  Minus,
  Search,
  Upload,
  X,
  ExternalLink,
} from "lucide-react";

export default function WalletDashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFundingForm, setShowFundingForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundingRequests, setFundingRequests] = useState<
    WalletFundingRequest[]
  >([]);

  const [formData, setFormData] = useState({
    amount_usdt: "",
    txid: "",
    payment_proof_url: "",
  });

  const { address, createWallet, balance, prices } = useWallet();

  const [ethBalance, setEthBalance] = useState<string>("0");

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }

        await WalletService.getOrCreateWallet();
        await loadWalletData();
        await loadFundingRequests();
      } catch (error) {
        console.error("Initialization error:", error);
        setError("Failed to load wallet data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (address) {
      loadOnChainBalance();
    }
  }, [address]);

  async function loadOnChainBalance() {
    try {
      const { balance } = await WalletService.getWalletBalance(
        address!,
        "onchain"
      );
      setEthBalance(balance);
    } catch (error) {
      console.error("Error loading ETH balance:", error);
    }
  }

  async function loadWalletData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletData) {
        setWallet(walletData);

        const { data: txData } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("wallet_id", walletData.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (txData) setTransactions(txData);
      }
    } catch (error) {
      console.error("Error loading wallet:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFundingRequests() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("wallet_funding_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFundingRequests(data);
    } catch (error) {
      console.error("Error loading funding requests:", error);
    }
  }

  const handleTransfer = async () => {
    if (!wallet || !recipientAddress || !transferAmount) return;

    try {
      setIsTransferring(true);
      await WalletService.transferTokens(
        wallet.id,
        recipientAddress,
        transferAmount,
        false // false for token transfer, true for ETH transfer
      );

      setTransferAmount("");
      setRecipientAddress("");
      loadTransactions();
    } catch (error) {
      console.error("Transfer error:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  // Add a new function for ETH transfers
  const handleEthTransfer = async () => {
    if (!wallet || !recipientAddress || !transferAmount) return;

    try {
      setIsTransferring(true);
      await WalletService.transferTokens(
        wallet.id,
        recipientAddress,
        transferAmount,
        true // true for ETH transfer
      );

      setTransferAmount("");
      setRecipientAddress("");
      loadTransactions();
    } catch (error) {
      console.error("ETH transfer error:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      setUploading(true);
      setError(null);

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);

      setFormData({ ...formData, payment_proof_url: publicUrl });
    } catch (err) {
      console.error("Error uploading proof:", err);
      setError(err instanceof Error ? err.message : "Failed to upload proof");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const amount_usdt = parseFloat(formData.amount_usdt);
      if (isNaN(amount_usdt) || amount_usdt <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const { error } = await supabase.from("wallet_funding_requests").insert([
        {
          user_id: user.id,
          wallet_id: wallet.id,
          amount_usdt,
          amount_inr: amount_usdt * prices.usdt,
          txid: formData.txid,
          payment_proof_url: formData.payment_proof_url,
        },
      ]);

      if (error) throw error;

      // Reset form and reload data
      setFormData({ amount_usdt: "", txid: "", payment_proof_url: "" });
      setShowFundingForm(false);
      loadFundingRequests();
    } catch (error) {
      console.error("Error submitting request:", error);
      setError(
        error instanceof Error ? error.message : "Failed to submit request"
      );
    }
  };

  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create the wallet
      const { privateKey, mnemonic, address } =
        await WalletService.createWallet();

      // Store credentials securely
      alert(`IMPORTANT: Save these details securely:
Private Key: ${privateKey}
Recovery Phrase: ${mnemonic}
Wallet Address: ${address}

Store these safely - they cannot be recovered if lost!`);

      // Reload the wallet data
      await loadWalletData();
      await loadOnChainBalance();

      // Set success message or handle UI updates
      console.log("Wallet created successfully:", address);
    } catch (error) {
      console.error("Failed to create wallet:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create wallet"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      if (!wallet) return;
      const txs = await WalletService.getTransactionHistory(wallet.id);
      setTransactions(txs);
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  // Add useEffect for auto-refresh
  useEffect(() => {
    if (wallet) {
      loadTransactions();
      // Refresh transactions every 30 seconds
      const interval = setInterval(loadTransactions, 30000);
      return () => clearInterval(interval);
    }
  }, [wallet]);

  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.amount.toString().includes(searchQuery) ||
      tx.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!wallet && !loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-lg mx-auto text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Welcome to Your Wallet
          </h3>
          <p className="text-gray-600 mb-6">
            You don't have a blockchain wallet yet. Create one to start managing
            your crypto assets.
          </p>
          <button
            onClick={handleCreateWallet}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center mx-auto"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Create Blockchain Wallet
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Token Balance Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Wallet</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-full mb-4">
            <p className="text-sm text-gray-500">Wallet Address</p>
            <p className="text-md font-mono bg-gray-50 p-2 rounded-md mt-1">
              {address || "Creating wallet..."}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">ETH Balance</p>
            <p className="text-3xl font-bold text-gray-900">
              {parseFloat(balance.eth).toFixed(4)} ETH
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ₹{(parseFloat(balance.eth) * prices.eth).toLocaleString()} INR
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Token Balance (USDT)</p>
            <p className="text-3xl font-bold text-gray-900">
              ${balance.token.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ₹{(balance.token * prices.usdt).toLocaleString()} INR
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Total Value (INR)</p>
            <p className="text-3xl font-bold text-gray-900">
              ₹
              {(
                parseFloat(balance.eth) * prices.eth +
                balance.token * prices.usdt
              ).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Transfer Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Transfer</h3>
        <div className="space-y-4">
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="Recipient Address"
            className="w-full p-2 border rounded-md"
          />
          <input
            type="number"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="Amount"
            className="w-full p-2 border rounded-md"
          />
          <div className="flex space-x-4">
            <button
              onClick={handleTransfer}
              disabled={isTransferring || !recipientAddress || !transferAmount}
              className="flex-1 flex items-center justify-center p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isTransferring ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Send USDT
                </>
              )}
            </button>
            <button
              onClick={handleEthTransfer}
              disabled={isTransferring || !recipientAddress || !transferAmount}
              className="flex-1 flex items-center justify-center p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isTransferring ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Send ETH
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Funding Requests */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Recent Funding Requests
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fundingRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ${request.amount_usdt}
                    </div>
                    <div className="text-sm text-gray-500">
                      ₹{request.amount_inr}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full
                        ${
                          request.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : request.status === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                    >
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">
            Recent Transactions
          </h3>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Type</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="py-3">{tx.type}</td>
                  <td
                    className={`py-3 ${
                      tx.type === "DEPOSIT"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type === "DEPOSIT" ? "+" : "-"}
                    {tx.amount}{" "}
                    {tx.metadata?.network === "sepolia" ? "ETH" : "USDT"}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          tx.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : tx.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tx.status}
                      </span>
                      {tx.metadata?.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${tx.metadata.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Funding Form Modal */}
      {showFundingForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Funds</h3>
                <button onClick={() => setShowFundingForm(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Amount (USDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.amount_usdt}
                    onChange={(e) =>
                      setFormData({ ...formData, amount_usdt: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  />
                  {formData.amount_usdt && (
                    <p className="mt-1 text-sm text-gray-500">
                      ≈ ₹
                      {(parseFloat(formData.amount_usdt) * prices.usdt).toFixed(
                        2
                      )}{" "}
                      INR
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Transaction ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.txid}
                    onChange={(e) =>
                      setFormData({ ...formData, txid: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Payment Proof
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      {formData.payment_proof_url ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={formData.payment_proof_url}
                            alt="Payment proof"
                            className="h-24 w-24 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                payment_proof_url: "",
                              })
                            }
                            className="mt-2 text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500">
                              <span>Upload a file</span>
                              <input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={handleFileUpload}
                                disabled={uploading}
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">
                            PNG, JPG up to 10MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowFundingForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
