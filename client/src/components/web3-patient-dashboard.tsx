import { useState } from "react";
import { useWeb3 } from "@/hooks/use-web3";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { 
  Wallet, 
  Key, 
  FileText, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Copy,
  ExternalLink,
  AlertTriangle,
  ArrowLeft 
} from "lucide-react";

export default function Web3PatientDashboard() {
  const { 
    walletAddress, 
    isWalletConnected, 
    connectWallet, 
    disconnectWallet,
    patientIdentity,
    generatePatientIdentity,
    grantConsent,
    revokeConsent,
    isLoading,
    error
  } = useWeb3();
  
  const [consentRequest, setConsentRequest] = useState({
    requesterId: "",
    contentHashes: [""],
    consentType: "read"
  });

  // Fetch patient dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/web3/patient-dashboard", patientIdentity?.did],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!patientIdentity?.did,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleGrantConsent = async () => {
    if (!patientIdentity || !consentRequest.requesterId) return;
    
    try {
      await grantConsent({
        patientDID: patientIdentity.did,
        requesterId: consentRequest.requesterId,
        contentHashes: consentRequest.contentHashes.filter(hash => hash.trim()),
        consentType: consentRequest.consentType,
        patientSignature: "demo_signature", // In production, sign with wallet
      });
      
      // Reset form
      setConsentRequest({
        requesterId: "",
        contentHashes: [""],
        consentType: "read"
      });
    } catch (error) {
      console.error("Failed to grant consent:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Hospital Dashboard</span>
            </Button>
          </Link>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Web3 Patient Dashboard</h1>
            <p className="text-slate-600">Manage your decentralized health identity and consent</p>
          </div>
          <div className="w-48"></div> {/* Spacer for layout balance */}
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              <span>Wallet Connection</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isWalletConnected ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">MetaMask Wallet Required</h3>
                <p className="text-slate-600 mb-6">
                  To use Web3 features, you need to install and connect MetaMask wallet
                </p>
                
                {error && (
                  <Alert className="mb-4 max-w-md mx-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-3">
                  <Button onClick={connectWallet} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                    <Wallet className="h-4 w-4 mr-2" />
                    {isLoading ? "Connecting..." : "Connect MetaMask"}
                  </Button>
                  
                  <div className="text-center">
                    <Button
                      variant="link"
                      onClick={() => window.open("https://metamask.io/download/", "_blank")}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Don't have MetaMask? Install it here
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Connected Wallet</p>
                    <p className="font-mono text-sm">{walletAddress}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(walletAddress!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={disconnectWallet}>
                      Disconnect
                    </Button>
                  </div>
                </div>
                
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Wallet Connected
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Identity */}
        {isWalletConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-green-600" />
                <span>Decentralized Identity (DID)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!patientIdentity ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">Generate your decentralized identity</p>
                  <Button 
                    onClick={generatePatientIdentity} 
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Generate DID
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-slate-600">Your DID</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 p-2 bg-slate-100 rounded text-sm font-mono">
                        {patientIdentity.did}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(patientIdentity.did)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-slate-600">Linked Wallet</Label>
                    <p className="text-sm font-mono mt-1">{patientIdentity.walletAddress}</p>
                  </div>
                  
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <Shield className="h-3 w-3 mr-1" />
                    Identity Verified
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dashboard Overview */}
        {patientIdentity && dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboardData.medicalRecords}</p>
                    <p className="text-sm text-slate-600">Medical Records</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Shield className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboardData.verifiableCredentials}</p>
                    <p className="text-sm text-slate-600">Credentials</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboardData.activeConsents}</p>
                    <p className="text-sm text-slate-600">Active Consents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-8 w-8 text-slate-600" />
                  <div>
                    <p className="text-2xl font-bold">{dashboardData.totalConsents - dashboardData.activeConsents}</p>
                    <p className="text-sm text-slate-600">Revoked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Consent Management */}
        {patientIdentity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-amber-600" />
                <span>Consent Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Grant consent to healthcare providers using verifiable credentials. 
                  You maintain full control over your medical data.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grant Consent */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900">Grant Access Consent</h4>
                  
                  <div>
                    <Label htmlFor="requesterId">Requester ID (Hospital)</Label>
                    <Input
                      id="requesterId"
                      value={consentRequest.requesterId}
                      onChange={(e) => setConsentRequest({ ...consentRequest, requesterId: e.target.value })}
                      placeholder="did:ethr:0x..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contentHash">IPFS Content Hash</Label>
                    <Input
                      id="contentHash"
                      value={consentRequest.contentHashes[0]}
                      onChange={(e) => setConsentRequest({ 
                        ...consentRequest, 
                        contentHashes: [e.target.value] 
                      })}
                      placeholder="QmXx..."
                    />
                  </div>
                  
                  <Button 
                    onClick={handleGrantConsent} 
                    disabled={!consentRequest.requesterId || isLoading}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Grant Consent
                  </Button>
                </div>
                
                {/* Quick Actions */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900">Quick Actions</h4>
                  
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      View All Records
                    </Button>
                    
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Export Data
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-red-600 hover:text-red-700"
                      onClick={() => revokeConsent(patientIdentity.did, consentRequest.requesterId)}
                      disabled={!consentRequest.requesterId}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Revoke All Consents
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Web3 Features Info */}
        <Card>
          <CardHeader>
            <CardTitle>Web3 Healthcare Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <Key className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <h5 className="font-medium mb-2">Decentralized Identity</h5>
                <p className="text-sm text-slate-600">
                  Your DID gives you sovereign control over your health identity
                </p>
              </div>
              
              <div className="text-center p-4">
                <FileText className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h5 className="font-medium mb-2">IPFS Storage</h5>
                <p className="text-sm text-slate-600">
                  Medical records stored on decentralized IPFS network
                </p>
              </div>
              
              <div className="text-center p-4">
                <Shield className="h-12 w-12 text-purple-600 mx-auto mb-3" />
                <h5 className="font-medium mb-2">Verifiable Credentials</h5>
                <p className="text-sm text-slate-600">
                  Cryptographically secure consent management
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="bg-blue-50 rounded-lg p-4">
                <h6 className="font-medium text-blue-900 mb-2">Getting Started</h6>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Install and connect MetaMask wallet</li>
                  <li>2. Generate your decentralized identity (DID)</li>
                  <li>3. Control access to your medical records</li>
                  <li>4. Grant or revoke consent using verifiable credentials</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}