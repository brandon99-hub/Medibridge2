import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, User, ShieldCheck, Users, Phone, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth"; // To get hospitalId potentially
import { useLocation } from "wouter";

// Define interfaces based on backend EmergencyConsentRequest for form state
interface AuthorizedPersonnelFormState {
  id: string;
  name: string;
  role: 'PHYSICIAN' | 'SURGEON' | 'EMERGENCY_DOCTOR' | 'CHIEF_RESIDENT' | '';
  licenseNumber: string;
  department: string;
}

interface NextOfKinFormState {
  name: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
}

interface EmergencyConsentFormState {
  patientId: string;
  hospitalId: string; // Will likely come from logged-in user's context
  emergencyType: 'LIFE_THREATENING' | 'UNCONSCIOUS_PATIENT' | 'CRITICAL_CARE' | 'SURGERY_REQUIRED' | 'MENTAL_HEALTH_CRISIS' | '';
  medicalJustification: string;
  primaryPhysician: AuthorizedPersonnelFormState;
  secondaryAuthorizer: AuthorizedPersonnelFormState;
  nextOfKin?: NextOfKinFormState;
  patientContactAttempted: boolean;
  requestedDurationHours: number; // User-friendly hours, convert to ms before sending
}

const initialPhysicianState: AuthorizedPersonnelFormState = {
  id: "", name: "", role: "", licenseNumber: "", department: ""
};

const initialNextOfKinState: NextOfKinFormState = {
  name: "", relationship: "", phoneNumber: "", email: ""
};

