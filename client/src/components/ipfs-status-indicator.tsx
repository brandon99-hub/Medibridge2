import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Cloud, 
  CloudOff, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Server,
  Globe,
  Wifi
} from "lucide-react";

interface IPFSStatusIndicatorProps {
  recordCID?: string;
  showDetails?: boolean;
}

export default function IPFSStatusIndicator({ recordCID, showDetails = false }: IPFSStatusIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Mock IPFS status data - replace with actual API call
  const ipfsStatus = {
    overall: 'HEALTHY',
    availableNodes: 4,
    totalNodes: 5,
    availabilityRatio: 0.8,
    gateways: [
      { name: 'Web3.storage', status: 'online', responseTime: 245 },
      { name: 'Pinata', status: 'online', responseTime: 312 },
      { name: 'Infura', status: 'online', responseTime: 189 },
      { name: 'Cloudflare', status: 'offline', responseTime: null },
      { name: 'Local Hospital', status: 'online', responseTime: 45 },
    ],
    recommendations: [
      'All systems operating normally',
      'Consider adding backup gateway for Cloudflare',
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'text-green-600 border-green-600';
      case 'DEGRADED': return 'text-orange-600 border-orange-600';
      case 'CRITICAL': return 'text-red-600 border-red-600';
      default: return 'text-gray-600 border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-3 w-3" />;
      case 'DEGRADED': return <AlertTriangle className="h-3 w-3" />;
      case 'CRITICAL': return <CloudOff className="h-3 w-3" />;
      default: return <Cloud className="h-3 w-3" />;
    }
  };

  const StatusBadge = () => (
    <Badge variant="outline" className={getStatusColor(ipfsStatus.overall)}>
      {getStatusIcon(ipfsStatus.overall)}
      <span className="ml-1">IPFS {ipfsStatus.overall}</span>
    </Badge>
  );

  if (!showDetails) {
    return <StatusBadge />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1">
          <StatusBadge />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <span>IPFS Network Status</span>
          </DialogTitle>
          <DialogDescription>
            Distributed storage network health and availability
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Network Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Overall Status</span>
                <Badge className={getStatusColor(ipfsStatus.overall)}>
                  {getStatusIcon(ipfsStatus.overall)}
                  <span className="ml-1">{ipfsStatus.overall}</span>
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Available Nodes</span>
                  <span>{ipfsStatus.availableNodes}/{ipfsStatus.totalNodes}</span>
                </div>
                <Progress value={ipfsStatus.availabilityRatio * 100} className="h-2" />
                <div className="text-xs text-slate-500">
                  {Math.round(ipfsStatus.availabilityRatio * 100)}% availability
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gateway Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gateway Status</CardTitle>
              <CardDescription>Status of individual IPFS gateways</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ipfsStatus.gateways.map((gateway, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {gateway.status === 'online' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <CloudOff className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">{gateway.name}</span>
                      </div>
                      
                      {gateway.name === 'Local Hospital' && (
                        <Badge variant="secondary" className="text-xs">
                          <Server className="h-3 w-3 mr-1" />
                          Local
                        </Badge>
                      )}
                      
                      {gateway.name !== 'Local Hospital' && (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {gateway.status === 'online' ? 'Online' : 'Offline'}
                      </div>
                      {gateway.responseTime && (
                        <div className="text-xs text-slate-500">
                          {gateway.responseTime}ms
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Specific Record Status */}
          {recordCID && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Availability</CardTitle>
                <CardDescription>
                  Status for CID: <code className="text-xs bg-slate-100 px-1 rounded">{recordCID}</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Checking availability across {ipfsStatus.totalNodes} nodes...</span>
                  </div>
                  
                  <Progress value={75} className="h-2" />
                  
                  <div className="text-xs text-slate-500">
                    Record available on 4 out of 5 nodes (80% redundancy)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">System Recommendations:</p>
                <ul className="text-sm space-y-1">
                  {ipfsStatus.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Server className="h-4 w-4 mr-2" />
              Test Connectivity
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}