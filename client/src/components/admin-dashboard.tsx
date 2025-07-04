import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  UserPlus,
  Gauge,
  Zap,
  Target,
  BarChart3,
  Home
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

const SIDEBAR_TABS = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "violations", label: "Security Violations", icon: AlertTriangle },
  { key: "credentials", label: "VC Monitoring", icon: Shield },
  { key: "access", label: "Access Patterns", icon: Eye },
  { key: "activity", label: "Recent Activity", icon: Activity },
  { key: "rate-limits", label: "Rate Limits", icon: Gauge },
  { key: "staff", label: "Staff Management", icon: UserPlus },
  { key: "zk-medpass", label: "ZK-MedPass", icon: BarChart3 },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
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

  // Fetch rate limiting statistics
  const { data: rateLimitStats, isLoading: isLoadingRateLimits } = useQuery<any>({
    queryKey: ['/api/rate-limits/stats'],
    queryFn: async () => apiRequest("GET", "/api/rate-limits/stats").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg min-h-screen flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">MediBridge</h1>
              <p className="text-sm text-slate-600">Admin Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {SIDEBAR_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                activeTab === tab.key
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-sm font-medium text-green-900">System Healthy</div>
              <div className="text-xs text-green-700">All systems operational</div>
            </div>
          </div>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            className="flex items-center px-4 py-2 rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-200"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
        {/* Section Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Home className="h-5 w-5 text-blue-600" />
                  <span>System Overview</span>
                </CardTitle>
                <CardDescription>
                  Welcome to the MediBridge Security & Audit Dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Quick Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-slate-700">Successful Logins</span>
                        <span className="font-bold text-blue-600">{securityMetrics.successfulLogins}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="text-slate-700">Failed Logins</span>
                        <span className="font-bold text-red-600">{securityMetrics.failedLogins}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-slate-700">VCs Issued Today</span>
                        <span className="font-bold text-green-600">{vcIssuanceStats.today}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">System Health</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
                          <div className="font-medium text-green-900">Rate Limiting</div>
                          <div className="text-sm text-green-700">Active and protecting all endpoints</div>
                        </div>
          </div>
                      <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-blue-900">Encryption</div>
                          <div className="text-sm text-blue-700">AES-256-GCM protecting all data</div>
          </div>
        </div>
                      <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                        <Activity className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="font-medium text-purple-900">Audit Logging</div>
                          <div className="text-sm text-purple-700">Comprehensive event tracking</div>
                        </div>
              </div>
              </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        {activeTab === "violations" && (
          <div className="space-y-6">
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
                    {recentViolations.map((violation: any) => (
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
                              window.location.reload();
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
          </div>
        )}
        {activeTab === "credentials" && (
          <div className="space-y-6">
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
        )}
        {activeTab === "access" && (
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
        )}
        {activeTab === "activity" && (
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
        )}
        {activeTab === "rate-limits" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="h-5 w-5 text-blue-600" />
                <span>Rate Limiting Dashboard</span>
              </CardTitle>
              <CardDescription>
                Monitor API rate limits and security thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRateLimits && (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              )}
              {!isLoadingRateLimits && rateLimitStats?.stats && (
                <div className="space-y-6">
                  {/* Rate Limit Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Gauge className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600">
                        {Object.keys(rateLimitStats.stats.limits).length}
                      </div>
                      <div className="text-sm text-slate-600">Active Rate Limits</div>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">
                        {rateLimitStats.stats.limits.AUTH?.max || 0}
                      </div>
                      <div className="text-sm text-slate-600">Auth Attempts/15min</div>
                    </div>
                    
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <Target className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-orange-600">
                        {rateLimitStats.stats.limits.EMERGENCY?.max || 0}
                      </div>
                      <div className="text-sm text-slate-600">Emergency Req/Hour</div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-600">
                        {rateLimitStats.stats.limits.MEDICAL_RECORDS?.max || 0}
                      </div>
                      <div className="text-sm text-slate-600">Record Req/5min</div>
                    </div>
                  </div>

                  {/* Rate Limit Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Rate Limit Configuration</CardTitle>
                        <CardDescription>Current rate limiting settings by endpoint type</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {Object.entries(rateLimitStats.stats.limits).map(([key, config]: [string, any]) => (
                            <div key={key} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-slate-900">{key}</span>
                                <Badge variant="outline" className="text-xs">
                                  {config.max} req/{Math.round(config.windowMs / 60000)}min
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">
                                {rateLimitStats.stats.description[key] || 'No description available'}
                              </p>
                              <div className="text-xs text-slate-500">
                                Window: {Math.round(config.windowMs / 1000)}s | 
                                Limit: {config.max} requests
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Security Insights</CardTitle>
                        <CardDescription>Rate limiting security analysis</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <div className="font-medium text-green-900">Brute Force Protection</div>
                              <div className="text-sm text-green-700">
                                Authentication limited to {rateLimitStats.stats.limits.AUTH?.max || 0} attempts per 15 minutes
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium text-blue-900">Sensitive Data Protection</div>
                              <div className="text-sm text-blue-700">
                                Medical records access limited to {rateLimitStats.stats.limits.MEDICAL_RECORDS?.max || 0} requests per 5 minutes
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <div>
                              <div className="font-medium text-orange-900">Emergency Access Control</div>
                              <div className="text-sm text-orange-700">
                                Emergency requests limited to {rateLimitStats.stats.limits.EMERGENCY?.max || 0} per hour
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                            <Zap className="h-5 w-5 text-purple-600" />
                            <div>
                              <div className="font-medium text-purple-900">OTP Spam Prevention</div>
                              <div className="text-sm text-purple-700">
                                OTP requests limited to {rateLimitStats.stats.limits.OTP?.max || 0} per 10 minutes
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Rate Limit Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Rate Limit Status</CardTitle>
                      <CardDescription>Current system status and recommendations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                          <div className="text-lg font-bold text-green-600">Active</div>
                          <div className="text-sm text-slate-600">Rate limiting is enabled</div>
                        </div>
                        
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <div className="text-lg font-bold text-blue-600">Monitored</div>
                          <div className="text-sm text-slate-600">Violations are logged</div>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <div className="text-lg font-bold text-purple-600">Protected</div>
                          <div className="text-sm text-slate-600">All endpoints secured</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              {!isLoadingRateLimits && !rateLimitStats?.stats && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Rate limiting statistics are not available. The rate limiting service may not be properly configured.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
        {activeTab === "staff" && (
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
        )}
        {activeTab === "zk-medpass" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
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
        )}
      </main>
    </div>
  );
}