import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Loader2, Eye } from "lucide-react";
import type { WalletFundingRequest } from "../../types/types";

export default function WalletFundingRequests() {
  const [requests, setRequests] = useState<WalletFundingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<WalletFundingRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from("wallet_funding_requests")
        .select(
          `
          *,
          user:auth.users (
            email
          ),
          wallet:wallets (
            token_balance
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load requests"
      );
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("wallet_funding_requests")
        .update({ status: "APPROVED" })
        .eq("id", id);

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      setError(
        error instanceof Error ? error.message : "Failed to approve request"
      );
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this request?"))
      return;

    try {
      const { error } = await supabase
        .from("wallet_funding_requests")
        .update({ status: "REJECTED" })
        .eq("id", id);

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      setError(
        error instanceof Error ? error.message : "Failed to reject request"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Wallet Funding Requests
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount (USDT)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount (INR)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.user?.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${request.amount_usdt}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{request.amount_inr}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-emerald-600 hover:text-emerald-900"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    {request.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Request Details</h3>
              <button onClick={() => setSelectedRequest(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">
                  Transaction ID
                </h4>
                <p className="mt-1">{selectedRequest.txid}</p>
              </div>

              {selectedRequest.payment_proof_url && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Payment Proof
                  </h4>
                  <img
                    src={selectedRequest.payment_proof_url}
                    alt="Payment proof"
                    className="mt-2 max-h-64 rounded-md"
                  />
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
