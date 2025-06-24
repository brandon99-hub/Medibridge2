import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldX, Info } from "lucide-react";

interface ConsentModalProps {
  data: {
    patientName: string;
    nationalId: string;
    recordCount: number;
    records: any[];
  };
  onClose: () => void;
  onConsent: (consentGrantedBy: string) => void;
}

export default function ConsentModal({ data, onClose, onConsent }: ConsentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [consentGrantedBy, setConsentGrantedBy] = useState("");
  const [agreed, setAgreed] = useState(false);

  const consentMutation = useMutation({
    mutationFn: async (consentData: { nationalId: string; consentGrantedBy: string }) => {
      const response = await apiRequest("POST", "/api/consent", consentData);
      return await response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Consent Granted",
        description: "Patient records are now accessible",
      });
      onConsent(consentGrantedBy);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Consent Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGrantConsent = () => {
    if (!agreed || !consentGrantedBy.trim()) {
      toast({
        title: "Consent Required",
        description: "Please confirm consent details before proceeding",
        variant: "destructive",
      });
      return;
    }
    
    consentMutation.mutate({
      nationalId: data.nationalId,
      consentGrantedBy: consentGrantedBy,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div>Patient Consent Required</div>
              <DialogDescription>Data access authorization</DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-2">Patient Information</h4>
            <p className="text-sm text-slate-600">Name: <span className="font-medium">{data.patientName}</span></p>
            <p className="text-sm text-slate-600">ID: <span className="font-medium">{data.nationalId}</span></p>
            <p className="text-sm text-slate-600">Records Found: <span className="font-medium">{data.recordCount}</span></p>
          </div>
          
          <p className="text-sm text-slate-700">
            This patient has medical records available in the MediBridge system. 
            Patient consent is required before accessing these records.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Privacy Notice</p>
                <p>Patient records contain sensitive health information protected under HIPAA and local privacy laws.</p>
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="consentGrantedBy">Consent Granted By</Label>
            <Input
              id="consentGrantedBy"
              value={consentGrantedBy}
              onChange={(e) => setConsentGrantedBy(e.target.value)}
              placeholder="Enter name of person granting consent"
              required
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
            />
            <Label htmlFor="agree" className="text-sm text-slate-700">
              I confirm that proper patient consent has been obtained for accessing these medical records
            </Label>
          </div>
          
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleGrantConsent}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={!agreed || !consentGrantedBy.trim() || consentMutation.isPending}
            >
              {consentMutation.isPending ? "Processing..." : "Access Records"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
