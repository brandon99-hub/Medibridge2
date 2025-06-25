import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, User, CreditCard, CheckCircle } from "lucide-react";

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
  const [formData, setFormData] = useState({
    nationalId: "",
    fullName: "",
  });

  const completeProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient/complete-profile", formData);
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
    onError: (error: Error) => {
      toast({
        title: "Profile Completion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nationalId.trim() || !formData.fullName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    completeProfileMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Complete Your Profile</span>
          </DialogTitle>
          <DialogDescription>
            To access your medical records, we need a few more details to complete your profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your secure Web3 identity has been created. Now let's link it to your National ID for seamless record access.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name as it appears on your ID"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                This should match the name on your National ID
              </p>
            </div>

            <div>
              <Label htmlFor="nationalId">National ID *</Label>
              <Input
                id="nationalId"
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder="Enter your National ID number"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                This links your digital identity to your traditional medical records
              </p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium">Why do we need this?</p>
                <p className="mt-1">
                  Your National ID links your digital identity to traditional medical records from hospitals. 
                  This ensures you can access all your health information in one place.
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Complete Later
            </Button>
            <Button 
              type="submit" 
              disabled={completeProfileMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {completeProfileMutation.isPending ? "Completing..." : "Complete Profile"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 