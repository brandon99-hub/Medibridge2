import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { toast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send, CheckCircle, Shield, Globe, Key, Info } from "lucide-react";
import FilecoinStatusIndicator from "./filecoin-status-indicator";
import { useCsrf } from "@/hooks/use-csrf";

interface RecordFormData {
  patientName: string;
  nationalId: string;
  visitDate: string;
  visitType: string;
  diagnosis: string;
  prescription: string;
  physician: string;
  department: string;
}

interface Web3RecordFormData extends RecordFormData {
  phoneNumber: string;
}

// Utility: Split combined prescription & treatment text
function splitPrescriptionAndTreatment(text: string) {
  const lower = text.toLowerCase();
  const prescIdx = lower.indexOf('prescription');
  const treatIdx = lower.indexOf('treatment');

  if (prescIdx !== -1 && treatIdx !== -1) {
    // Both found, prescription comes first
    if (prescIdx < treatIdx) {
      const prescText = text.slice(prescIdx + 'prescription'.length, treatIdx).replace(/^[:\-\s]*/, '').trim();
      const treatText = text.slice(treatIdx + 'treatment'.length).replace(/^[:\-\s]*/, '').trim();
      return { prescription: prescText, treatment: treatText };
    } else {
      // Treatment comes first (rare)
      const treatText = text.slice(treatIdx + 'treatment'.length, prescIdx).replace(/^[:\-\s]*/, '').trim();
      const prescText = text.slice(prescIdx + 'prescription'.length).replace(/^[:\-\s]*/, '').trim();
      return { prescription: prescText, treatment: treatText };
    }
  } else if (prescIdx !== -1) {
    // Only prescription found
    const prescText = text.slice(prescIdx + 'prescription'.length).replace(/^[:\-\s]*/, '').trim();
    return { prescription: prescText, treatment: '' };
  } else if (treatIdx !== -1) {
    // Only treatment found
    const treatText = text.slice(treatIdx + 'treatment'.length).replace(/^[:\-\s]*/, '').trim();
    return { prescription: '', treatment: treatText };
  } else {
    // Neither found, treat all as prescription
    return { prescription: text.trim(), treatment: '' };
  }
}

