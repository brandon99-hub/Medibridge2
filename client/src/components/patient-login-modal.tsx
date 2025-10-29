import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Shield, MessageSquare, Mail, User, Key, Globe, CheckCircle, ArrowLeft, Sparkles, Lock, Eye, EyeOff } from "lucide-react";
import PatientProfileCompletion from "./patient-profile-completion";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

interface PatientLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (patient: any) => void;
}

export default function PatientLoginModal({ isOpen, onClose, onSuccess }: PatientLoginModalProps) {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const [step, setStep] = useState<'contact' | 'otp'>('contact');
  const [verificationMethod, setVerificationMethod] = useState<'phone' | 'email'>('phone');
  const [contact, setContact] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [loginForm, setLoginForm] = useState({ fullName: '', nationalId: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const requestOtpMutation = useMutation({
    mutationFn: async ({ contact, method }: { contact: string; method: 'phone' | 'email' }) => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/request-otp');
      const response = await apiRequestWithCsrf("POST", "/api/patient/request-otp", {
        contact,
        method,
      });
      return response.json();
    },
    onSuccess: () => {
      setStep('otp');
      toast({
        title: "OTP Sent",
        description: `Check your ${verificationMethod} for the verification code`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send OTP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/verify-otp');
      const response = await apiRequestWithCsrf("POST", "/api/patient/verify-otp", {
        contact: contact,
        otpCode,
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log("OTP verification successful:", data);
      
      // Check if response has an error
      if (data.error) {
        toast({
          title: "Verification Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      
      // Ensure patient data exists
      if (!data.patient) {
        toast({
          title: "Verification Failed",
          description: "Invalid response from server",
          variant: "destructive",
        });
        return;
      }
      
      console.log("Patient data:", data.patient);
      console.log("isNewUser:", data.patient.isNewUser);
      console.log("isProfileComplete:", data.patient.isProfileComplete);
      
      setCurrentPatient(data.patient);
      
      if (data.patient.isNewUser || !data.patient.isProfileComplete) {
        console.log("Should show profile completion - setting showProfileCompletion to true");
        // Show profile completion for new users or incomplete profiles
        setShowProfileCompletion(true);
      } else {
        console.log("Profile is complete - proceeding with login");
        // Profile is complete, proceed with login
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        onSuccess(data.patient);
        onClose();
        resetForm();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep('contact');
    setContact('');
    setOtpCode('');
    setShowProfileCompletion(false);
    setCurrentPatient(null);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on verification method
    if (verificationMethod === "phone") {
      if (!contact.match(/^\+\d{9,15}$/)) {
        toast({
          title: "Invalid Phone Number",
          description: "Please enter a valid international phone number (e.g., +254712345678 for Kenya)",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!contact.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }
    }
    
    requestOtpMutation.mutate({ contact, method: verificationMethod });
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }
    verifyOtpMutation.mutate();
  };

  const handleProfileComplete = (completedPatient: any) => {
    onSuccess(completedPatient);
    onClose();
    resetForm();
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleClassicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/login');
      const response = await apiRequestWithCsrf("POST", "/api/patient/login", loginForm);
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: "Login Successful", description: "Welcome back!" });
        onSuccess(data.patient);
        onClose();
        setLoginForm({ fullName: '', nationalId: '' });
      } else {
        toast({ title: "Login Failed", description: data.error || "Invalid credentials", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/logout');
      await apiRequestWithCsrf("POST", "/api/patient/logout", {});
      setCurrentPatient(null);
      // Reset modal state to OTP page
      setMode('signup');
      setStep('contact');
      setContact('');
      setOtpCode('');
      setShowProfileCompletion(false);
      setLoginForm({ fullName: '', nationalId: '' });
      toast({ title: "Logged out", description: "You have been logged out." });
      // Keep the modal open for new login/signup
    } catch (error: any) {
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30 max-h-[90vh] flex flex-col">
          {/* Header with gradient background - Fixed */}
          <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-6 text-white flex-shrink-0">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative">
              <DialogHeader className="text-center">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-white">
                      Patient Portal
                    </DialogTitle>
                    <p className="text-blue-100 text-sm">Secure Healthcare Access</p>
                  </div>
                </div>
                
                {/* Mode Toggle */}
                <div className="flex items-center justify-center space-x-4 bg-white/10 backdrop-blur-sm rounded-full p-1 w-fit mx-auto">
                  <button
                    onClick={() => setMode('signup')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      mode === 'signup' 
                        ? 'bg-white text-blue-600 shadow-lg' 
                        : 'text-blue-100 hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-4 w-4 inline mr-2" />
                    Sign Up
                  </button>
                  <button
                    onClick={() => setMode('login')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      mode === 'login' 
                        ? 'bg-white text-blue-600 shadow-lg' 
                        : 'text-blue-100 hover:text-white'
                    }`}
                  >
                    <User className="h-4 w-4 inline mr-2" />
                    Login
                  </button>
                </div>
              </DialogHeader>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {mode === 'signup' ? (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {step === 'contact' && (
                    <motion.form 
                      onSubmit={handleContactSubmit} 
                      className="space-y-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      {/* Hero Section */}
                      <div className="text-center py-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                          {verificationMethod === 'phone' ? (
                            <Phone className="h-8 w-8 text-white" />
                          ) : (
                            <Mail className="h-8 w-8 text-white" />
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Create Your Secure Identity</h3>
                        <p className="text-slate-600 leading-relaxed">
                          Choose your verification method and enter your {verificationMethod} to receive a code. 
                          Your digital identity will be created automatically.
                        </p>
                      </div>

                      {/* Verification Method Tabs */}
                      <div className="space-y-4">
                        <Tabs value={verificationMethod} onValueChange={(value) => setVerificationMethod(value as 'phone' | 'email')}>
                          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl">
                            <TabsTrigger 
                              value="phone" 
                              className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                            >
                              <Phone className="h-4 w-4" />
                              <span>Phone</span>
                            </TabsTrigger>
                            <TabsTrigger 
                              value="email" 
                              className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                            >
                              <Mail className="h-4 w-4" />
                              <span>Email</span>
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="phone" className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label htmlFor="phoneNumber" className="text-sm font-medium text-slate-700">Phone Number</Label>
                              <div className="relative">
                                <Input
                                  id="phoneNumber"
                                  type="tel"
                                  value={contact}
                                  onChange={(e) => setContact(e.target.value)}
                                  placeholder="+254712345678"
                                  className="h-12 text-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                  required
                                />
                                <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                              </div>
                              <p className="text-xs text-slate-500">
                                Include country code (e.g., +254 for Kenya)
                              </p>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="email" className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</Label>
                              <div className="relative">
                                <Input
                                  id="email"
                                  type="email"
                                  value={contact}
                                  onChange={(e) => setContact(e.target.value)}
                                  placeholder="patient@example.com"
                                  className="h-12 text-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                  required
                                />
                                <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                              </div>
                              <p className="text-xs text-slate-500">
                                Your email will be used for secure verification
                              </p>
                            </div>
                            
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <div className="flex items-start space-x-3">
                                <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-amber-800">
                                  <p className="font-medium mb-1">Note for Email Users</p>
                                  <p>
                                    If you choose email verification, you'll need to provide your phone number during profile completion to link your medical records.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>

                      {/* Security Info */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Lock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Secure & Private</p>
                            <p>
                              Your {verificationMethod} is used only for secure authentication. 
                              We'll create a decentralized identity (DID) to protect your medical data.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <Button 
                        type="submit" 
                        disabled={requestOtpMutation.isPending}
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        {requestOtpMutation.isPending ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Sending Code...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4" />
                            <span>Send Verification Code</span>
                          </div>
                        )}
                      </Button>
                    </motion.form>
                  )}

                  {step === 'otp' && (
                    <motion.form 
                      onSubmit={handleOtpSubmit} 
                      className="space-y-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      {/* OTP Hero Section */}
                      <div className="text-center py-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <MessageSquare className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Enter Verification Code</h3>
                        <p className="text-slate-600">
                          We sent a 6-digit code to <span className="font-semibold text-slate-900">{contact}</span>
                        </p>
                      </div>

                      {/* OTP Input */}
                      <div className="space-y-4">
                        <Label htmlFor="otpCode" className="text-sm font-medium text-slate-700">Verification Code</Label>
                        <div className="relative">
                          <Input
                            id="otpCode"
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            className="h-14 text-center text-2xl tracking-widest font-mono border-slate-200 focus:border-green-500 focus:ring-green-500 rounded-xl"
                            maxLength={6}
                            required
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center">
                            <Key className="h-5 w-5 text-slate-400" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                          Enter the 6-digit code sent to your {verificationMethod}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setStep('contact');
                            setOtpCode('');
                          }}
                          className="flex-1 h-12 border-slate-200 hover:border-slate-300 rounded-xl"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={verifyOtpMutation.isPending}
                          className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                          {verifyOtpMutation.isPending ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Verifying...</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-4 w-4" />
                              <span>Verify Code</span>
                            </div>
                          )}
                        </Button>
                      </div>

                      {/* Resend Code */}
                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => requestOtpMutation.mutate({ contact, method: verificationMethod })}
                          disabled={requestOtpMutation.isPending}
                          className="text-sm text-slate-500 hover:text-slate-700 underline-offset-4"
                        >
                          Didn't receive code? Resend
                        </Button>
                      </div>
                    </motion.form>
                  )}

                  {showProfileCompletion && (
                    <PatientProfileCompletion
                      isOpen={showProfileCompletion}
                      onClose={() => setShowProfileCompletion(false)}
                      onComplete={handleProfileComplete}
                      patientDID={currentPatient.patientDID}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <form onSubmit={handleClassicLogin} className="space-y-6">
                    {/* Login Hero Section */}
                    <div className="text-center py-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <User className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome Back</h3>
                      <p className="text-slate-600">
                        Sign in with your full name and National ID
                      </p>
                    </div>

                    {/* Login Form */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Full Name</Label>
                        <div className="relative">
                          <Input
                            id="fullName"
                            value={loginForm.fullName}
                            onChange={e => setLoginForm({ ...loginForm, fullName: e.target.value })}
                            placeholder="Enter your full name"
                            className="h-12 text-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                            required
                          />
                          <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="nationalId" className="text-sm font-medium text-slate-700">National ID</Label>
                        <div className="relative">
                          <Input
                            id="nationalId"
                            type={showPassword ? "text" : "password"}
                            value={loginForm.nationalId}
                            onChange={e => setLoginForm({ ...loginForm, nationalId: e.target.value })}
                            placeholder="Enter your National ID"
                            className="h-12 text-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl pr-12"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Security Note */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="text-sm text-indigo-800">
                          <p className="font-medium mb-1">Secure Login</p>
                          <p>
                            Your National ID is encrypted and used only for secure authentication.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" 
                      disabled={loginLoading}
                    >
                      {loginLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Signing In...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Sign In</span>
                        </div>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}