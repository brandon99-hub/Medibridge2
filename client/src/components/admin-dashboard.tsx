import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  FileText,
  TrendingUp,
  Eye,
  Lock
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

export default function AdminDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");

  // Fetch security audit summary
  const { data: auditSummary, isLoading: isLoadingAuditSummary } = useQuery<any>({
    queryKey: ['/api/security/audit-summary'],
    queryFn: async () => apiRequest("GET", "/api/security/audit-summary").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent security violations
  const { data: securityViolationsData, isLoading: isLoadingViolations } = useQuery<any>({
    queryKey: ['/api/admin/security-violations', { resolved: false, limit: 5 }],
    queryFn: async () => apiRequest("GET", "/api/admin/security-violations?resolved=false&limit=5").then(res => res.json()),
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  const recentViolations = securityViolationsData?.violations || [];

  // Use auditSummary for securityMetrics if available
  const securityMetrics = auditSummary?.summary?.securityMetrics || {
    successfulLogins: 0,
    failedLogins: 0,
    unauthorizedAttempts: 0,
    recordAccesses: 0,
  };
  const overviewMetrics = auditSummary?.summary || {
    totalEvents: 0,
    securityViolations: 0, // This is unresolved violations count
    consentEvents: 0,
  };


  const vcIssuanceStats = {
    today: 23,
    thisWeek: 156,
    thisMonth: 678,
    avgResponseTime: "1.2s",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Security & Audit Dashboard</h1>
            <p className="text-slate-600">Real-time monitoring of MediBridge security events</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              System Healthy
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Security Events</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingAuditSummary ? <Skeleton className="h-8 w-1/2" /> : overviewMetrics.totalEvents?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-slate-600">Total audit events</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved Violations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                 {isLoadingAuditSummary ? <Skeleton className="h-8 w-1/4" /> : overviewMetrics.securityViolations || 0}
              </div>
              <p className="text-xs text-slate-600">Requires attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consent Events</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoadingAuditSummary ? <Skeleton className="h-8 w-1/4" /> : overviewMetrics.consentEvents || 0}
              </div>
              <p className="text-xs text-slate-600">Consent actions logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Record Accesses</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {isLoadingAuditSummary ? <Skeleton className="h-8 w-1/4" /> : securityMetrics.recordAccesses || 0}
              </div>
              <p className="text-xs text-slate-600">Authorized accesses</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="violations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="violations">Security Violations</TabsTrigger>
            <TabsTrigger value="credentials">VC Monitoring</TabsTrigger>
            <TabsTrigger value="access">Access Patterns</TabsTrigger>
            <TabsTrigger value="testing">Security Testing</TabsTrigger>
          </TabsList>

          {/* Security Violations Tab */}
          <TabsContent value="violations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Recent Security Violations</span>
                </CardTitle>
                <CardDescription>
                  Suspicious activities and security incidents requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingViolations && (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoadingViolations && recentViolations.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No unresolved security violations found. System is looking good!
                    </AlertDescription>
                  </Alert>
                )}
                {!isLoadingViolations && recentViolations.length > 0 && (
                  <div className="space-y-4">
                    {recentViolations.map((violation: any) => ( // Use any for now, define type later
                      <div key={violation.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={violation.severity === 'high' || violation.severity === 'critical' ? 'destructive' :
                                     violation.severity === 'medium' ? 'default' : 'secondary'}
                            >
                              {violation.severity?.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{violation.violationType}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {new Date(violation.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">
                          {violation.details?.error || violation.details?.message || JSON.stringify(violation.details)}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            Actor ID: {violation.actorId || 'N/A'}
                            {violation.ipAddress && ` • IP: ${violation.ipAddress}`}
                          </span>
                          <Button
                            size="sm"
                            variant={violation.resolved ? "outline" : "default"}
                            disabled={violation.resolved}
                            // TODO: Add onClick handler to mark as resolved or investigate
                          >
                            {violation.resolved ? "Resolved" : "Investigate"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VC Monitoring Tab */}
          <TabsContent value="credentials" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span>VC Issuance Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Today</span>
                    <span className="font-bold">{vcIssuanceStats.today} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">This Week</span>
                    <span className="font-bold">{vcIssuanceStats.thisWeek} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">This Month</span>
                    <span className="font-bold">{vcIssuanceStats.thisMonth} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Avg Response Time</span>
                    <span className="font-bold text-green-600">{vcIssuanceStats.avgResponseTime}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Consent Trends</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Consent Grant Rate</span>
                      <span className="text-lg font-bold text-green-600">94.2%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avg Processing Time</span>
                      <span className="text-lg font-bold">2.3 min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Revocation Rate</span>
                      <span className="text-lg font-bold text-orange-600">1.8%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Access Patterns Tab */}
          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <span>Access Pattern Analysis</span>
                </CardTitle>
                <CardDescription>
                  Monitor unusual access patterns and potential security concerns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {securityMetrics.successfulLogins}
                    </div>
                    <div className="text-sm text-slate-600">Successful Logins</div>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <Lock className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">
                      {securityMetrics.failedLogins}
                    </div>
                    <div className="text-sm text-slate-600">Failed Logins</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600">
                      {securityMetrics.unauthorizedAttempts}
                    </div>
                    <div className="text-sm text-slate-600">Unauthorized Attempts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <span>Red Team Simulation</span>
                </CardTitle>
                <CardDescription>
                  Run security tests to validate system defenses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Security testing will simulate real attack scenarios. Only run in development/testing environments.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <Lock className="h-6 w-6" />
                    <span>Test Unauthorized Access</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <Shield className="h-6 w-6" />
                    <span>Test Credential Verification</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <Activity className="h-6 w-6" />
                    <span>Test Rate Limiting</span>
                  </Button>
                  
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <FileText className="h-6 w-6" />
                    <span>Generate Security Report</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}