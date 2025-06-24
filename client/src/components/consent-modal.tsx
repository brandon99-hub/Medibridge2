import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldX, Info, Clock, FileText, User, MapPin, Activity } from "lucide-react";

interface ConsentModalProps {
  data: {
    patientName: string;
    nationalId: string;
    recordCount: number;
    records: Array<{
      id: number;
      visitDate: string;
      visitType: string;
      diagnosis: string;
      prescription: string;
      physician: string;
      department: string;
      submittedAt: string;
    }>;
  };
  onClose: () => void;
  onConsent: (consentGrantedBy: string) => void;
}

export default function ConsentModal({ data, onClose, onConsent }: ConsentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [consentGrantedBy, setConsentGrantedBy] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [viewedRecords, setViewedRecords] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVisitTypeColor = (visitType: string) => {
    switch (visitType?.toLowerCase()) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'outpatient': return 'bg-blue-100 text-blue-800';
      case 'inpatient': return 'bg-purple-100 text-purple-800';
      case 'routine': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div>Patient Consent Required</div>
              <DialogDescription>Review records and authorize access</DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="records" onClick={() => setViewedRecords(true)}>
              Medical Records ({data.recordCount})
            </TabsTrigger>
            <TabsTrigger value="consent">Consent Authorization</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Patient Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Name</p>
                  <p className="font-medium">{data.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">National ID</p>
                  <p className="font-medium">{data.nationalId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Records Found</p>
                  <p className="font-medium">{data.recordCount} medical records</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Date Range</p>
                  <p className="font-medium">
                    {data.records.length > 0 ? (
                      `${formatDate(data.records[data.records.length - 1]?.visitDate)} - ${formatDate(data.records[0]?.visitDate)}`
                    ) : 'No records available'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Privacy & Security Notice</p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>All records are encrypted and protected under HIPAA compliance</li>
                    <li>Access requires valid patient consent</li>
                    <li>All data access is logged and audited</li>
                    <li>Records are accessed through secure cryptographic protocols</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="records" className="space-y-4">
            <div className="max-h-96 overflow-y-auto space-y-3">
              {data.records.map((record) => (
                <div key={record.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Badge className={getVisitTypeColor(record.visitType)}>
                        {record.visitType}
                      </Badge>
                      <span className="text-sm text-slate-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(record.visitDate)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {record.department}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-600">Physician</p>
                      <p className="font-medium">{record.physician}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Diagnosis</p>
                      <p className="font-medium">{record.diagnosis}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-slate-600">Prescription</p>
                      <p className="font-medium">{record.prescription}</p>
                    </div>
                  </div>
                  
                  <Separator className="my-2" />
                  <div className="text-xs text-slate-500 flex items-center">
                    <FileText className="h-3 w-3 mr-1" />
                    Record submitted: {formatDate(record.submittedAt)}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="consent" className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Activity className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Consent Authorization Required</p>
                  <p className="mt-1">
                    By proceeding, you acknowledge that you have obtained proper patient consent 
                    to access these medical records and that this access is for legitimate healthcare purposes.
                  </p>
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
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="reviewed"
                  checked={viewedRecords}
                  onCheckedChange={(checked) => setViewedRecords(checked as boolean)}
                />
                <Label htmlFor="reviewed" className="text-sm text-slate-700">
                  I have reviewed the medical records listed above
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agree"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked as boolean)}
                />
                <Label htmlFor="agree" className="text-sm text-slate-700">
                  I confirm that proper patient consent has been obtained for accessing these medical records
                </Label>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleGrantConsent}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!agreed || !viewedRecords || !consentGrantedBy.trim() || consentMutation.isPending}
              >
                {consentMutation.isPending ? "Processing..." : "Authorize Access"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
