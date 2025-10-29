import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Shield, FileText, Clock, Key, Globe, User, ArrowLeft, Stethoscope, AlertTriangle, Calendar, Building, CreditCard, Mail, CheckCircle, ChevronDown, Settings, LogOut } from "lucide-react";
import PatientLoginModal from "@/components/patient-login-modal";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PatientProfileCompletion from "@/components/patient-profile-completion";

interface PatientRecord {
  id: number;
  visitDate: string;
  visitType: string;
  diagnosis: string;
  prescription: string;
  physician: string;
  department: string;
  submittedAt: string;
  recordType: string;
  ipfsHash?: string;
  consentGiven: boolean;
  consentRecords: Array<{
    accessedBy: number;
    consentGrantedBy: string;
    accessedAt: string;
  }>;
}

export default function PatientPortal() {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const [location, setLocation] = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [currentPatientForEdit, setCurrentPatientForEdit] = useState<any>(null);

  // Check if patient is already logged in
  const { data: currentPatient, refetch } = useQuery({
    queryKey: ["/api/patient/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/patient/me");
      return response.json();
    },
    enabled: false,
    retry: false,
  });

  // Fetch patient records
  const { data: patientRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["/api/patient/records"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/patient/records");
      return response.json();
    },
    enabled: false,
    retry: false,
  });

  // Fetch patient consents
  const { data: patientConsents, refetch: refetchConsents } = useQuery({
    queryKey: ["/api/patient/consents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/patient/consents");
      return response.json();
    },
    enabled: false,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/logout');
      const response = await apiRequestWithCsrf("POST", "/api/patient/logout");
      return response.json();
    },
    onSuccess: () => {
      setPatient(null);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      // Redirect to the auth login page
      setLocation("/auth");
    },
  });

  const consentResponseMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: number; action: 'approve' | 'deny' }) => {
      const consentType = patient?.patientDID ? 'web3' : 'traditional';
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/patient/respond-to-consent');
      const response = await apiRequestWithCsrf("POST", "/api/patient/respond-to-consent", {
        requestId,
        action,
        reason: action === 'approve' ? 'Patient approved consent' : 'Patient denied consent',
        consentType: consentType
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.action === 'approve' ? "Consent Approved" : "Consent Denied",
        description: data.message,
      });
      // Refresh consents to show updated status
      refetchConsents();
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePatientLogin = (patientData: any) => {
    setPatient(patientData);
    setShowLogin(false);
    // Fetch records and consents after login
    refetch();
    refetchRecords();
    refetchConsents();
    toast({
      title: "Welcome!",
      description: patientData.isNewUser 
        ? "Your secure Web3 identity has been created" 
        : "Welcome back to your patient portal",
    });
  };

  const handleConsentResponse = (requestId: number, action: 'approve' | 'deny') => {
    consentResponseMutation.mutate({ requestId, action });
  };

  const handleEditProfile = () => {
    const activePatient = patient || currentPatient?.patient;
    
    if (!activePatient.isProfileComplete) {
      // Show profile completion for incomplete profiles
      setCurrentPatientForEdit(activePatient);
      setShowProfileCompletion(true);
    } else {
      // Profile is complete - show message or disable button
      toast({
        title: "Profile Complete",
        description: "Your profile is already complete. Profile editing is not available yet.",
        variant: "default",
      });
    }
  };

  const handleProfileComplete = async (completedPatient: any) => {
    // Update the patient state with completed profile
    if (patient) {
      setPatient(completedPatient);
    }
    setShowProfileCompletion(false);
    setCurrentPatientForEdit(null);
    
    // Refetch patient data to get updated profile
    await refetch();
    await refetchRecords();
    await refetchConsents();
    
    toast({
      title: "Profile Completed!",
      description: "Your profile has been successfully completed. You can now access all features.",
    });
  };

  if (!patient && !currentPatient?.patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
          
          {/* Hero Section */}
          <div className="space-y-4 sm:space-y-6 text-center lg:text-left">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Patient Portal
              </h1>
              <p className="text-lg sm:text-xl text-slate-600">
                Your Medical Records, Your Control
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                Secure Web3 identity with simple phone authentication
              </p>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900 text-sm sm:text-base">Phone Authentication</h3>
                  <p className="text-xs sm:text-sm text-slate-600">Login securely with phone SMS or email verification</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900 text-sm sm:text-base">Cryptographic Security</h3>
                  <p className="text-xs sm:text-sm text-slate-600">Your records are encrypted with your personal DID and keys</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Key className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900 text-sm sm:text-base">Consent Control & Key Recovery</h3>
                  <p className="text-xs sm:text-sm text-slate-600">Grant and revoke access via verifiable credentials</p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <span className="text-lg sm:text-xl">Patient Access</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <p className="font-medium mb-1 text-sm sm:text-base">Web3 Features</p>
                  <p className="text-xs sm:text-sm">
                    Your digital identity (DID) and encryption keys are automatically 
                    generated when you first login. No wallet required!
                  </p>
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => setShowLogin(true)}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <Phone className="h-4 w-4 mr-2" />
                <span className="text-sm sm:text-base">Login with Phone or Email</span>
              </Button>

              <div className="text-center pt-3 sm:pt-4 border-t">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                    <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Back to Hospital Portal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <PatientLoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onSuccess={handlePatientLogin}
        />
      </div>
    );
  }

  const activePatient = patient || currentPatient?.patient;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              <span className="text-base sm:text-lg font-semibold text-slate-900">Patient Portal</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-2 sm:px-3 py-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-slate-900">{activePatient.fullName || "Patient"}</p>
                      <p className="text-xs text-slate-600">
                        {activePatient.patientDID ? 
                          `${activePatient.patientDID.substring(0, 12)}...` : 
                          "Web3 Identity"
                        }
                      </p>
                    </div>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{activePatient.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {activePatient.phoneNumber || activePatient.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* Profile Information */}
                  <div className="px-2 py-1.5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">National ID:</span>
                        <span className="font-mono text-slate-900">{activePatient.nationalId || "Not set"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Phone:</span>
                        <span className="text-slate-900">{activePatient.phoneNumber || "Not set"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Email:</span>
                        <span className="text-slate-900">{activePatient.email || "Not set"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Status:</span>
                        <Badge variant={activePatient.isProfileComplete ? "default" : "secondary"} className="text-xs">
                          {activePatient.isProfileComplete ? "Complete" : "Incomplete"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    className={`flex items-center space-x-2 ${!activePatient.isProfileComplete ? 'text-blue-600 focus:text-blue-600' : 'text-slate-400 cursor-not-allowed'}`}
                    onClick={handleEditProfile}
                    disabled={activePatient.isProfileComplete}
                  >
                    <Settings className="h-4 w-4" />
                    <span>{activePatient.isProfileComplete ? 'Profile Complete' : 'Complete Profile'}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="records" className="text-xs sm:text-sm">My Records</TabsTrigger>
            <TabsTrigger value="consent" className="text-xs sm:text-sm">Consent Management</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Identity Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge className="bg-green-100 text-green-800">Verified</Badge>
                    <p className="text-xs text-slate-600">
                      Your Web3 identity is secure and verified
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span>Medical Records</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-slate-900">
                      {patientRecords?.totalRecords || 0}
                    </p>
                    <p className="text-xs text-slate-600">
                      {patientRecords?.totalRecords > 0 ? 
                        "Records available" : 
                        "No records yet"
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Key className="h-4 w-4 text-purple-600" />
                    <span>Active Consents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-slate-900">
                      {patientConsents?.totalConsents || 0}
                    </p>
                    <p className="text-xs text-slate-600">
                      {patientConsents?.totalConsents > 0 ? 
                        "Currently granted permissions" : 
                        "No active consents"
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4 sm:mt-6">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <Phone className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1 text-sm sm:text-base">1. Phone Login</h4>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Authenticate with your phone number and OTP
                    </p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                    <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1 text-sm sm:text-base">2. Auto Identity</h4>
                    <p className="text-xs sm:text-sm text-slate-600">
                      DID and encryption keys generated automatically
                    </p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                    <Key className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1 text-sm sm:text-base">3. Control Access</h4>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Grant consent via verifiable credentials
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <span className="text-lg sm:text-xl">My Medical Records</span>
                  {patientRecords?.totalRecords > 0 && (
                    <Badge variant="secondary" className="text-xs sm:text-sm">{patientRecords.totalRecords} records</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {patientRecords?.records && patientRecords.records.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {patientRecords.records.map((record: PatientRecord) => (
                      <Card key={record.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4 sm:pt-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-full flex items-center justify-center">
                                {record.visitType === "emergency" ? (
                                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                                ) : (
                                  <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h5 className="font-semibold text-slate-900 text-sm sm:text-base">
                                  {record.visitType || "Medical Visit"}
                                </h5>
                                <p className="text-xs sm:text-sm text-slate-600">{record.visitDate}</p>
                                <p className="text-xs sm:text-sm text-slate-500">
                                  {record.physician || "Unknown Physician"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={record.recordType === "web3" ? "default" : "secondary"} className="text-xs">
                                {record.recordType === "web3" ? "Web3" : "Traditional"}
                              </Badge>
                              {record.consentGiven && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Consent Given
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2 sm:space-y-3">
                            <div>
                              <h6 className="text-xs sm:text-sm font-medium text-slate-700 mb-1">Diagnosis</h6>
                              <p className="text-xs sm:text-sm text-slate-600">{record.diagnosis}</p>
                            </div>
                            
                            {record.prescription && (
                              <div>
                                <h6 className="text-xs sm:text-sm font-medium text-slate-700 mb-1">Prescription & Treatment</h6>
                                <p className="text-xs sm:text-sm text-slate-600">{record.prescription}</p>
                              </div>
                            )}

                            {record.department && (
                              <div>
                                <h6 className="text-xs sm:text-sm font-medium text-slate-700 mb-1">Department</h6>
                                <p className="text-xs sm:text-sm text-slate-600">{record.department}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-200 space-y-2 sm:space-y-0">
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-slate-500">
                              <span>Record ID: REC-{record.id}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>Submitted: {new Date(record.submittedAt).toLocaleString()}</span>
                            </div>
                            {record.ipfsHash && (
                              <Badge variant="outline" className="text-xs w-fit">
                                <Globe className="h-3 w-3 mr-1" />
                                IPFS: {record.ipfsHash.substring(0, 10)}...
                              </Badge>
                            )}
                          </div>

                          {record.consentRecords && record.consentRecords.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <h6 className="text-sm font-medium text-slate-700 mb-2">Access History</h6>
                              <div className="space-y-2">
                                {record.consentRecords.map((consent, index) => (
                                  <div key={index} className="flex items-center justify-between text-xs text-slate-600">
                                    <span>Accessed by Hospital B</span>
                                    <span>{new Date(consent.accessedAt).toLocaleDateString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      {patientRecords ? 
                        "No medical records found. Records will appear here once they are submitted by healthcare providers." :
                        "Your encrypted medical records will appear here. Records are stored securely and can only be accessed with your consent."
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consent">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="h-5 w-5 text-purple-600" />
                  <span>Consent Management</span>
                  {(patientConsents?.totalConsents || 0) + (patientConsents?.totalPendingRequests || 0) > 0 && (
                    <Badge variant="secondary">
                      {patientConsents?.totalConsents || 0} active, {patientConsents?.totalPendingRequests || 0} pending
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Pending Consent Requests */}
                {patientConsents?.pendingRequests && patientConsents.pendingRequests.length > 0 && (
                  <div className="space-y-4 mb-8">
                    <h4 className="font-medium text-slate-900 flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Pending Consent Requests</span>
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        {patientConsents.pendingRequests.length} new
                      </Badge>
                    </h4>
                    {patientConsents.pendingRequests.map((request: any, index: number) => (
                      <Card key={index} className="border-l-4 border-l-amber-500 bg-amber-50/50">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Building className="h-4 w-4 text-amber-600" />
                                <p className="font-medium text-slate-900">{request.hospitalName}</p>
                                <Badge variant="outline" className="text-xs">
                                  {request.hospitalType === 'B' ? 'Hospital B' : 'Unknown'}
                                </Badge>
                                <Badge variant={request.consentType === 'web3' ? 'default' : 'secondary'} className={`text-xs ${request.consentType === 'web3' ? 'bg-purple-100 text-purple-800' : ''}`}>
                                  {request.consentType === 'web3' ? 'Web3' : 'Traditional'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-3">
                                This hospital is requesting access to your medical records for care coordination.
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-slate-500">
                                <span>Request ID: #{request.id}</span>
                                <span>•</span>
                                <span>Requested: {new Date(request.accessedAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => handleConsentResponse(request.id, 'deny')}
                              >
                                Deny
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleConsentResponse(request.id, 'approve')}
                                disabled={consentResponseMutation.isPending}
                              >
                                {consentResponseMutation.isPending ? 'Approving...' : 'Approve'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Active Consents */}
                {patientConsents?.traditionalConsents && patientConsents.traditionalConsents.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900">Traditional Consents</h4>
                    {patientConsents.traditionalConsents.map((consent: any, index: number) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                              <p className="font-medium text-slate-900">Hospital B Access</p>
                                <Badge variant="secondary" className="text-xs">
                                  Traditional
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                Granted by: {consent.consentGrantedBy}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(consent.accessedAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              <Shield className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Web3 Consents */}
                {patientConsents?.web3Consents && patientConsents.web3Consents.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900">Web3 Consents</h4>
                    {patientConsents.web3Consents.map((consent: any, index: number) => (
                      <Card key={index} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="font-medium text-slate-900">Cryptographic Access</p>
                                <Badge variant="default" className="text-xs bg-purple-100 text-purple-800">
                                  Web3
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                Requester: {consent.hospitalName || consent.requesterId || 'Unknown'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {consent.accessedAt ? new Date(consent.accessedAt).toLocaleString() : consent.createdAt ? new Date(consent.createdAt).toLocaleString() : 'Unknown Date'}
                              </p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800">
                              <Shield className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* No Consents Message */}
                {(!patientConsents || 
                  ((patientConsents?.traditionalConsents?.length || 0) === 0 && 
                   (patientConsents?.web3Consents?.length || 0) === 0 &&
                   (patientConsents?.pendingRequests?.length || 0) === 0)) && (
                  <Alert>
                    <Key className="h-4 w-4" />
                    <AlertDescription>
                      {patientConsents ? 
                        "No consent records found. When hospitals request access to your records, you can manage permissions here." :
                        "When hospitals request access to your records, you can grant consent here. All consent is managed via verifiable credentials for maximum security."
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Profile Completion Modal for Incomplete Profiles */}
      {showProfileCompletion && currentPatientForEdit && (
        <PatientProfileCompletion
          isOpen={showProfileCompletion}
          onClose={() => {
            setShowProfileCompletion(false);
            setCurrentPatientForEdit(null);
          }}
          onComplete={handleProfileComplete}
          patientDID={currentPatientForEdit.patientDID}
        />
      )}
    </div>
  );
}