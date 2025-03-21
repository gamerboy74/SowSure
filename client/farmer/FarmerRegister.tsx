import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { connectWallet } from "../lib/wallet";
import { Eye, EyeOff, Upload, ArrowLeft, AlertCircle } from "lucide-react";
import LoadingSpinner from "../../src/components/shared/LoadingSpinner";

type Step = 1 | 2 | 3 | 4;

interface FormData {
  // Step 1: Basic Information
  name: string;
  phone_number: string;
  email: string;
  password: string;
  confirm_password: string;
  // Step 2: Identity Verification
  aadhar_number: string;
  pan_number: string;
  farmer_id: string;
  profile_photo_url: string;
  // Step 3: Location & Property
  complete_address: string;
  pincode: string;
  land_type: string;
  land_size: string;
  land_number: string;
  // Step 4: Additional Details
  nominee_name: string;
  wallet_address: string | null;
}

function FarmerRegister() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone_number: "",
    email: "",
    password: "",
    confirm_password: "",
    aadhar_number: "",
    pan_number: "",
    farmer_id: "",
    profile_photo_url: "",
    complete_address: "",
    pincode: "",
    land_type: "",
    land_size: "",
    land_number: "",
    nominee_name: "",
    wallet_address: null,
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `profile-photos/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("farmer-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("farmer-documents").getPublicUrl(filePath);

      setFormData({ ...formData, profile_photo_url: publicUrl });
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload profile photo");
    }
  };

  const handleWalletConnect = async () => {
    try {
      const { address } = await connectWallet();
      setFormData({ ...formData, wallet_address: address });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to connect wallet"
      );
    }
  };

  const validateForm = () => {
    if (formData.password !== formData.confirm_password) {
      throw new Error("Passwords do not match");
    }

    if (formData.aadhar_number && !/^\d{12}$/.test(formData.aadhar_number)) {
      throw new Error("Aadhar number must be 12 digits");
    }

    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
      throw new Error("Pincode must be 6 digits");
    }

    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      throw new Error("Phone number must be 10 digits");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as Step);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      validateForm();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            type: "farmer",
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user data returned");

      const { error: profileError } = await supabase.from("farmers").insert([
        {
          user_id: authData.user.id,
          name: formData.name,
          phone_number: formData.phone_number,
          email: formData.email,
          aadhar_number: formData.aadhar_number,
          pan_number: formData.pan_number,
          farmer_id: formData.farmer_id || null,
          profile_photo_url: formData.profile_photo_url || null,
          complete_address: formData.complete_address,
          pincode: formData.pincode,
          land_type: formData.land_type,
          land_size: parseFloat(formData.land_size),
          land_number: formData.land_number,
          nominee_name: formData.nominee_name || null,
          wallet_address: formData.wallet_address,
        },
      ]);

      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      navigate("/farmer/login", {
        state: {
          message: "Registration successful! Please login to continue.",
        },
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during registration"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Full Name <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            name="name"
            required
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your full name"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="tel"
            name="phone_number"
            required
            pattern="[0-9]{10}"
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.phone_number}
            onChange={handleInputChange}
            placeholder="Enter 10-digit phone number"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Format: 10 digits without spaces or dashes
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="email"
            name="email"
            required
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email address"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            minLength={6}
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 pr-10 sm:text-sm"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Create a password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">Minimum 6 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirm_password"
            required
            minLength={6}
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 pr-10 sm:text-sm"
            value={formData.confirm_password}
            onChange={handleInputChange}
            placeholder="Confirm your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Aadhar Number <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            name="aadhar_number"
            required
            pattern="[0-9]{12}"
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.aadhar_number}
            onChange={handleInputChange}
            placeholder="Enter your 12-digit Aadhar number"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Format: 12 digits without spaces
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          PAN Number <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            name="pan_number"
            required
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm uppercase"
            value={formData.pan_number}
            onChange={handleInputChange}
            placeholder="Enter your PAN number"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Farmer ID
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            name="farmer_id"
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.farmer_id}
            onChange={handleInputChange}
            placeholder="Enter your Farmer ID (if available)"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Optional: Enter if you have a government-issued Farmer ID
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Profile Photo
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-500 transition-colors">
          <div className="space-y-1 text-center">
            {formData.profile_photo_url ? (
              <div className="flex flex-col items-center">
                <img
                  src={formData.profile_photo_url}
                  alt="Profile"
                  className="h-24 w-24 object-cover rounded-full"
                />
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, profile_photo_url: "" })
                  }
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Remove Photo
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload a file</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Complete Address <span className="text-red-500">*</span>
        </label>
        <div className="mt-1">
          <textarea
            name="complete_address"
            required
            rows={3}
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.complete_address}
            onChange={handleInputChange}
            placeholder="Enter your complete address"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pincode <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="pincode"
              required
              pattern="[0-9]{6}"
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={formData.pincode}
              onChange={handleInputChange}
              placeholder="Enter 6-digit pincode"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Land Type <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <select
              name="land_type"
              required
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={formData.land_type}
              onChange={handleInputChange}
            >
              <option value="">Select land type</option>
              <option value="Agricultural">Agricultural</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Mixed Use">Mixed Use</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Land Size (in acres) <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="number"
              name="land_size"
              required
              min="0"
              step="0.01"
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={formData.land_size}
              onChange={handleInputChange}
              placeholder="Enter land size"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Land Number <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="land_number"
              required
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={formData.land_number}
              onChange={handleInputChange}
              placeholder="Enter land number"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nominee Name
        </label>
        <div className="mt-1">
          <input
            type="text"
            name="nominee_name"
            className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={formData.nominee_name}
            onChange={handleInputChange}
            placeholder="Enter nominee name"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Optional: Name of the person who will handle your account in your
          absence
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={handleWalletConnect}
          className="w-full flex items-center justify-center px-4 py-2 border border-indigo-600 rounded-md shadow-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {formData.wallet_address ? (
            <>
              <span className="mr-2">✓</span>
              Wallet Connected: {formData.wallet_address.slice(0, 6)}...
              {formData.wallet_address.slice(-4)}
            </>
          ) : (
            "Connect Wallet"
          )}
        </button>
        {!formData.wallet_address && (
          <p className="mt-2 text-sm text-gray-500 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            Required for transactions
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate("/")}
            className="text-gray-600 hover:text-gray-900 flex items-center"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Create Farmer Account
          </h2>
          <p className="mt-2 text-gray-600">
            Already have an account?{" "}
            <Link
              to="/farmer/login"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Sign in
            </Link>
          </p>
          <div className="mt-4 flex justify-between items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              ></div>
            </div>
            <span className="ml-4 text-sm text-gray-500">
              Step {currentStep}/4
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          <div className="flex justify-between pt-4">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Previous
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${
                currentStep < 4
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-green-600 hover:bg-green-700"
              } inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                currentStep < 4
                  ? "focus:ring-indigo-500"
                  : "focus:ring-green-500"
              } disabled:opacity-50 ml-auto`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner fullScreen={false} text="Processing..." />
                </span>
              ) : currentStep < 4 ? (
                "Next"
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FarmerRegister;