export default function EmergencyConsentForm() {
  const { user } = useAuth(); // Get authenticated hospital user
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<EmergencyConsentFormState>({
    patientId: "",
    hospitalId: user?.hospitalName || "", // Pre-fill from logged-in user, or make it selectable if admin
    emergencyType: "",
    medicalJustification: "",
    primaryPhysician: { ...initialPhysicianState, id: user?.username || "", name: user?.username || "" }, // Pre-fill primary with logged-in user for convenience
    secondaryAuthorizer: { ...initialPhysicianState },
    nextOfKin: { ...initialNextOfKinState },
    patientContactAttempted: false,
    requestedDurationHours: 1, // Default to 1 hour
  });
  const [showNextOfKin, setShowNextOfKin] = useState(false);
  const { toast } = useToast();

  const emergencyConsentMutation = useMutation({
    mutationFn: async (data: any) => { // Define proper type for 'data' based on EmergencyConsentRequest
      const response = await apiRequest("POST", "/api/emergency/grant-consent", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to grant emergency consent");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Emergency Consent Granted",
        description: `Emergency access granted! Redirecting to patient records...`,
      });
      
      // Prepare emergency data for dashboard
      const emergencyData = {
        temporaryCredential: data.temporaryCredential,
        patientId: formData.patientId,
        consentId: data.consentId,
        expiresAt: data.expiresAt,
        limitations: data.limitations || [],
      };
      
      // Redirect to emergency dashboard with data
      const encodedData = encodeURIComponent(JSON.stringify(emergencyData));
      setLocation(`/emergency-dashboard?emergencyData=${encodedData}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Emergency Consent Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch on-duty staff for the current hospital
  const { data: staffProfileData, isLoading: staffLoading } = useQuery({
    queryKey: ['onDutyStaff', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await apiRequest("GET", `/api/hospital/staff-profile?hospitalId=${user.id}`);
      const data = await response.json();
      return (data.staff || []).filter((s: any) => s.isOnDuty && s.isActive);
    },
    enabled: !!user?.id,
  });

  // Find the admin's staff record (by staffId === user.username)
  const adminStaff = staffProfileData?.find((s: any) => s.staffId === user?.username);
  
  // Admin can authorize emergency consent even if not in staff list
  const adminOnDuty = user?.isAdmin || !!adminStaff;

  // Set primary physician to admin's staff record
  useEffect(() => {
    if (adminStaff && user?.username) {
      setFormData(prev => ({
        ...prev,
        primaryPhysician: {
          id: user.username, // must match backend check
          name: adminStaff.name,
          role: adminStaff.role,
          licenseNumber: adminStaff.licenseNumber,
          department: adminStaff.department,
        }
      }));
    }
  }, [adminStaff, user?.username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      // @ts-ignore
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNestedChange = (section: 'primaryPhysician' | 'secondaryAuthorizer' | 'nextOfKin', e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [section]: {
        // @ts-ignore
        ...prev[section],
        [name]: value
      }
    }));
  };

  const handleSelectChange = (name: keyof EmergencyConsentFormState | keyof AuthorizedPersonnelFormState, section?: 'primaryPhysician' | 'secondaryAuthorizer') => (value: string) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          // @ts-ignore
          ...prev[section],
          [name]: value
        }
      }));
    } else {
      // @ts-ignore
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation
    if (!formData.patientId || !formData.hospitalId || !formData.emergencyType || !formData.medicalJustification ||
        !formData.primaryPhysician.id || !formData.primaryPhysician.name || !formData.primaryPhysician.role || !formData.primaryPhysician.licenseNumber || !formData.primaryPhysician.department ||
        !formData.secondaryAuthorizer.id || !formData.secondaryAuthorizer.name || !formData.secondaryAuthorizer.role || !formData.secondaryAuthorizer.licenseNumber || !formData.secondaryAuthorizer.department) {
      toast({ title: "Validation Error", description: "Please fill in all required fields for patient, emergency, and authorizing personnel.", variant: "destructive" });
      return;
    }
    if (formData.medicalJustification.length < 50) {
      toast({ title: "Validation Error", description: "Medical justification must be at least 50 characters.", variant: "destructive" });
      return;
    }
    if (!formData.patientContactAttempted) {
        toast({ title: "Confirmation Required", description: "Please confirm if patient/next-of-kin contact was attempted.", variant: "destructive" });
        return;
    }

    const requestedDurationMs = formData.requestedDurationHours * 60 * 60 * 1000;

    // Construct data matching EmergencyConsentRequest, ensuring roles are not empty strings
    const primaryPhysicianSubmit = { ...formData.primaryPhysician, role: formData.primaryPhysician.role as Exclude<AuthorizedPersonnelFormState['role'], ''> };
    const secondaryAuthorizerSubmit = { ...formData.secondaryAuthorizer, role: formData.secondaryAuthorizer.role as Exclude<AuthorizedPersonnelFormState['role'], ''> };

    const submissionData = {
      patientId: formData.patientId,
      hospitalId: formData.hospitalId,
      emergencyType: formData.emergencyType as Exclude<EmergencyConsentFormState['emergencyType'], ''>,
      medicalJustification: formData.medicalJustification,
      primaryPhysician: primaryPhysicianSubmit,
      secondaryAuthorizer: secondaryAuthorizerSubmit,
      nextOfKin: showNextOfKin && formData.nextOfKin && formData.nextOfKin.name ? formData.nextOfKin : undefined,
      patientContactAttempted: formData.patientContactAttempted,
      requestedDurationMs,
    };

    emergencyConsentMutation.mutate(submissionData);
  };

  const emergencyTypes = ['LIFE_THREATENING', 'UNCONSCIOUS_PATIENT', 'CRITICAL_CARE', 'SURGERY_REQUIRED', 'MENTAL_HEALTH_CRISIS'];
  const physicianRoles = ['PHYSICIAN', 'SURGEON', 'EMERGENCY_DOCTOR', 'CHIEF_RESIDENT'];
  const durationOptions = [ {value: 1, label: "1 Hour"}, {value: 6, label: "6 Hours"}, {value: 12, label: "12 Hours"}, {value: 24, label: "24 Hours"}];


  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center text-red-600">
          <AlertTriangle className="h-6 w-6 mr-2" />
          Request Emergency Access Override
        </CardTitle>
        <CardDescription>
          Complete this form to request temporary access to a patient's records in a critical emergency.
          This process requires dual authorization and is subject to audit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient and Emergency Details */}
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-medium text-lg flex items-center"><User className="mr-2 h-5 w-5"/>Patient & Emergency Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patientId">Patient ID (National ID / System ID) *</Label>
                <Input name="patientId" value={formData.patientId} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="hospitalId">Hospital ID *</Label>
                <Input name="hospitalId" value={formData.hospitalId} onChange={handleChange} required disabled={!!user}/>
              </div>
            </div>
            <div>
              <Label htmlFor="emergencyType">Type of Emergency *</Label>
              <Select name="emergencyType" onValueChange={handleSelectChange('emergencyType')} value={formData.emergencyType} required>
                <SelectTrigger><SelectValue placeholder="Select emergency type" /></SelectTrigger>
                <SelectContent>
                  {emergencyTypes.map(type => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="medicalJustification">Medical Justification (Min 50 chars) *</Label>
              <Textarea name="medicalJustification" value={formData.medicalJustification} onChange={handleChange} rows={3} minLength={50} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="requestedDurationHours">Requested Access Duration *</Label>
                    <Select onValueChange={(val) => setFormData(p => ({...p, requestedDurationHours: parseInt(val)}))} value={String(formData.requestedDurationHours)}>
                        <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                        <SelectContent>
                        {durationOptions.map(opt => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center space-x-2 pt-6">
                    <Checkbox id="patientContactAttempted" name="patientContactAttempted" checked={formData.patientContactAttempted} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, patientContactAttempted: !!checked }))} />
                    <Label htmlFor="patientContactAttempted">Patient/Next-of-Kin Contact Attempted? *</Label>
                </div>
            </div>
          </div>

          {/* Authorizing Personnel */}
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="font-medium text-lg flex items-center"><ShieldCheck className="mr-2 h-5 w-5"/>Authorizing Personnel</h3>
            {/* Primary Physician (locked to admin) */}
            <div className="p-3 border rounded bg-slate-50">
              <Label className="font-semibold">Primary Physician (Requesting User)</Label>
              <div className="mt-2">
                {adminStaff ? (
                  <div className="p-2 bg-white border rounded flex flex-col">
                    <span className="font-semibold">{adminStaff.name}</span>
                    <span className="text-sm text-slate-600">{adminStaff.role}, {adminStaff.department}</span>
                    <span className="text-xs text-slate-500">Staff ID: {adminStaff.staffId}</span>
                  </div>
                ) : !!user && user.isAdmin ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-yellow-800 mb-2">
                      <b>Warning:</b> You are an admin but not registered as staff. Please fill in your details below to authorize emergency consent.
                    </div>
                    <Input
                      name="name"
                      placeholder="Full Name"
                      value={formData.primaryPhysician.name}
                      onChange={e => setFormData(prev => ({ ...prev, primaryPhysician: { ...prev.primaryPhysician, name: e.target.value } }))}
                      required
                    />
                    <Select
                      value={formData.primaryPhysician.role}
                      onValueChange={val => setFormData(prev => ({ ...prev, primaryPhysician: { ...prev.primaryPhysician, role: val as any } }))}
                      required
                    >
                      <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHYSICIAN">Physician</SelectItem>
                        <SelectItem value="SURGEON">Surgeon</SelectItem>
                        <SelectItem value="EMERGENCY_DOCTOR">Emergency Doctor</SelectItem>
                        <SelectItem value="CHIEF_RESIDENT">Chief Resident</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      name="licenseNumber"
                      placeholder="Medical License Number"
                      value={formData.primaryPhysician.licenseNumber}
                      onChange={e => setFormData(prev => ({ ...prev, primaryPhysician: { ...prev.primaryPhysician, licenseNumber: e.target.value } }))}
                      required
                    />
                    <Input
                      name="department"
                      placeholder="Department"
                      value={formData.primaryPhysician.department}
                      onChange={e => setFormData(prev => ({ ...prev, primaryPhysician: { ...prev.primaryPhysician, department: e.target.value } }))}
                      required
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-yellow-800">
                    <b>Warning:</b> You are not currently on duty. You must be on duty to authorize emergency consent.
                </div>
                )}
              </div>
            </div>
            {/* Secondary Authorizer Dropdown (exclude admin) */}
            <div className="p-3 border rounded bg-slate-50">
              <Label className="font-semibold">Secondary Authorizer *</Label>
              <Select
                value={formData.secondaryAuthorizer.id}
                onValueChange={staffId => {
                  const staff = staffProfileData?.find((s: any) => s.staffId === staffId);
                  if (staff) {
                    setFormData(prev => ({
                      ...prev,
                      secondaryAuthorizer: {
                        id: staff.staffId,
                        name: staff.name,
                        role: staff.role,
                        licenseNumber: staff.licenseNumber,
                        department: staff.department,
                      }
                    }));
                  }
                }}
                disabled={staffLoading}
              >
                <SelectTrigger><SelectValue placeholder={staffLoading ? "Loading staff..." : "Select secondary authorizer"} /></SelectTrigger>
                <SelectContent>
                  {staffProfileData?.filter((staff: any) => staff.staffId !== user.username).map((staff: any) => (
                    <SelectItem key={staff.staffId} value={staff.staffId}>
                      {staff.name} ({staff.role}, {staff.department})
                    </SelectItem>
                  ))}
                </SelectContent>
                    </Select>
            </div>
          </div>

          {/* Next of Kin (Optional) */}
          <div className="space-y-4 p-4 border rounded-md">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-lg flex items-center"><Users className="mr-2 h-5 w-5"/>Next-of-Kin Information (Optional)</h3>
                <Button type="button" variant="link" onClick={() => setShowNextOfKin(!showNextOfKin)}>{showNextOfKin ? "Hide" : "Show"} Details</Button>
            </div>
            {showNextOfKin && formData.nextOfKin && (
              <div className="p-3 border rounded bg-slate-50 space-y-3">
                <div><Label htmlFor="nextOfKin.name">Full Name</Label><Input name="name" value={formData.nextOfKin.name} onChange={(e) => handleNestedChange('nextOfKin', e)} /></div>
                <div><Label htmlFor="nextOfKin.relationship">Relationship</Label><Input name="relationship" value={formData.nextOfKin.relationship} onChange={(e) => handleNestedChange('nextOfKin', e)} /></div>
                <div><Label htmlFor="nextOfKin.phoneNumber">Phone Number</Label><Input name="phoneNumber" type="tel" value={formData.nextOfKin.phoneNumber} onChange={(e) => handleNestedChange('nextOfKin', e)} /></div>
                <div><Label htmlFor="nextOfKin.email">Email</Label><Input name="email" type="email" value={formData.nextOfKin.email} onChange={(e) => handleNestedChange('nextOfKin', e)} /></div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={emergencyConsentMutation.isPending || !adminOnDuty}>
            {emergencyConsentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
            <AlertTriangle className="mr-2 h-4 w-4" /> Submit Emergency Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
