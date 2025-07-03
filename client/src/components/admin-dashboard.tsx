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
  Lock,
  User,
  Database,
  Key,
  Globe,
  UserPlus
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import EnhancedStaffManagement from "@/components/enhanced-staff-management";

// ZK-MedPass Analytics Component
function ZKMedPassAnalytics() {
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ['/api/zk-medpass/analytics'],
    queryFn: async () => apiRequest("GET", "/api/zk-medpass/analytics").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const analyticsData = analytics?.analytics || {
    totalProofs: 0,
    activeProofs: 0,
    expiringProofs: 0,
    proofTypes: {
      hiv: 0,
      vaccination: 0,
      insurance: 0
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ZK Proofs</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.totalProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">All time proofs issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Proofs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.activeProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">Currently valid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.expiringProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">Next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">USSD Sessions</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : "N/A"}
            </div>
            <p className="text-xs text-slate-600">Today's sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Proof Types Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Proof Types Distribution</CardTitle>
          <CardDescription>Breakdown of ZK proofs by type (no PII shown)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.hiv}
              </div>
              <div className="text-sm text-slate-600">HIV-Negative Proofs</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.vaccination}
              </div>
              <div className="text-sm text-slate-600">Vaccination Proofs</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.insurance}
              </div>
              <div className="text-sm text-slate-600">Insurance Proofs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>ZK-MedPass Quick Actions</CardTitle>
          <CardDescription>Manage ZK-MedPass system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <Shield className="h-6 w-6" />
              <span>View Proof Logs</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <Activity className="h-6 w-6" />
              <span>USSD Session Stats</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <TrendingUp className="h-6 w-6" />
              <span>Export Analytics</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <Globe className="h-6 w-6" />
              <span>Africa's Talking Status</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [, navigate] = useLocation();

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

  // Use real VC Issuance Stats and Consent Trends from backend
  const vcIssuanceStats = auditSummary?.summary?.vcIssuanceStats || {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    avgResponseTime: null,
  };
  const consentTrends = auditSummary?.summary?.consentTrends || {
    grantRate: null,
    avgProcessingTime: null,
    revocationRate: null,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back to Dashboard Button */}
        <div className="flex items-start">
          <button
            className="mb-4 flex items-center px-4 py-2 rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-200"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
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
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="zk-medpass">ZK-MedPass</TabsTrigger>
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
                        <div className="mb-2 text-slate-700 text-sm">{
                          violation.description ||
                          (violation.details
                            ? typeof violation.details === 'object'
                              ? JSON.stringify(violation.details)
                              : violation.details
                            : "No details provided.")
                        }</div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">ID: {violation.id}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-200 hover:bg-green-50"
                            onClick={async () => {
                              await apiRequest("POST", `/api/admin/security-violations/${violation.id}/resolve`);
                              // Optionally show a toast
                              // Refetch the violations list
                              window.location.reload(); // Or use a better state update if available
                            }}
                          >
                            Mark as Resolved
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
                    <span className="font-bold text-green-600">{vcIssuanceStats.avgResponseTime || '--'}</span>
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
                      <span className="text-lg font-bold text-green-600">{consentTrends.grantRate || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avg Processing Time</span>
                      <span className="text-lg font-bold">{consentTrends.avgProcessingTime || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Revocation Rate</span>
                      <span className="text-lg font-bold text-orange-600">{consentTrends.revocationRate || '--'}</span>
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

          {/* Recent Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Recent System Activity</span>
                </CardTitle>
                <CardDescription>
                  Latest audit events and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAuditSummary && (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoadingAuditSummary && (!auditSummary?.summary?.recentActivity || auditSummary.summary.recentActivity.length === 0) && (
                  <Alert>
                    <Activity className="h-4 w-4" />
                    <AlertDescription>
                      No recent activity found. The system may be idle or audit logging may be disabled.
                    </AlertDescription>
                  </Alert>
                )}
                {!isLoadingAuditSummary && auditSummary?.summary?.recentActivity && auditSummary.summary.recentActivity.length > 0 && (
                  <div className="space-y-4">
                    {auditSummary.summary.recentActivity.map((event: any, index: number) => (
                      <div key={event.id || index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={event.outcome === 'SUCCESS' ? 'default' : 
                                     event.outcome === 'FAILURE' ? 'destructive' : 'secondary'}
                            >
                              {event.outcome}
                            </Badge>
                            <span className="font-medium">{event.eventType}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mb-2 text-slate-700 text-sm">
                          <div className="flex items-center space-x-2 mb-1">
                            <User className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              Actor: {event.actorType} ({event.actorId})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Database className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              Target: {event.targetType} ({event.targetId})
                            </span>
                          </div>
                          {event.metadata && (
                            <div className="flex items-center space-x-2">
                              <Key className="h-3 w-3 text-slate-500" />
                              <span className="text-xs text-slate-500">
                                Details: {JSON.stringify(event.metadata)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">ID: {event.id}</span>
                          <Badge variant="outline" className="text-xs">
                            {event.severity || 'info'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Management Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-green-600" />
                  <span>Staff Management</span>
                </CardTitle>
                <CardDescription>
                  Manage hospital staff accounts and invitations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Staff Management</h3>
                  <p className="text-gray-600 mb-6">
                    Use the enhanced staff management interface to invite and manage staff members.
                  </p>
                  <Button 
                    onClick={() => setShowStaffModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Open Staff Management
                  </Button>
                  <EnhancedStaffManagement
                    isOpen={showStaffModal}
                    onClose={() => setShowStaffModal(false)}
                    hospitalId={auditSummary?.summary?.hospitalId || ""}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ZK-MedPass Tab */}
          <TabsContent value="zk-medpass" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span>ZK-MedPass Analytics</span>
                </CardTitle>
                <CardDescription>
                  Privacy-respecting analytics for ZK proof usage and health verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ZKMedPassAnalytics />
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
                    Security testing validates system defenses using controlled scenarios. Only run in development/testing environments.
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