import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send, CheckCircle, Shield, Globe, Key } from "lucide-react";

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

export default function HospitalAInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { submitRecordToIPFS } = useWeb3();
  
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

  const submitRecordMutation = useMutation({
    mutationFn: async (data: RecordFormData) => {
      const response = await apiRequest("POST", "/api/submit_record", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Record Submitted",
        description: "Patient record submitted successfully to MediBridge",
      });
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
      await submitRecordToIPFS(data);
    },
    onSuccess: () => {
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
    },
    onError: (error: Error) => {
      toast({
        title: "Web3 Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">A</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Hospital A - Record Submission</h2>
        </div>
        <p className="text-slate-600">Submit patient visit records using traditional or Web3 decentralized storage</p>
      </div>

      <Tabs defaultValue="traditional" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="traditional" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Traditional Storage</span>
          </TabsTrigger>
          <TabsTrigger value="web3" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Web3 + IPFS</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traditional">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Patient Visit Record</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="patientName">Patient Full Name *</Label>
                        <Input
                          id="patientName"
                          value={formData.patientName}
                          onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                          placeholder="Enter patient full name"
                          required
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
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="visitDate">Date of Visit *</Label>
                        <Input
                          id="visitDate"
                          type="date"
                          value={formData.visitDate}
                          onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="visitType">Visit Type</Label>
                        <Select value={formData.visitType} onValueChange={(value) => setFormData({ ...formData, visitType: value })}>
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
                      <Label htmlFor="diagnosis">Diagnosis *</Label>
                      <Textarea
                        id="diagnosis"
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        placeholder="Enter primary diagnosis and any secondary conditions"
                        rows={4}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="prescription">Prescription & Treatment</Label>
                      <Textarea
                        id="prescription"
                        value={formData.prescription}
                        onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                        placeholder="List medications, dosages, and treatment instructions"
                        rows={4}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="physician">Attending Physician</Label>
                        <Input
                          id="physician"
                          value={formData.physician}
                          onChange={(e) => setFormData({ ...formData, physician: e.target.value })}
                          placeholder="Dr. Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Department</Label>
                        <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
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
                    
                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                      <Checkbox
                        id="consent"
                        checked={consentChecked}
                        onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                      />
                      <Label htmlFor="consent" className="text-sm text-slate-700">
                        I confirm that patient consent has been obtained for sharing this medical record through MediBridge interoperability system
                      </Label>
                    </div>
                    
                    <div className="flex justify-end space-x-4">
                      <Button type="button" variant="outline" onClick={() => {
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
                      }}>
                        Clear Form
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={submitRecordMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitRecordMutation.isPending ? "Submitting..." : "Submit Record"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
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
                        Patient's phone number (system auto-generates DID for Web3 record ownership)
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
    </div>
  );
}