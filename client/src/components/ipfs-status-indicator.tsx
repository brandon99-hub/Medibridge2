import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Activity
} from "lucide-react";

interface IPFSStatusIndicatorProps {
  cid?: string;
  showDetails?: boolean;
}

export default function IPFSStatusIndicator({ cid, showDetails = false }: IPFSStatusIndicatorProps) {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  // Fetch real IPFS status from API
  const { data: ipfsStatus, isLoading, refetch } = useQuery({
    queryKey: ['ipfs-status', cid],
    queryFn: async () => {
      if (!cid) return null;
      const response = await apiRequest("GET", `/api/ipfs/status?cid=${cid}`);
      return response.json();
    },
    enabled: !!cid,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = () => {
    setLastChecked(new Date());
    refetch();
  };

  if (!cid) {
    return (
      <Badge variant="outline" className="text-slate-500">
        <Database className="h-3 w-3 mr-1" />
        No CID
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-slate-500">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (!ipfsStatus) {
    return (
      <Badge variant="destructive">
        <WifiOff className="h-3 w-3 mr-1" />
        Unavailable
      </Badge>
    );
  }

  const { healthStatus, availableNodes, totalNodes, availabilityRatio } = ipfsStatus;

  const getStatusColor = () => {
    switch (healthStatus) {
      case 'HEALTHY': return 'default';
      case 'DEGRADED': return 'secondary';
      case 'CRITICAL': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = () => {
    switch (healthStatus) {
      case 'HEALTHY': return <CheckCircle className="h-3 w-3" />;
      case 'DEGRADED': return <AlertTriangle className="h-3 w-3" />;
      case 'CRITICAL': return <WifiOff className="h-3 w-3" />;
      default: return <Database className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Badge variant={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">{healthStatus}</span>
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

      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>IPFS Status Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Availability:</span>
                <div className="font-medium">
                  {availableNodes}/{totalNodes} nodes
                </div>
              </div>
              <div>
                <span className="text-slate-600">Ratio:</span>
                <div className="font-medium">
                  {(availabilityRatio * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  availabilityRatio >= 0.8 ? 'bg-green-500' :
                  availabilityRatio >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${availabilityRatio * 100}%` }}
              />
            </div>

            <div className="text-xs text-slate-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>

            {ipfsStatus.recommendations && ipfsStatus.recommendations.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="text-sm">
                    <strong>Recommendations:</strong>
                    <ul className="mt-1 space-y-1">
                      {ipfsStatus.recommendations.map((rec: string, index: number) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}