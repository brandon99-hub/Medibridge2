import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Send, CheckCircle, Shield } from "lucide-react";

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

export default function HospitalAInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  
  const [consentChecked, setConsentChecked] = useState(false);

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
      // Clear form
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

  const handleClearForm = () => {
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
        <p className="text-slate-600">Submit patient visit records to the MediBridge interoperability system</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Record Submission Form */}
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
                  <Button type="button" variant="outline" onClick={handleClearForm}>
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
        
        {/* Submission Status & Recent Records */}
        <div className="space-y-6">
          {/* Submission Status */}
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
    </div>
  );
}
