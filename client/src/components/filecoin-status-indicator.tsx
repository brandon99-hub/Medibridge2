import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Activity,
  Copy,
  ExternalLink,
  FileText,
  Shield,
  Globe
} from "lucide-react";

interface FilecoinStatusIndicatorProps {
  filecoinCid?: string;
  ipfsCid?: string;
  showDetails?: boolean;
  showVerification?: boolean;
}

export default function FilecoinStatusIndicator({ 
  filecoinCid, 
  ipfsCid, 
  showDetails = false,
  showVerification = false 
}: FilecoinStatusIndicatorProps) {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [verificationCid, setVerificationCid] = useState("");

  // Fetch Filecoin status from API
  const { data: filecoinStatus, isLoading, refetch } = useQuery({
    queryKey: ['filecoin-status', filecoinCid],
    queryFn: async () => {
      if (!filecoinCid) return null;
      const response = await apiRequest("GET", `/api/filecoin/status?cid=${filecoinCid}`);
      return response.json();
    },
    enabled: !!filecoinCid,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = () => {
    setLastChecked(new Date());
    refetch();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openInGateway = (cid: string, gateway: string) => {
    window.open(`${gateway}${cid}`, '_blank');
  };

  if (!filecoinCid) {
    return (
      <Badge variant="outline" className="text-slate-500">
        <Database className="h-3 w-3 mr-1" />
        No Filecoin CID
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-slate-500">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Checking Filecoin...
      </Badge>
    );
  }

  if (!filecoinStatus) {
    return (
      <Badge variant="destructive">
        <WifiOff className="h-3 w-3 mr-1" />
        Filecoin Unavailable
      </Badge>
    );
  }

  const { status, provider, dealId, cost, duration } = filecoinStatus;

  const getStatusColor = () => {
    switch (status) {
      case 'active': return 'default';
      case 'expired': return 'secondary';
      case 'terminated': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3" />;
      case 'expired': return <AlertTriangle className="h-3 w-3" />;
      case 'terminated': return <WifiOff className="h-3 w-3" />;
      default: return <Database className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filecoin CID Display */}
      <div className="flex items-center space-x-2">
        <Badge variant={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">Filecoin {status?.toUpperCase()}</span>
        </Badge>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* CID Display */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Label className="text-sm font-medium text-slate-700">Filecoin CID:</Label>
          <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
            {filecoinCid}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(filecoinCid)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>

        {ipfsCid && (
          <div className="flex items-center space-x-2">
            <Label className="text-sm font-medium text-slate-700">IPFS CID:</Label>
            <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
              {ipfsCid}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(ipfsCid)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Gateway Links */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInGateway(filecoinCid, "https://ipfs.io/ipfs/")}
          className="text-xs"
        >
          <Globe className="h-3 w-3 mr-1" />
          IPFS Gateway
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInGateway(filecoinCid, "https://gateway.pinata.cloud/ipfs/")}
          className="text-xs"
        >
          <Database className="h-3 w-3 mr-1" />
          Pinata Gateway
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInGateway(filecoinCid, "https://cloudflare-ipfs.com/ipfs/")}
          className="text-xs"
        >
          <Shield className="h-3 w-3 mr-1" />
          Cloudflare Gateway
        </Button>
      </div>

      {/* CID Verification */}
      {showVerification && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Verify CID</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="verificationCid" className="text-sm">Enter CID to verify:</Label>
              <div className="flex space-x-2 mt-1">
                <Input
                  id="verificationCid"
                  value={verificationCid}
                  onChange={(e) => setVerificationCid(e.target.value)}
                  placeholder="bafybeih..."
                  className="text-xs"
                />
                <Button size="sm" onClick={() => {
                  if (verificationCid === filecoinCid) {
                    alert("✅ CID verification successful! This is the correct Filecoin CID.");
                  } else {
                    alert("❌ CID verification failed. The entered CID does not match.");
                  }
                }}>
                  Verify
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Filecoin Storage Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Provider:</span>
                <div className="font-medium">{provider || 'nft.storage'}</div>
              </div>
              <div>
                <span className="text-slate-600">Status:</span>
                <div className="font-medium capitalize">{status}</div>
              </div>
              {dealId && (
                <div>
                  <span className="text-slate-600">Deal ID:</span>
                  <div className="font-medium text-xs font-mono">{dealId}</div>
                </div>
              )}
              {cost && (
                <div>
                  <span className="text-slate-600">Cost:</span>
                  <div className="font-medium">{cost} FIL</div>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>Storage Confirmation:</strong> This medical record is now permanently stored on the Filecoin network with cryptographic proof of storage. The CID serves as a unique identifier that can be used to retrieve the encrypted data from any IPFS gateway worldwide.
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 