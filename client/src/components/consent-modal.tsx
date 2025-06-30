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
import { ShieldX, Info, Clock, FileText, User, MapPin, Activity, Shield, AlertTriangle } from "lucide-react";

interface ConsentModalProps {
  data: {
    patientName: string;
    patientDID: string;
    recordCount: number;
    hasConsent?: boolean;
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
    mutationFn: async (consentData: { nationalId: string; consentGrantedBy: string; consentType: string }) => {
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
      nationalId: (data as any).nationalId || data.patientDID,
      consentGrantedBy: consentGrantedBy,
      consentType: 'web3',
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
                  <p className="text-sm text-slate-600">DID</p>
                  <p className="font-medium">{data.patientDID || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Records Found</p>
                  <p className="font-medium">{data.recordCount ?? 0} medical records</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Consent Status</p>
                  <p className="font-medium">
                    {data.hasConsent ? (
                      <Badge className="bg-green-100 text-green-800">Consent Granted</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800">Consent Required</Badge>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {data.hasConsent && data.records.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Consent Already Granted</p>
                    <p className="mt-1">
                      Patient consent has been obtained for accessing these medical records. 
                      You can now view the records below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!data.hasConsent && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Consent Required</p>
                    <p className="mt-1">
                      To access these medical records, you must confirm that proper patient consent 
                      has been obtained in accordance with healthcare privacy regulations.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="records" className="space-y-4">
            {data.hasConsent ? (
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
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Waiting for Patient Consent</p>
                    <p className="mt-1">
                      The patient must approve the consent request in their portal. Once approved, medical records will be available here.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="consent" className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-slate-900 mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-2 text-blue-600" />
                Consent Authorization
              </h4>
              <div className="mb-2">
                <div className="text-sm text-slate-600">Patient Name: <span className="font-medium text-slate-900">{data.patientName}</span></div>
                <div className="text-sm text-slate-600">DID: <span className="font-mono text-xs">{data.patientDID || '—'}</span></div>
                <div className="text-sm text-slate-600">Records Requested: <span className="font-medium text-slate-900">{data.recordCount ?? 0}</span></div>
              </div>
              <Label htmlFor="nationalId">Enter Patient National ID to Confirm Consent</Label>
              <Input
                id="nationalId"
                type="text"
                value={consentGrantedBy}
                onChange={e => setConsentGrantedBy(e.target.value)}
                placeholder="Enter National ID"
                required
                className="mb-2"
              />
              {consentGrantedBy.length > 0 && consentGrantedBy.length < 4 && (
                <div className="text-xs text-red-600 mb-2">National ID must be at least 4 characters.</div>
              )}
              <Checkbox
                id="agreed"
                checked={agreed}
                onCheckedChange={checked => setAgreed(checked === true)}
                className="mt-2"
              />
              <Label htmlFor="agreed" className="ml-2">I confirm I have verified the patient's identity and consent</Label>
              <Button className="mt-6 w-full bg-blue-600 hover:bg-blue-700" onClick={handleGrantConsent} disabled={!agreed || consentGrantedBy.length < 4 || consentMutation.isPending}>
                {consentMutation.isPending ? 'Confirming...' : 'Confirm Consent'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
