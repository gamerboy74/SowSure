import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useWallet } from "../hooks/useWallet"; // Adjust path as needed
import { Eye, EyeOff, Wallet, LogOut } from "lucide-react";

function FarmerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, connect, disconnect, isConnecting } = useWallet();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isRedirecting) {
      window.history.pushState(null, "", window.location.pathname);
      window.addEventListener("popstate", () => {
        window.history.pushState(null, "", window.location.pathname);
      });
    }
  }, [isRedirecting]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        setIsRedirecting(true);
        try {
          const { data: farmerData, error } = await supabase
            .from("farmers")
            .select("*")
            .eq("user_id", session?.user?.id)
            .single();

          if (!error && farmerData) {
            window.location.replace("/");
          }
        } catch (err) {
          setIsRedirecting(false);
          console.error("Error during redirect:", err);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleWalletConnect = async () => {
    try {
      setError(null);
      await connect();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to connect wallet"
      );
    }
  };

  const handleWalletDisconnect = async () => {
    try {
      setError(null);
      await disconnect();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to disconnect wallet"
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    setIsRedirecting(true);

    try {
      const { data: farmerData } = await supabase
        .from("farmers")
        .select("wallet_address")
        .eq("email", formData.email)
        .single();

      if (
        farmerData?.wallet_address &&
        farmerData.wallet_address.toLowerCase() !== address.toLowerCase()
      ) {
        setIsRedirecting(false);
        setError(
          "Connected wallet does not match the registered wallet address"
        );
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        setIsRedirecting(false);
        throw authError;
      }
    } catch (error) {
      setIsRedirecting(false);
      console.error("Login error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during login"
      );
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await disconnect();
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isRedirecting) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Logging you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Farmer Login</h2>
          <p className="mt-2 text-gray-600">
            Don't have an account?{" "}
            <Link
              to="/farmer/register"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Create one
            </Link>
          </p>
        </div>

        {(location.state?.message || error) && (
          <div
            className={`p-4 rounded-md mb-6 ${
              location.state?.message
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {location.state?.message || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Enter your email"
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleWalletConnect}
              disabled={isConnecting || !!address}
              className="w-full flex items-center justify-center px-4 py-2 border border-emerald-600 rounded-md shadow-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <Wallet className="mr-2 h-5 w-5" />
              {address
                ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
                : isConnecting
                ? "Connecting..."
                : "Connect Wallet"}
            </button>
            {address && (
              <button
                type="button"
                onClick={handleWalletDisconnect}
                className="w-full flex items-center justify-center px-4 py-2 border border-red-600 rounded-md shadow-sm text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Disconnect Wallet
              </button>
            )}
            <p className="mt-1 text-sm text-red-500">
              Wallet connection is required to login
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || !address}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FarmerLogin;