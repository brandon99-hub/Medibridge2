import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Key, 
  QrCode, 
  Download, 
  Shield, 
  AlertTriangle, 
  Copy,
  Eye,
  EyeOff
} from "lucide-react";

interface PatientKeyRecoveryProps {
  patientDID: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PatientKeyRecovery({ patientDID, isOpen, onClose }: PatientKeyRecoveryProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  // Mock recovery data - replace with actual API calls
  const recoveryInfo = {
    hasBackup: true,
    lastBackup: "2025-01-20T10:30:00Z",
    recoveryPhrase: "abandon ability able about above absent absorb abstract absurd abuse access accident",
    qrCodeData: "eyJkaWQiOiJkaWQ6a2V5OnpEbmFlcUNrZEV3V2VZTHJHNHpQdFgiLCJrZXkiOiIuLi4ifQ==",
  };

  const generateQRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient/export-key-qr", {
        patientDID,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "QR Code Generated",
        description: "Your recovery QR code has been generated securely",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRecoveryPhraseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient/generate-recovery-phrase", {
        patientDID,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Recovery Phrase Generated",
        description: "Your 12-word recovery phrase has been created",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Recovery information copied securely",
    });
  };

  const downloadRecoveryFile = () => {
    const recoveryData = {
      patientDID,
      recoveryPhrase: recoveryInfo.recoveryPhrase,
      qrCodeData: recoveryInfo.qrCodeData,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(recoveryData, null, 2)], {
      type: "application/json",
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medbridge-recovery-${patientDID.slice(-8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Recovery File Downloaded",
      description: "Store this file in a secure location",
    });
  };

  const isConfirmationValid = confirmationInput.toLowerCase() === "i understand";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-600" />
            <span>Key Recovery & Backup</span>
          </DialogTitle>
          <DialogDescription>
            Secure backup and recovery options for your medical data access keys
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="phrase">Recovery Phrase</TabsTrigger>
            <TabsTrigger value="qr">QR Export</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your private keys are safely encrypted and stored. These recovery options ensure you can always access your medical data.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Key className="h-4 w-4" />
                    <span>Current Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Backup Status</span>
                    <span className="font-medium text-green-600">
                      {recoveryInfo.hasBackup ? "Protected" : "No Backup"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Last Backup</span>
                    <span className="font-medium">
                      {new Date(recoveryInfo.lastBackup).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Patient DID</span>
                    <span className="font-mono text-xs">
                      {patientDID.slice(0, 20)}...
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recovery Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("phrase")}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    12-Word Recovery Phrase
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("qr")}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code Export
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={downloadRecoveryFile}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Recovery File
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Security Warning</p>
                <p className="text-sm mt-1">
                  Recovery information grants full access to your medical data. Store it securely and never share it online.
                </p>
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="phrase" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Important: Write down these 12 words in order</p>
                <p className="text-sm mt-1">
                  This phrase can restore access to all your medical data. Keep it safe and private.
                </p>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recovery Phrase</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRecoveryPhrase(!showRecoveryPhrase)}
                  >
                    {showRecoveryPhrase ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showRecoveryPhrase ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 rounded-lg font-mono text-sm">
                      {recoveryInfo.recoveryPhrase.split(" ").map((word, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-slate-400 w-6">{index + 1}.</span>
                          <span className="font-medium">{word}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(recoveryInfo.recoveryPhrase)}
                        className="flex-1"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Phrase
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateRecoveryPhraseMutation.mutate}
                        disabled={generateRecoveryPhraseMutation.isPending}
                        className="flex-1"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        {generateRecoveryPhraseMutation.isPending ? "Generating..." : "New Phrase"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Eye className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">Click the eye icon to reveal your recovery phrase</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Label htmlFor="confirmation">
                Type "I understand" to confirm you've saved your recovery phrase:
              </Label>
              <Input
                id="confirmation"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="I understand"
              />
              {isConfirmationValid && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Great! Your recovery phrase is now ready. Store it in a secure location.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="qr" className="space-y-4">
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                Generate a QR code containing your encrypted recovery information. Scan with your phone to store securely.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>QR Code Export</CardTitle>
                <CardDescription>
                  Encrypted recovery data in QR format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="w-48 h-48 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-center">
                      <QrCode className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">QR Code will appear here</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={generateQRMutation.mutate}
                    disabled={generateQRMutation.isPending}
                    className="w-full"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {generateQRMutation.isPending ? "Generating..." : "Generate QR Code"}
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Image
                  </Button>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">QR Security Features:</p>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>• Encrypted with your device-specific key</li>
                      <li>• Expires after 30 days for security</li>
                      <li>• Can only be used once for recovery</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}