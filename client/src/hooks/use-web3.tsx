import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import detectEthereumProvider from "@metamask/detect-provider";

interface PatientIdentity {
  id: number;
  did: string;
  walletAddress?: string;
  publicKey: string;
  didDocument: any;
  createdAt: string;
}

interface Web3ContextType {
  // Wallet Connection
  walletAddress: string | null;
  isWalletConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  
  // Patient Identity
  patientIdentity: PatientIdentity | null;
  generatePatientIdentity: () => Promise<void>;
  
  // Medical Records
  submitRecordToIPFS: (recordData: any) => Promise<void>;
  requestRecordAccess: (patientDID: string) => Promise<any>;
  
  // Consent Management
  grantConsent: (consentData: any) => Promise<void>;
  revokeConsent: (patientDID: string, requesterDID: string) => Promise<void>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

export const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [patientIdentity, setPatientIdentity] = useState<PatientIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      const provider = await detectEthereumProvider();
      if (provider && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_accounts' 
        });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      }
    } catch (error) {
      console.error("Failed to check wallet connection:", error);
    }
  };

  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if MetaMask is installed
      const provider = await detectEthereumProvider();
      
      if (!provider) {
        throw new Error("MetaMask is not installed. Please install MetaMask browser extension and refresh the page.");
      }

      // Check if ethereum object is available
      if (!(window as any).ethereum) {
        throw new Error("MetaMask ethereum object not found. Please refresh the page and try again.");
      }

      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });

        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setError(null);
          toast({
            title: "Wallet Connected",
            description: `Connected to ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`,
          });
        } else {
          throw new Error("No accounts found. Please unlock MetaMask and try again.");
        }
      } catch (connectError: any) {
        if (connectError.code === 4001) {
          throw new Error("Connection rejected. Please approve the connection in MetaMask to continue.");
        } else if (connectError.code === -32002) {
          throw new Error("MetaMask is already processing a request. Please check MetaMask and try again.");
        } else {
          throw new Error(`Connection failed: ${connectError.message}`);
        }
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Wallet Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setPatientIdentity(null);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const generatePatientIdentityMutation = useMutation({
    mutationFn: async (walletAddress?: string) => {
      const response = await apiRequest("POST", "/api/web3/generate-patient-identity", {
        walletAddress,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setPatientIdentity(data.identity);
      toast({
        title: "Patient Identity Generated",
        description: `DID: ${data.identity.did.substring(0, 20)}...`,
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Identity Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitRecordMutation = useMutation({
    mutationFn: async (recordData: any) => {
      const response = await apiRequest("POST", "/api/web3/submit-record", recordData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Record Stored on IPFS",
        description: `IPFS Hash: ${data.ipfsHash.substring(0, 20)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/web3/patient-dashboard"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Record Storage Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (patientDID: string) => {
      const response = await apiRequest("POST", "/api/web3/request-access", {
        patientDID,
      });
      return await response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Access Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const grantConsentMutation = useMutation({
    mutationFn: async (consentData: any) => {
      const response = await apiRequest("POST", "/api/web3/grant-consent", consentData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Consent Granted",
        description: "Verifiable credential issued successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Consent Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async ({ patientDID, requesterDID }: { patientDID: string; requesterDID: string }) => {
      const response = await apiRequest("POST", "/api/web3/revoke-consent", {
        patientDID,
        requesterDID,
        patientSignature: "demo_signature", // In production, sign with wallet
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Consent Revoked",
        description: "Access permissions have been revoked",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Revocation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generatePatientIdentity = async () => {
    await generatePatientIdentityMutation.mutateAsync(walletAddress || undefined);
  };

  const submitRecordToIPFS = async (recordData: any) => {
    await submitRecordMutation.mutateAsync(recordData);
  };

  const requestRecordAccess = async (patientDID: string) => {
    return await requestAccessMutation.mutateAsync(patientDID);
  };

  const grantConsent = async (consentData: any) => {
    await grantConsentMutation.mutateAsync(consentData);
  };

  const revokeConsent = async (patientDID: string, requesterDID: string) => {
    await revokeConsentMutation.mutateAsync({ patientDID, requesterDID });
  };

  const contextValue: Web3ContextType = {
    walletAddress,
    isWalletConnected: !!walletAddress,
    connectWallet,
    disconnectWallet,
    patientIdentity,
    generatePatientIdentity,
    submitRecordToIPFS,
    requestRecordAccess,
    grantConsent,
    revokeConsent,
    isLoading: isLoading || generatePatientIdentityMutation.isPending || submitRecordMutation.isPending,
    error,
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}