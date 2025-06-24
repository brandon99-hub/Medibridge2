import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, FileText, Key, Globe, CheckCircle, AlertTriangle } from "lucide-react";
import PatientLoginModal from "./patient-login-modal";

/**
 * Web3 Consent Demo Component
 * Demonstrates the Web3 consent flow with Web2 UX
 */
export default function Web3ConsentDemo() {
  const { toast } = useToast();
  const [showPatientLogin, setShowPatientLogin] = useState(false);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [verifiableCredential, setVerifiableCredential] = useState<string>("");
  const [testRecordId, setTestRecordId] = useState("1");

  // Issue consent credential
  const issueConsentMutation = useMutation({
    mutationFn: async () => {
      if (!patientInfo) throw new Error("Patient not authenticated");
      
      const response = await apiRequest("POST", "/api/issue-consent/", {
        patientId: patientInfo.phoneNumber,
        hospitalId: 2, // Hospital B
        recordId: parseInt(testRecordId),
        validForHours: 24,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setVerifiableCredential(data.verifiableCredential);
      toast({
        title: "Consent Credential Issued",
        description: "Verifiable credential created for hospital access",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Issue Credential",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Access record with credential
  const accessRecordMutation = useMutation({
    mutationFn: async () => {
      if (!verifiableCredential) throw new Error("No credential available");
      
      const response = await apiRequest("POST", "/api/get-record/", {
        verifiableCredential,
        hospitalDID: "did:medbridge:hospital:brandon",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Record Access Successful",
        description: "Medical record retrieved using verifiable credential",
      });
      console.log("Decrypted record:", data.record);
    },
    onError: (error: Error) => {
      toast({
        title: "Access Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <span>Web3 Consent Demo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">How It Works</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Patient authenticates via phone/OTP (Web2 UX)</li>
              <li>2. DID and keypair generated automatically (Web3 backend)</li>
              <li>3. Medical records encrypted and stored on IPFS</li>
              <li>4. Patient grants consent via verifiable credential</li>
              <li>5. Hospital accesses records with cryptographic proof</li>
            </ol>
          </div>

          {/* Step 1: Patient Authentication */}
          <div className="space-y-3">
            <h5 className="font-medium flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</div>
              <span>Patient Authentication</span>
            </h5>
            
            {!patientInfo ? (
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setShowPatientLogin(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Authenticate Patient
                </Button>
                <span className="text-sm text-slate-600">Login via phone number</span>
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Patient Authenticated</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  DID: {patientInfo.patientDID}
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Issue Consent */}
          <div className="space-y-3">
            <h5 className="font-medium flex items-center space-x-2">
              <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs">2</div>
              <span>Issue Consent Credential</span>
            </h5>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <Label htmlFor="recordId">Record ID</Label>
                <Input
                  id="recordId"
                  value={testRecordId}
                  onChange={(e) => setTestRecordId(e.target.value)}
                  placeholder="1"
                  className="w-20"
                />
              </div>
              <Button
                onClick={() => issueConsentMutation.mutate()}
                disabled={!patientInfo || issueConsentMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Key className="h-4 w-4 mr-2" />
                {issueConsentMutation.isPending ? "Issuing..." : "Issue Credential"}
              </Button>
            </div>

            {verifiableCredential && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Credential Issued</span>
                </div>
                <code className="text-xs text-purple-700 break-all">
                  {verifiableCredential.substring(0, 100)}...
                </code>
              </div>
            )}
          </div>

          {/* Step 3: Access Record */}
          <div className="space-y-3">
            <h5 className="font-medium flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">3</div>
              <span>Access Medical Record</span>
            </h5>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => accessRecordMutation.mutate()}
                disabled={!verifiableCredential || accessRecordMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                {accessRecordMutation.isPending ? "Accessing..." : "Access Record"}
              </Button>
              <span className="text-sm text-slate-600">Decrypt with credential</span>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h6 className="font-medium text-sm">Patient Sovereignty</h6>
              <p className="text-xs text-slate-600">Full control over medical data</p>
            </div>
            <div className="text-center">
              <Key className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h6 className="font-medium text-sm">Cryptographic Proof</h6>
              <p className="text-xs text-slate-600">Verifiable credentials</p>
            </div>
            <div className="text-center">
              <Globe className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h6 className="font-medium text-sm">Decentralized Storage</h6>
              <p className="text-xs text-slate-600">IPFS encrypted records</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientLoginModal
        isOpen={showPatientLogin}
        onClose={() => setShowPatientLogin(false)}
        onSuccess={(patient) => {
          setPatientInfo(patient);
          setShowPatientLogin(false);
        }}
      />
    </div>
  );
}