export default function HospitalAInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { submitRecordToIPFS } = useWeb3();
  const { user } = useAuth();
  const { apiRequestWithCsrf } = useCsrf();
  
  const [formData, setFormData] = useState<RecordFormData>({
    patientName: "",
    nationalId: "",
    visitDate: "",
    visitType: "",
    diagnosis: "",
    prescription: "",
    physician: "",
    department: "",
  });

  const [web3FormData, setWeb3FormData] = useState<Web3RecordFormData>({
    patientName: "",
    nationalId: "",
    phoneNumber: "",
    visitDate: "",
    visitType: "",
    diagnosis: "",
    prescription: "",
    physician: "",
    department: "",
  });
  
  const [consentChecked, setConsentChecked] = useState(false);
  const [web3ConsentChecked, setWeb3ConsentChecked] = useState(false);

  const [showProofModal, setShowProofModal] = useState(false);
  const [zkProofResult, setZkProofResult] = useState<{ code: string; message: string; full?: any } | null>(null);

  const [submittedWeb3, setSubmittedWeb3] = useState(false);

  const [patientDID, setPatientDID] = useState<string>("");



  const submitRecordMutation = useMutation({
    mutationFn: async (data: RecordFormData) => {
      const response = await apiRequestWithCsrf("POST", "/api/submit_record", data);
      return await response.json();
    },
    onSuccess: async (result: any) => {
      toast({
        title: "Record Submitted",
        description: "Patient record submitted successfully to MediBridge",
      });
      // Best-effort: analyze and generate proofs to show a read-only summary
      try {
        const analyzeRes = await apiRequestWithCsrf("POST", "/api/zkp/analyze-medical-data", {
          formData,
        });
        const analyzeJson = await analyzeRes.json();

        const proofsRes = await apiRequestWithCsrf("POST", "/api/zkp/generate-proofs-from-form", {
          patientDID: result?.patientDID || "",
          formData: { ...formData, hospital_id: user?.hospital_id || 1 },
        });
        const proofsJson = await proofsRes.json();

        setZkProofResult({
          code: proofsJson.visitCode || "",
          message: proofsJson.message || "",
          full: {
            analysis: analyzeJson?.analysis || analyzeJson,
            proofs: proofsJson?.proofs || [],
          }
        });
        setShowProofModal(true);
      } catch (e) {
        console.warn('[NLP/ZKP UX] Inline summary skipped:', e);
      }
      setFormData({
        patientName: "",
        nationalId: "",
        visitDate: "",
        visitType: "",
        diagnosis: "",
        prescription: "",
        physician: "",
        department: "",
      });
      setConsentChecked(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitWeb3RecordMutation = useMutation({
    mutationFn: async (data: Web3RecordFormData) => {
      const { prescription, treatment } = splitPrescriptionAndTreatment(data.prescription);
      const enhancedFormData = {
        ...data,
        prescription,
        treatment,
        hospital_id: user?.hospital_id || 1,
      };
      const response = await submitRecordToIPFS({ ...enhancedFormData, hospital_id: user?.hospital_id });
      return response;
    },
    onSuccess: (data: any) => {
      setWeb3ConsentChecked(false);
      setSubmittedWeb3(true);
      if (data && data.patientDID) {
        setPatientDID(data.patientDID);
        console.log('[DEBUG] Patient DID set:', data.patientDID);
      } else {
        console.error('[DEBUG] No patientDID in response:', data);
        toast({
          title: "Warning",
          description: "Patient DID not received from server. ZKP generation may not work.",
          variant: "destructive",
        });
        setPatientDID(""); // Don't set a mock DID, let the UI handle it
      }
    },
    onError: (error: any) => {
      // Check if this is a registration requirement error
      if (error?.response?.data?.requiresRegistration) {
        toast({
          title: "Patient Registration Required",
          description: "This patient must be registered in the system before medical records can be submitted. Please ask the patient to register via phone/email first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Web3 Submission Failed",
          description: error.message || "Failed to submit medical record",
          variant: "destructive",
        });
      }
      setSubmittedWeb3(false);
    },
  });

  // ENHANCED: Generate ZK proofs from form data mutation
  const generateZKProofsFromFormMutation = useMutation({
    mutationFn: async () => {
      console.log('[DEBUG] Generating ZK proofs with patientDID:', patientDID);
      console.log('[DEBUG] Form data:', web3FormData);
      
      if (!patientDID) {
        throw new Error("Patient DID is required for ZKP generation");
      }
      
      // Split prescription & treatment for ZKP proof generation
      const { prescription, treatment } = splitPrescriptionAndTreatment(web3FormData.prescription);
      const enhancedFormData = {
        ...web3FormData,
        prescription,
        treatment,
        hospital_id: user?.hospital_id || 1,
      };
      
      const response = await apiRequestWithCsrf("POST", "/api/zkp/generate-proofs-from-form", {
        patientDID: patientDID,
        formData: enhancedFormData,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setZkProofResult({ 
        code: data.verificationCodes?.join(', ') || "", 
        message: data.message, 
        full: data 
      });
      setShowProofModal(true);
    },
    onError: (error: any) => {
      setZkProofResult({ code: "", message: error.message || "Failed to generate proofs" });
      setShowProofModal(true);
    },
  });

  // OLD: Keep for backward compatibility


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) {
      toast({
        title: "Consent Required",
        description: "Please confirm patient consent before submitting the record",
        variant: "destructive",
      });
      return;
    }
    submitRecordMutation.mutate(formData);
  };

  const handleWeb3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!web3ConsentChecked) {
      toast({
        title: "Consent Required",
        description: "Please confirm patient consent before submitting to IPFS",
        variant: "destructive",
      });
      return;
    }
    if (!web3FormData.phoneNumber) {
      toast({
        title: "Patient Phone Required",
        description: "Please provide the patient's phone number",
        variant: "destructive",
      });
      return;
    }
    submitWeb3RecordMutation.mutate(web3FormData);
  };

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-xs sm:text-sm">A</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Hospital A - Record Submission</h2>
        </div>
        <p className="text-slate-600 text-sm sm:text-base">Submit patient visit records using traditional or Web3 decentralized storage</p>
      </div>

      <Tabs defaultValue="traditional" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="traditional" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Traditional Storage</span>
            <span className="sm:hidden">Traditional</span>
          </TabsTrigger>
          <TabsTrigger value="web3" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
            <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Web3 + IPFS</span>
            <span className="sm:hidden">Web3</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traditional">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Patient Visit Record</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <Label htmlFor="patientName">Patient Full Name *</Label>
                        <Input
                          id="patientName"
                          value={formData.patientName}
                          onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                          placeholder="Enter patient full name"
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="nationalId">NHIF/National ID *</Label>
                        <Input
                          id="nationalId"
                          value={formData.nationalId}
                          onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                          placeholder="Enter NHIF or National ID"
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <Label htmlFor="visitDate">Date of Visit *</Label>
                        <Input
                          id="visitDate"
                          type="date"
                          value={formData.visitDate}
                          onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="visitType">Visit Type</Label>
                        <Select value={formData.visitType} onValueChange={(value) => setFormData({ ...formData, visitType: value })}>
                          <SelectTrigger className="text-sm sm:text-base">
                            <SelectValue placeholder="Select visit type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consultation">Consultation</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                            <SelectItem value="routine">Routine Check-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="diagnosis">Diagnosis *</Label>
                      <Textarea
                        id="diagnosis"
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        placeholder="Enter primary diagnosis and any secondary conditions"
                        rows={3}
                        required
                        className="text-sm sm:text-base"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="prescription">Prescription & Treatment</Label>
                      <Textarea
                        id="prescription"
                        value={formData.prescription}
                        onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                        placeholder="List medications, dosages, and treatment instructions"
                        rows={3}
                        className="text-sm sm:text-base"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <Label htmlFor="physician">Attending Physician</Label>
                        <Input
                          id="physician"
                          value={formData.physician}
                          onChange={(e) => setFormData({ ...formData, physician: e.target.value })}
                          placeholder="Dr. Name"
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Department</Label>
                        <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                          <SelectTrigger className="text-sm sm:text-base">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cardiology">Cardiology</SelectItem>
                            <SelectItem value="neurology">Neurology</SelectItem>
                            <SelectItem value="pediatrics">Pediatrics</SelectItem>
                            <SelectItem value="orthopedics">Orthopedics</SelectItem>
                            <SelectItem value="general">General Medicine</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 sm:p-4 bg-slate-50 rounded-lg">
                      <Checkbox
                        id="consent"
                        checked={consentChecked}
                        onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                        className="mt-1"
                      />
                      <Label htmlFor="consent" className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        I confirm that patient consent has been obtained for sharing this medical record through MediBridge interoperability system
                      </Label>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                        setFormData({
                          patientName: "",
                          nationalId: "",
                          visitDate: "",
                          visitType: "",
                          diagnosis: "",
                          prescription: "",
                          physician: "",
                          department: "",
                        });
                        setConsentChecked(false);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Clear Form
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                        disabled={submitRecordMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitRecordMutation.isPending ? "Submitting..." : "Submit Record"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {showProofModal && zkProofResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>NLP & Proofs Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h6 className="text-sm font-medium text-slate-700 mb-1">NLP extracted conditions (ICD‑11)</h6>
                      <div className="text-sm text-slate-600">
                        {(zkProofResult.full?.analysis?.icd_codes || []).length > 0 ? (
                          <ul className="list-disc ml-5">
                            {zkProofResult.full.analysis.icd_codes.map((c: any, idx: number) => (
                              <li key={idx}>
                                {c.code ? `${c.code} — ` : ""}{c.title || c.block || c.chapter || "ICD entry"}
                                {c.contagious ? " • contagious" : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span>No ICD‑11 entries detected.</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <h6 className="text-sm font-medium text-slate-700 mb-1">Proofs generated</h6>
                      <div className="text-sm text-slate-600">
                        {(zkProofResult.full?.proofs || []).length > 0 ? (
                          <ul className="list-disc ml-5">
                            {zkProofResult.full.proofs.map((p: any, idx: number) => (
                              <li key={idx}>{p.statement || p.type}</li>
                            ))}
                          </ul>
                        ) : (
                          <span>No proofs generated.</span>
                        )}
                      </div>
                    </div>

                    {zkProofResult.code && (
                      <div className="text-xs text-slate-500">Visit code: {zkProofResult.code}</div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Submission Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">System Connected</p>
                      <p className="text-slate-600">MediBridge API operational</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">Secure Connection</p>
                      <p className="text-slate-600">JWT authenticated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="web3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-purple-600" />
                    <span>Web3 Patient Record (IPFS + Phone)</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Info className="h-4 w-4 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      <strong>Important:</strong> Patient must be registered in the system before submitting medical records. 
                      Ask patient to register via phone/email first.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWeb3Submit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="web3PatientName">Patient Full Name *</Label>
                        <Input
                          id="web3PatientName"
                          value={web3FormData.patientName}
                          onChange={(e) => setWeb3FormData({ ...web3FormData, patientName: e.target.value })}
                          placeholder="Enter patient full name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="web3NationalId">NHIF/National ID *</Label>
                        <Input
                          id="web3NationalId"
                          value={web3FormData.nationalId}
                          onChange={(e) => setWeb3FormData({ ...web3FormData, nationalId: e.target.value })}
                          placeholder="Enter NHIF or National ID"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="web3PhoneNumber">Patient Phone Number *</Label>
                      <Input
                        id="web3PhoneNumber"
                        value={web3FormData.phoneNumber}
                        onChange={(e) => setWeb3FormData({ ...web3FormData, phoneNumber: e.target.value })}
                        placeholder="+254 700 123 456"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Patient's phone number (patient must be registered in the system first)
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="web3VisitDate">Date of Visit *</Label>
                        <Input
                          id="web3VisitDate"
                          type="date"
                          value={web3FormData.visitDate}
                          onChange={(e) => setWeb3FormData({ ...web3FormData, visitDate: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="web3VisitType">Visit Type</Label>
                        <Select value={web3FormData.visitType} onValueChange={(value) => setWeb3FormData({ ...web3FormData, visitType: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visit type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consultation">Consultation</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                            <SelectItem value="routine">Routine Check-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="web3Diagnosis">Diagnosis *</Label>
                      <Textarea
                        id="web3Diagnosis"
                        value={web3FormData.diagnosis}
                        onChange={(e) => setWeb3FormData({ ...web3FormData, diagnosis: e.target.value })}
                        placeholder="Enter primary diagnosis and any secondary conditions"
                        rows={4}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="web3Prescription">Prescription & Treatment</Label>
                      <Textarea
                        id="web3Prescription"
                        value={web3FormData.prescription}
                        onChange={(e) => setWeb3FormData({ ...web3FormData, prescription: e.target.value })}
                        placeholder="List medications, dosages, and treatment instructions"
                        rows={4}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="web3Physician">Attending Physician</Label>
                        <Input
                          id="web3Physician"
                          value={web3FormData.physician}
                          onChange={(e) => setWeb3FormData({ ...web3FormData, physician: e.target.value })}
                          placeholder="Dr. Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="web3Department">Department</Label>
                        <Select value={web3FormData.department} onValueChange={(value) => setWeb3FormData({ ...web3FormData, department: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cardiology">Cardiology</SelectItem>
                            <SelectItem value="neurology">Neurology</SelectItem>
                            <SelectItem value="pediatrics">Pediatrics</SelectItem>
                            <SelectItem value="orthopedics">Orthopedics</SelectItem>
                            <SelectItem value="general">General Medicine</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                      <Checkbox
                        id="web3Consent"
                        checked={web3ConsentChecked}
                        onCheckedChange={(checked) => setWeb3ConsentChecked(checked as boolean)}
                      />
                      <Label htmlFor="web3Consent" className="text-sm text-slate-700">
                        Patient has consented to storing their medical record on IPFS with DID-based access control
                      </Label>
                    </div>
                    
                    <div className="flex justify-end space-x-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setWeb3FormData({
                            patientName: "",
                            nationalId: "",
                            phoneNumber: "",
                            visitDate: "",
                            visitType: "",
                            diagnosis: "",
                            prescription: "",
                            physician: "",
                            department: "",
                          });
                          setWeb3ConsentChecked(false);
                          setSubmittedWeb3(false);
                        }}
                      >
                        Clear Form
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={submitWeb3RecordMutation.isPending}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        {submitWeb3RecordMutation.isPending ? "Storing on IPFS..." : "Store on IPFS"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Web3 Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Key className="h-5 w-5 text-purple-600" />
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">Phone-to-DID Mapping</p>
                      <p className="text-slate-600">Auto-generates patient DID</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Globe className="h-5 w-5 text-green-600" />
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">IPFS Storage</p>
                      <p className="text-slate-600">Decentralized file storage</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div className="text-sm">
                      <p className="font-medium text-slate-900">Encryption</p>
                      <p className="text-slate-600">Patient-controlled access</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {submittedWeb3 && (
        <div className="space-y-4 mt-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm bg-white rounded shadow">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left">Field</th>
                  <th className="px-4 py-2 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-4 py-2">Patient Name</td><td className="px-4 py-2">{web3FormData.patientName}</td></tr>
                <tr><td className="px-4 py-2">National ID</td><td className="px-4 py-2">{web3FormData.nationalId}</td></tr>
                <tr><td className="px-4 py-2">Phone Number</td><td className="px-4 py-2">{web3FormData.phoneNumber}</td></tr>
                <tr><td className="px-4 py-2">Diagnosis</td><td className="px-4 py-2">{web3FormData.diagnosis}</td></tr>
                <tr><td className="px-4 py-2">Visit Type</td><td className="px-4 py-2">{web3FormData.visitType}</td></tr>
                <tr><td className="px-4 py-2">Physician</td><td className="px-4 py-2">{web3FormData.physician}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Filecoin Storage Confirmation */}
          {submitWeb3RecordMutation.data?.storage?.filecoinCid && (
            <div className="mt-6">
              <FilecoinStatusIndicator
                filecoinCid={submitWeb3RecordMutation.data.storage.filecoinCid}
                ipfsCid={submitWeb3RecordMutation.data.storage.ipfsCid}
                showDetails
                showVerification
              />
            </div>
          )}

          <Button 
            onClick={() => generateZKProofsFromFormMutation.mutate()} 
            className="bg-green-600 hover:bg-green-700 w-full mt-4"
            disabled={generateZKProofsFromFormMutation.isPending || !patientDID}
          >
            {generateZKProofsFromFormMutation.isPending ? "Generating Smart ZK Proofs..." : !patientDID ? "Waiting for Patient DID..." : "Generate Smart ZK Proofs from Medical Data"}
          </Button>
        </div>
      )}

      {showProofModal && zkProofResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Smart ZK Proofs Generated from Medical Data</h2>
            <p className="mb-4 text-slate-700">ZK proofs generated from actual diagnosis, prescription, and treatment data. These proofs can be shared with employers, schools, or other entities without revealing specific medical details.</p>
            
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2 text-blue-900">Based on Medical Data:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Diagnosis:</strong> {web3FormData.diagnosis}</div>
                <div><strong>Prescription:</strong> {web3FormData.prescription}</div>
                <div><strong>Visit Type:</strong> {web3FormData.visitType}</div>
                <div><strong>Department:</strong> {web3FormData.department}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2"><span className="font-semibold">Verification Codes:</span> <span className="font-mono text-lg">{zkProofResult.code}</span></div>
              <div className="mb-2"><span className="font-semibold">Message:</span> {zkProofResult.message}</div>
            </div>

            {zkProofResult.full && zkProofResult.full.proofs && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Generated Proofs:</h3>
                <div className="space-y-3">
                  {zkProofResult.full.proofs.map((proof: any, index: number) => (
                    <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-green-900">{proof.statement}</div>
                          <div className="text-sm text-green-700">Type: {proof.type}</div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          {proof.verificationCode}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {zkProofResult.full && zkProofResult.full.analysis && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Medical Analysis:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Requires Treatment:</strong> {zkProofResult.full.analysis.requiresTreatment ? 'Yes' : 'No'}</div>
                  <div><strong>Requires Rest:</strong> {zkProofResult.full.analysis.requiresRest ? 'Yes' : 'No'}</div>
                  <div><strong>Requires Medication:</strong> {zkProofResult.full.analysis.requiresMedication ? 'Yes' : 'No'}</div>
                  <div><strong>Contagious:</strong> {zkProofResult.full.analysis.isContagious ? 'Yes' : 'No'}</div>
                  <div><strong>Severity:</strong> <span className="capitalize">{zkProofResult.full.analysis.severity}</span></div>
                  <div><strong>Work Impact:</strong> <span className="capitalize">{zkProofResult.full.analysis.workImpact}</span></div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowProofModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                // Copy verification codes to clipboard
                navigator.clipboard.writeText(zkProofResult.code);
                toast({
                  title: "Codes Copied",
                  description: "Verification codes copied to clipboard",
                });
              }}>
                Copy Codes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}