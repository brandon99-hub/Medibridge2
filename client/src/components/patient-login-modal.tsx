import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Shield, MessageSquare, Mail } from "lucide-react";

interface PatientLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (patient: any) => void;
}

export default function PatientLoginModal({ isOpen, onClose, onSuccess }: PatientLoginModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'contact' | 'otp'>('contact');
  const [verificationMethod, setVerificationMethod] = useState<'phone' | 'email'>('phone');
  const [contact, setContact] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const requestOtpMutation = useMutation({
    mutationFn: async ({ contact, method }: { contact: string; method: 'phone' | 'email' }) => {
      const response = await apiRequest("POST", "/api/patient/request-otp", {
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
      const response = await apiRequest("POST", "/api/patient/verify-otp", {
        contact,
        otpCode,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Login Successful",
        description: data.patient.isNewUser 
          ? "Welcome! Your secure identity has been created."
          : "Welcome back!",
      });
      onSuccess(data.patient);
      onClose();
      resetForm();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Patient Access</span>
          </DialogTitle>
        </DialogHeader>

        {step === 'contact' && (
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {verificationMethod === 'phone' ? (
                  <Phone className="h-6 w-6 text-blue-600" />
                ) : (
                  <Mail className="h-6 w-6 text-blue-600" />
                )}
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Secure Patient Login</h3>
              <p className="text-sm text-slate-600">
                Choose your verification method and enter your {verificationMethod} to receive a code. 
                Your digital identity will be created automatically.
              </p>
            </div>

            <Tabs value={verificationMethod} onValueChange={(value) => setVerificationMethod(value as 'phone' | 'email')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="phone" className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>Phone</span>
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="phone" className="space-y-3">
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="+254712345678 (Kenya format)"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Include country code (e.g., +254 for Kenya)
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="email" className="space-y-3">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="patient@example.com"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Your email will be used for secure verification
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">Privacy Protected</p>
                  <p>Your medical data is encrypted and you control who can access it.</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={requestOtpMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {requestOtpMutation.isPending ? "Sending..." : "Send Code"}
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Enter Verification Code</h3>
              <p className="text-sm text-slate-600">
                We sent a 6-digit code to <span className="font-medium">{contact}</span>
              </p>
            </div>

            <div>
              <Label htmlFor="otpCode">Verification Code</Label>
              <Input
                id="otpCode"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="text-center text-lg tracking-widest"
                maxLength={6}
                required
              />
            </div>

            <div className="flex space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setStep('contact');
                  setOtpCode('');
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                type="submit" 
                disabled={verifyOtpMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => requestOtpMutation.mutate({ contact, method: verificationMethod })}
                disabled={requestOtpMutation.isPending}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Didn't receive code? Resend
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}