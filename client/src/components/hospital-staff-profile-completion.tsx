import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Shield, 
  CheckCircle, 
  Mail, 
  Phone, 
  Briefcase, 
  UserCheck, 
  Loader2, 
  Plus, 
  Trash2, 
  Stethoscope,
  GraduationCap,
  Building2,
  Clock,
  AlertTriangle,
  Sparkles,
  Send
} from "lucide-react";

const STAFF_ROLES = [
  { value: "PHYSICIAN", label: "Physician", icon: Stethoscope, color: "bg-blue-100 text-blue-700" },
  { value: "SURGEON", label: "Surgeon", icon: GraduationCap, color: "bg-purple-100 text-purple-700" },
  { value: "EMERGENCY_DOCTOR", label: "Emergency Doctor", icon: AlertTriangle, color: "bg-red-100 text-red-700" },
  { value: "CHIEF_RESIDENT", label: "Chief Resident", icon: Building2, color: "bg-green-100 text-green-700" }
];

export interface HospitalStaffProfileCompletionProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (staff: any[]) => void;
  hospitalId: string;
  isEdit?: boolean;
  existingStaff?: any[];
  existingAdminLicense?: string;
}

export default function HospitalStaffProfileCompletion({
  isOpen,
  onClose,
  onComplete,
  hospitalId,
  isEdit = false,
  existingStaff = [],
  existingAdminLicense = ""
}: HospitalStaffProfileCompletionProps) {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const queryClient = useQueryClient();
  const [staffList, setStaffList] = useState(
    isEdit && existingStaff.length > 0 
      ? existingStaff 
      : [{ name: "", staffId: "", role: "", licenseNumber: "", department: "", email: "", adminLicense: "", isActive: true, isOnDuty: true }]
  );
  const [touched, setTouched] = useState<{ [k: number]: { [f: string]: boolean } }>({});
  const [submitting, setSubmitting] = useState(false);
  const [adminLicense, setAdminLicense] = useState("");
  const [resendStatus, setResendStatus] = useState<{ [staffId: string]: 'idle' | 'loading' | 'success' | 'error' }>({});

  useEffect(() => {
    if (isEdit && existingStaff.length > 0) {
      // Ensure all staff objects have the email field
      const staffWithEmail = existingStaff.map(staff => ({
        ...staff,
        email: staff.email || ""
      }));
      setStaffList(staffWithEmail);
      setAdminLicense(existingAdminLicense);
    }
  }, [isEdit, existingStaff, existingAdminLicense]);

  // Validation helpers
  const isStaffValid = (staff: any) =>
    staff?.name?.trim() &&
    staff?.staffId?.trim() &&
    staff?.role &&
    staff?.licenseNumber?.trim() &&
    staff?.department?.trim() &&
    staff?.email?.trim();
  const hasDuplicates = () => {
    const ids = staffList.map((s) => s?.staffId?.trim() || "").filter(id => id !== "");
    return new Set(ids).size !== ids.length;
  };
  const isFormValid =
    staffList.length >= 2 &&
    staffList.length <= 3 &&
    staffList.every(isStaffValid) &&
    !hasDuplicates() &&
    adminLicense?.trim();

  const addStaff = () => {
    if (staffList.length < 3) {
      setStaffList([...staffList, { name: "", staffId: "", role: "", licenseNumber: "", department: "", email: "", adminLicense: "", isActive: true, isOnDuty: true }]);
    }
  };
  const removeStaff = (idx: number) => {
    if (idx >= 0 && idx < staffList.length && staffList.length > 2) {
      setStaffList(staffList.filter((_, i) => i !== idx));
    }
  };
  const updateStaff = (idx: number, field: string, value: any) => {
    if (idx >= 0 && idx < staffList.length) {
      setStaffList((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
      setTouched((t) => ({ ...t, [idx]: { ...t[idx], [field]: true } }));
    }
  };

  const completeStaffProfileMutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      try {
        const endpoint = isEdit ? "/api/hospital/update-staff-profile" : "/api/hospital/complete-staff-profile";
        const response = await apiRequestWithCsrf("POST", endpoint, {
          hospitalId,
          adminLicense,
          staff: staffList
        });
        setSubmitting(false);
        return response.json();
      } catch (error) {
        setSubmitting(false);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Staff profile mutation success:", data);
      toast({
        title: isEdit ? "Staff Profile Updated" : "Staff Profile Completed",
        description: isEdit ? "Emergency authorizers have been updated." : "Emergency authorizers have been registered.",
      });
      onComplete(data.staff);
      onClose();
      queryClient.invalidateQueries({ queryKey: ['staffProfile', hospitalId] });
    },
    onError: (error: any) => {
      setSubmitting(false);
      console.error("Staff profile mutation error:", error);
      toast({
        title: isEdit ? "Profile Update Failed" : "Profile Completion Failed",
        description: error.message || `Could not ${isEdit ? 'update' : 'complete'} staff profile.`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(
      Object.fromEntries(
        staffList.map((_, idx) => [idx, { name: true, staffId: true, role: true, licenseNumber: true, department: true, email: true }])
      )
    );
    if (!isFormValid) {
      toast({
        title: "Missing or Invalid Information",
        description: "Please fill in all required fields for at least 2 and at most 3 unique staff.",
        variant: "destructive",
      });
      return;
    }
    completeStaffProfileMutation.mutate();
  };

  const getRoleInfo = (role: string) => {
    return STAFF_ROLES.find(r => r.value === role) || STAFF_ROLES[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <DialogContent className="sm:max-w-4xl p-0 overflow-hidden shadow-2xl rounded-3xl border-0 bg-gradient-to-br from-slate-50 to-blue-50 max-h-[90vh]">
              {/* Header with gradient - Fixed */}
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <Shield className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-3xl font-bold">
                        {isEdit ? "Edit Emergency Authorizers" : "Register Emergency Authorizers"}
                      </DialogTitle>
                      <DialogDescription className="text-blue-100 text-lg mt-2">
                        {isEdit 
                          ? "Update your hospital's emergency consent authorizers"
                          : "Designate 2-3 trusted staff for emergency access authorization. These staff will receive email invitations to activate their accounts."
                        }
                      </DialogDescription>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="w-full h-2 bg-white/20 rounded-full mt-6">
                    <div className="h-2 bg-white rounded-full transition-all duration-500 ease-out" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                  {/* Admin License Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
                    <Label htmlFor="adminLicense" className="text-lg font-semibold text-slate-700 flex items-center space-x-2 mb-4">
                      <Shield className="h-5 w-5" />
                      <span>Admin Medical License *</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="adminLicense"
                        value={adminLicense}
                        onChange={e => setAdminLicense(e.target.value)}
                        placeholder="Enter your admin medical license number"
                        className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${!adminLicense.trim() ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'}`}
                      />
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      {adminLicense.trim() && (
                        <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                      )}
                    </div>
                    {!adminLicense.trim() && (
                      <p className="text-sm text-red-500 flex items-center space-x-1 mt-2">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Admin medical license is required</span>
                      </p>
                    )}
                  </div>
                  {/* Info Alert */}
                  <Alert className="border-blue-200 bg-blue-50/50 backdrop-blur-sm">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    <AlertDescription className="text-blue-800 font-medium">
                      <strong>Emergency Authorizers:</strong> These staff members will have the ability to approve emergency access requests to patient medical records. 
                      They will receive email invitations to activate their accounts and must complete the activation process before they can authorize emergency access.
                      {!isEdit && " You can edit this list later from the admin dashboard."}
                    </AlertDescription>
                  </Alert>

                  {/* Staff Cards */}
                  <div className="space-y-6">
                    {staffList.map((staff, idx) => {
                      const roleInfo = getRoleInfo(staff.role);
                      const RoleIcon = roleInfo.icon;
                      
                      return (
                        <Card key={idx} className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <CardHeader className="relative z-10 pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl">
                                  <User className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-xl font-semibold text-slate-800">
                                    Staff Member {idx + 1}
                                  </CardTitle>
                                  <p className="text-sm text-slate-600">Emergency Authorizer</p>
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors duration-200"
                                onClick={() => removeStaff(idx)}
                                disabled={staffList.length <= 2}
                                title="Remove staff"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </CardHeader>

                          <CardContent className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Name */}
                              <div className="space-y-2">
                                <Label htmlFor={`name-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <User className="h-4 w-4" />
                                  <span>Full Name *</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id={`name-${idx}`}
                                    value={staff.name}
                                    onChange={(e) => updateStaff(idx, "name", e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, [idx]: { ...t[idx], name: true } }))}
                                    placeholder="Dr. Sarah Johnson"
                                    className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${
                                      touched[idx]?.name && !staff.name.trim() 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.name && staff.name.trim()
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  />
                                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.name && staff.name.trim() && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                </div>
                                {touched[idx]?.name && !staff.name.trim() && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Full name is required</span>
                                  </p>
                                )}
                              </div>

                              {/* Staff ID */}
                              <div className="space-y-2">
                                <Label htmlFor={`staffId-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <Shield className="h-4 w-4" />
                                  <span>Staff ID *</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id={`staffId-${idx}`}
                                    value={staff.staffId}
                                    onChange={(e) => updateStaff(idx, "staffId", e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, [idx]: { ...t[idx], staffId: true } }))}
                                    placeholder="DR001"
                                    className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${
                                      touched[idx]?.staffId && !staff.staffId.trim() 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.staffId && staff.staffId.trim()
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  />
                                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.staffId && staff.staffId.trim() && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                </div>
                                {touched[idx]?.staffId && !staff.staffId.trim() && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Staff ID is required</span>
                                  </p>
                                )}
                              </div>

                              {/* Role */}
                              <div className="space-y-2">
                                <Label htmlFor={`role-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <RoleIcon className="h-4 w-4" />
                                  <span>Role *</span>
                                </Label>
                                <div className="relative">
                                  <select
                                    id={`role-${idx}`}
                                    value={staff.role}
                                    onChange={(e) => updateStaff(idx, "role", e.target.value)}
                                    className={`w-full h-12 pl-12 pr-10 text-lg border-2 rounded-md transition-all duration-200 appearance-none bg-white ${
                                      touched[idx]?.role && !staff.role 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.role && staff.role
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  >
                                    <option value="">Select role</option>
                                    {STAFF_ROLES.map((role) => (
                                      <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                  </select>
                                  <RoleIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.role && staff.role && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                </div>
                                {touched[idx]?.role && !staff.role && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Role is required</span>
                                  </p>
                                )}
                              </div>

                              {/* License Number */}
                              <div className="space-y-2">
                                <Label htmlFor={`licenseNumber-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <GraduationCap className="h-4 w-4" />
                                  <span>License Number *</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id={`licenseNumber-${idx}`}
                                    value={staff.licenseNumber}
                                    onChange={(e) => updateStaff(idx, "licenseNumber", e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, [idx]: { ...t[idx], licenseNumber: true } }))}
                                    placeholder="MD123456"
                                    className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${
                                      touched[idx]?.licenseNumber && !staff.licenseNumber.trim() 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.licenseNumber && staff.licenseNumber.trim()
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  />
                                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.licenseNumber && staff.licenseNumber.trim() && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                </div>
                                {touched[idx]?.licenseNumber && !staff.licenseNumber.trim() && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>License number is required</span>
                                  </p>
                                )}
                              </div>

                              {/* Department */}
                              <div className="space-y-2">
                                <Label htmlFor={`department-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <Building2 className="h-4 w-4" />
                                  <span>Department *</span>
                                </Label>
                                <div className="relative">
                                  <Input
                                    id={`department-${idx}`}
                                    value={staff.department}
                                    onChange={(e) => updateStaff(idx, "department", e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, [idx]: { ...t[idx], department: true } }))}
                                    placeholder="Emergency Medicine"
                                    className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${
                                      touched[idx]?.department && !staff.department.trim() 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.department && staff.department.trim()
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  />
                                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.department && staff.department.trim() && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                </div>
                                {touched[idx]?.department && !staff.department.trim() && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Department is required</span>
                                  </p>
                                )}
                              </div>

                              {/* Email */}
                              <div className="space-y-2">
                                <Label htmlFor={`email-${idx}`} className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <Mail className="h-4 w-4" />
                                  <span>Email Address *</span>
                                </Label>
                                <div className="relative flex items-center">
                                  <Input
                                    id={`email-${idx}`}
                                    type="email"
                                    value={staff.email}
                                    onChange={(e) => updateStaff(idx, "email", e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, [idx]: { ...t[idx], email: true } }))}
                                    placeholder="dr.sarah@hospital.com"
                                    className={`pl-12 pr-10 h-12 text-lg border-2 transition-all duration-200 ${
                                      touched[idx]?.email && !staff.email.trim() 
                                        ? 'border-red-300 bg-red-50' 
                                        : touched[idx]?.email && staff.email.trim()
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-slate-200 hover:border-blue-300 focus:border-blue-500'
                                    }`}
                                  />
                                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                  {touched[idx]?.email && staff.email.trim() && (
                                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                  )}
                                  {/* Resend Invitation Button */}
                                  {isEdit && staff.id && staff.email && (
                                    <button
                                      type="button"
                                      className={`absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded-full border transition-colors
                                        ${resendStatus[staff.staffId] === 'success' ? 'bg-green-100 border-green-300' : ''}
                                        ${resendStatus[staff.staffId] === 'error' ? 'bg-red-100 border-red-300' : ''}
                                        ${resendStatus[staff.staffId] === 'loading' ? 'bg-blue-100 border-blue-300' : 'bg-white border-blue-200 hover:bg-blue-50'}
                                        text-blue-600 hover:text-blue-800`}
                                      title="Resend Invitation"
                                      disabled={resendStatus[staff.staffId] === 'loading'}
                                      onClick={async () => {
                                        setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'loading' }));
                                        try {
                                          const res = await fetch("/api/hospital/resend-invitation", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ staffId: staff.staffId, forceResend: true })
                                          });
                                          const data = await res.json();
                                          if (data.success) {
                                            setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'success' }));
                                            toast({ title: "Invitation Sent", description: `Invitation resent to ${staff.email}` });
                                            setTimeout(() => setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'idle' })), 1200);
                                          } else {
                                            setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'error' }));
                                            toast({ title: "Failed to Resend", description: data.error || "Unknown error", variant: "destructive" });
                                            setTimeout(() => setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'idle' })), 1500);
                                          }
                                        } catch (err) {
                                          setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'error' }));
                                          toast({ title: "Failed to Resend", description: "Network or server error", variant: "destructive" });
                                          setTimeout(() => setResendStatus((prev) => ({ ...prev, [staff.staffId]: 'idle' })), 1500);
                                        }
                                      }}
                                    >
                                      {resendStatus[staff.staffId] === 'loading' ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                      ) : resendStatus[staff.staffId] === 'success' ? (
                                        <CheckCircle className="h-5 w-5 text-green-600 transition-all" />
                                      ) : resendStatus[staff.staffId] === 'error' ? (
                                        <AlertTriangle className="h-5 w-5 text-red-600 transition-all" />
                                      ) : (
                                        <Send className="h-5 w-5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {touched[idx]?.email && !staff.email.trim() && (
                                  <p className="text-sm text-red-500 flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Email address is required</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Status toggles */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
                              <div className="flex items-center space-x-6">
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={staff.isActive}
                                      onChange={(e) => updateStaff(idx, "isActive", e.target.checked)}
                                      className="sr-only"
                                    />
                                    <div className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                                      staff.isActive ? 'bg-blue-500' : 'bg-slate-300'
                                    }`}>
                                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                        staff.isActive ? 'translate-x-6' : 'translate-x-1'
                                      }`}></div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className={`p-1 rounded-full ${staff.isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                      <User className={`h-4 w-4 ${staff.isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                    </div>
                                    <span className={`font-medium ${staff.isActive ? 'text-blue-700' : 'text-slate-500'}`}>
                                      Active
                                    </span>
                                  </div>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={staff.isOnDuty}
                                      onChange={(e) => updateStaff(idx, "isOnDuty", e.target.checked)}
                                      className="sr-only"
                                    />
                                    <div className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                                      staff.isOnDuty ? 'bg-green-500' : 'bg-slate-300'
                                    }`}>
                                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                        staff.isOnDuty ? 'translate-x-6' : 'translate-x-1'
                                      }`}></div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className={`p-1 rounded-full ${staff.isOnDuty ? 'bg-green-100' : 'bg-slate-100'}`}>
                                      <Clock className={`h-4 w-4 ${staff.isOnDuty ? 'text-green-600' : 'text-slate-400'}`} />
                                    </div>
                                    <span className={`font-medium ${staff.isOnDuty ? 'text-green-700' : 'text-slate-500'}`}>
                                      On Duty
                                    </span>
                                  </div>
                                </label>
                              </div>

                              {staff.role && (
                                <Badge className={`${getRoleInfo(staff.role).color} font-semibold px-3 py-1`}>
                                  <RoleIcon className="h-3 w-3 mr-1" />
                                  {getRoleInfo(staff.role).label}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Add Staff Button */}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex items-center space-x-3 px-6 py-3 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 rounded-xl"
                      onClick={addStaff}
                      disabled={staffList.length >= 3}
                    >
                      <Plus className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-600">Add Another Staff Member</span>
                    </Button>
                  </div>

                  {/* Submit and Skip Buttons */}
                  <div className="pt-6 pb-4 space-y-3">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50"
                      disabled={submitting || !isFormValid}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin mr-3" />
                          {isEdit ? "Updating..." : "Registering..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-6 w-6 mr-3" />
                          {isEdit ? "Update Staff Profile" : "Complete Staff Profile"}
                        </>
                      )}
                    </Button>
                    
                    {!isEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-slate-300 text-slate-600 hover:bg-slate-50 font-medium py-3 rounded-xl transition-all duration-200"
                        onClick={onClose}
                      >
                        Skip for Now
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </DialogContent>
          </div>
        </>
      )}
    </Dialog>
  );
} 