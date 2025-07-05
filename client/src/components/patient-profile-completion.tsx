import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, User, CreditCard, CheckCircle, Mail, Phone, Loader2 } from "lucide-react";

interface PatientProfileCompletionProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (patient: any) => void;
  patientDID: string;
}

export default function PatientProfileCompletion({ 
  isOpen, 
  onClose, 
  onComplete, 
  patientDID 
}: PatientProfileCompletionProps) {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const [formData, setFormData] = useState({
    nationalId: "",
    fullName: "",
    phoneNumber: "",
    email: "",
  });
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});

  // Inline validation
  const isNationalIdValid = formData.nationalId.trim().length > 0;
  const isFullNameValid = formData.fullName.trim().length > 0;
  const isPhoneValid = !formData.phoneNumber || /^\+\d{9,15}$/.test(formData.phoneNumber);
  const isEmailValid = !formData.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email);
  const isFormValid = isNationalIdValid && isFullNameValid && isPhoneValid && isEmailValid;

  const completeProfileMutation = useMutation({
    mutationFn: async () => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/complete-profile');
      const response = await apiRequestWithCsrf("POST", "/api/patient/complete-profile", formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile Completed",
        description: "Your profile has been successfully completed. You can now access all your medical records.",
      });
      onComplete(data.patient);
      onClose();
    },
    onError: (error: any) => {
      if (error.requiresPhoneNumber) {
        toast({
          title: "Phone Number Required",
          description: "Please provide your phone number to link your medical records.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Profile Completion Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ nationalId: true, fullName: true, phoneNumber: true, email: true });
    if (!isFormValid) {
      toast({
        title: "Missing or Invalid Information",
        description: "Please fill in all required fields with valid information.",
        variant: "destructive",
      });
      return;
    }
    completeProfileMutation.mutate();
  };

  // Progress indicator (single step for now, but visually helpful)
  const ProgressBar = () => (
    <div className="w-full h-2 bg-slate-200 rounded-full mb-6">
      <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: '100%' }} />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
        <DialogContent className="sm:max-w-md p-0 overflow-visible shadow-2xl rounded-2xl">
          <DialogHeader className="px-8 pt-8 pb-2">
            <DialogTitle className="flex items-center space-x-2 text-2xl font-bold">
              <Shield className="h-6 w-6 text-blue-600" />
              <span>Complete Your Profile</span>
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              To access your health records, please provide the following information.
            </DialogDescription>
            <ProgressBar />
          </DialogHeader>

          {/* Scrollable form container with up/down buttons */}
          <div className="relative max-h-[60vh] overflow-y-auto px-8 pb-8" id="profile-completion-scroll">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Alert className="mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  Your secure Web3 identity has been created. Now let's link it to your National ID for seamless record access.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <div className="relative">
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                      placeholder="Enter your full name as it appears on your ID"
                      required
                      className={`pl-10 ${touched.fullName && !isFullNameValid ? 'border-red-500' : ''}`}
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    {touched.fullName && isFullNameValid && <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />}
                  </div>
                  {touched.fullName && !isFullNameValid && (
                    <p className="text-xs text-red-500 mt-1">Full name is required.</p>
                  )}
                </div>

                {/* National ID */}
                <div>
                  <Label htmlFor="nationalId">National ID *</Label>
                  <div className="relative">
                    <Input
                      id="nationalId"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, nationalId: true }))}
                      placeholder="Enter your National ID number"
                      required
                      className={`pl-10 ${touched.nationalId && !isNationalIdValid ? 'border-red-500' : ''}`}
                    />
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    {touched.nationalId && isNationalIdValid && <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />}
                  </div>
                  {touched.nationalId && !isNationalIdValid && (
                    <p className="text-xs text-red-500 mt-1">National ID is required.</p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <div className="relative">
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, phoneNumber: true }))}
                      placeholder="+254712345678 (include country code)"
                      className={`pl-10 ${touched.phoneNumber && !isPhoneValid ? 'border-red-500' : ''}`}
                    />
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    {touched.phoneNumber && isPhoneValid && formData.phoneNumber && <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />}
                  </div>
                  {touched.phoneNumber && !isPhoneValid && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid international phone number (e.g., +254712345678).</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Required for email-based accounts to link your medical records. Include country code (e.g., +254 for Kenya)
                  </p>
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="Enter your email address"
                      className={`pl-10 ${touched.email && !isEmailValid ? 'border-red-500' : ''}`}
                    />
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    {touched.email && isEmailValid && formData.email && <CheckCircle className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />}
                  </div>
                  {touched.email && !isEmailValid && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Optional - can help with account recovery and notifications
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium">Why do we need this information?</p>
                    <p className="mt-1">
                      Your National ID links your digital identity to traditional medical records from hospitals. 
                      Your phone number ensures we can link records that hospitals submit using phone number lookups.
                      This ensures you can access all your health information in one place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={onClose}
                  className="flex-1 border border-slate-200"
                >
                  Complete Later
                </Button>
                <Button 
                  type="submit" 
                  disabled={!isFormValid || completeProfileMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
                >
                  {completeProfileMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2 inline" /> : null}
                  {completeProfileMutation.isPending ? "Completing..." : "Complete Profile"}
                </Button>
              </div>
            </form>
            {/* Scroll up/down buttons */}
            <button
              type="button"
              className="absolute left-1/2 -translate-x-1/2 top-0 z-10 bg-white/80 rounded-full shadow p-1 hover:bg-blue-100 transition"
              style={{ display: 'block' }}
              onClick={() => {
                const el = document.getElementById('profile-completion-scroll');
                if (el) el.scrollBy({ top: -100, behavior: 'smooth' });
              }}
              aria-label="Scroll up"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-chevron-up"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
            <button
              type="button"
              className="absolute left-1/2 -translate-x-1/2 bottom-0 z-10 bg-white/80 rounded-full shadow p-1 hover:bg-blue-100 transition"
              style={{ display: 'block' }}
              onClick={() => {
                const el = document.getElementById('profile-completion-scroll');
                if (el) el.scrollBy({ top: 100, behavior: 'smooth' });
              }}
              aria-label="Scroll down"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-chevron-down"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
} 