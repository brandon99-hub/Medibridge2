import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Shield, FileText, Clock, Key, Globe, User, ArrowLeft } from "lucide-react";
import PatientLoginModal from "@/components/patient-login-modal";
import { Link } from "wouter";

export default function PatientPortal() {
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [patient, setPatient] = useState<any>(null);

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

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient/logout");
      return response.json();
    },
    onSuccess: () => {
      setPatient(null);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
    },
  });

  const handlePatientLogin = (patientData: any) => {
    setPatient(patientData);
    setShowLogin(false);
    toast({
      title: "Welcome!",
      description: patientData.isNewUser 
        ? "Your secure Web3 identity has been created" 
        : "Welcome back to your patient portal",
    });
  };

  if (!patient && !currentPatient?.patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {/* Hero Section */}
          <div className="space-y-6 text-center lg:text-left">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-slate-900">
                Patient Portal
              </h1>
              <p className="text-xl text-slate-600">
                Your Medical Records, Your Control
              </p>
              <p className="text-sm text-slate-500">
                Secure Web3 identity with simple phone authentication
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Phone className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900">Phone Authentication</h3>
                  <p className="text-sm text-slate-600">Login securely with phone SMS or email verification</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Shield className="h-6 w-6 text-green-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900">Cryptographic Security</h3>
                  <p className="text-sm text-slate-600">Your records are encrypted with your personal DID and keys</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Key className="h-6 w-6 text-purple-600 mt-1" />
                <div>
                  <h3 className="font-medium text-slate-900">Consent Control & Key Recovery</h3>
                  <p className="text-sm text-slate-600">Grant and revoke access via verifiable credentials</p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                <User className="h-5 w-5 text-purple-600" />
                <span>Patient Access</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Globe className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <p className="font-medium mb-1">Web3 Features</p>
                  <p className="text-sm">
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
                Login with Phone or Email
              </Button>

              <div className="text-center pt-4 border-t">
                <Link href="/">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
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
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-purple-600" />
              <span className="text-lg font-semibold text-slate-900">Patient Portal</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{activePatient.phoneNumber}</p>
                <p className="text-xs text-slate-600">
                  Web3 Identity: {activePatient.patientDID.substring(0, 20)}...
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="records">My Records</TabsTrigger>
            <TabsTrigger value="consent">Consent Management</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <p className="text-2xl font-bold text-slate-900">-</p>
                    <p className="text-xs text-slate-600">
                      Encrypted records available
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
                    <p className="text-2xl font-bold text-slate-900">0</p>
                    <p className="text-xs text-slate-600">
                      Currently granted permissions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Phone className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1">1. Phone Login</h4>
                    <p className="text-sm text-slate-600">
                      Authenticate with your phone number and OTP
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1">2. Auto Identity</h4>
                    <p className="text-sm text-slate-600">
                      DID and encryption keys generated automatically
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Key className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <h4 className="font-medium text-slate-900 mb-1">3. Control Access</h4>
                    <p className="text-sm text-slate-600">
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
                <CardTitle>My Medical Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Your encrypted medical records will appear here. Records are stored on IPFS 
                    and can only be decrypted with your consent.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consent">
            <Card>
              <CardHeader>
                <CardTitle>Consent Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    When hospitals request access to your records, you can grant consent here. 
                    All consent is managed via verifiable credentials for maximum security.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}