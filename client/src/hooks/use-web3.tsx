import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import detectEthereumProvider from "@metamask/detect-provider";
import { ethers } from "ethers"; // Moved ethers import here
import { useCsrf } from "@/hooks/use-csrf";

// Helper to get signer - Moved to top level of module
const getSigner = async () => {
  const eth = (window as any).ethereum;
  if (!eth) {
    throw new Error("MetaMask is not available. Please install MetaMask and try again.");
  }
  const provider = new ethers.BrowserProvider(eth);
  const signer = await provider.getSigner();
  if (!signer.address) { // Check if signer has an address, meaning it's unlocked and connected
    throw new Error("MetaMask is locked or not connected. Please unlock and connect your wallet.");
  }
  return signer;
};

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
  revokeConsent: (patientDID: string, requesterId: string) => Promise<void>;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

export const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { apiRequestWithCsrf } = useCsrf();
  
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
      const response = await apiRequestWithCsrf("POST", "/api/web3/generate-patient-identity", {
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
      const response = await apiRequestWithCsrf("POST", "/api/web3/submit-record", recordData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Record Stored with Triple Redundancy",
        description: `IPFS: ${data.storage?.ipfsCid?.substring(0, 20)}... | Filecoin: ${data.storage?.filecoinCid?.substring(0, 20)}...`,
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
      const response = await apiRequestWithCsrf("POST", "/api/web3/request-access", {
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
    mutationFn: async (consentData: {
      patientDID: string;
      requesterId: string;
      contentHashes: string[];
      consentType: string;
      patientSignature: string; // Signature will be added before calling this
    }) => {
      const response = await apiRequestWithCsrf("POST", "/api/web3/grant-consent", consentData);
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
    mutationFn: async ({ patientDID, requesterId, patientSignature }: { patientDID: string; requesterId: string; patientSignature: string }) => {
      const response = await apiRequestWithCsrf("POST", "/api/web3/revoke-consent", {
        patientDID,
        requesterId,
        patientSignature: patientSignature,
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
    return await submitRecordMutation.mutateAsync(recordData);
  };

  const requestRecordAccess = async (patientDID: string) => {
    return await requestAccessMutation.mutateAsync(patientDID);
  };

  const grantConsent = async (consentData: {
    patientDID: string;
    requesterId: string;
    contentHashes: string[];
    consentType: string;
  }) => {
    if (!walletAddress || !patientIdentity || patientIdentity.did !== consentData.patientDID) {
      throw new Error("Wallet not connected or patientDID mismatch for signing consent.");
    }
    try {
      setIsLoading(true);
      const signer = await getSigner();
      // Ensure the signer's address matches the connected walletAddress to prevent account mismatch
      if ((await signer.getAddress()).toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("MetaMask account mismatch. Please ensure the correct account is selected.");
      }

      const messageToSign = `I, ${consentData.patientDID}, authorize granting ${consentData.consentType} consent to ${consentData.requesterId} for the following content hashes: ${consentData.contentHashes.join(', ')}. Timestamp: ${Date.now()}`;

      const signature = await signer.signMessage(messageToSign);

      await grantConsentMutation.mutateAsync({
        ...consentData,
        patientSignature: signature,
      });
    } catch (e: any) {
      toast({ title: "Consent Signing Failed", description: e.message, variant: "destructive" });
      throw e; // Re-throw to be caught by component if needed
    } finally {
      setIsLoading(false);
    }
  };

  const revokeConsent = async (patientDID: string, requesterId: string) => {
    if (!walletAddress || !patientIdentity || patientIdentity.did !== patientDID) {
      throw new Error("Wallet not connected or patientDID mismatch for signing revocation.");
    }
    try {
      setIsLoading(true);
      const signer = await getSigner();
      if ((await signer.getAddress()).toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("MetaMask account mismatch. Please ensure the correct account is selected.");
      }

      const messageToSign = `I, ${patientDID}, authorize revoking any consent previously granted to ${requesterId}. Timestamp: ${Date.now()}`;

      const signature = await signer.signMessage(messageToSign);

      await revokeConsentMutation.mutateAsync({
        patientDID,
        requesterId,
        patientSignature: signature,
      });
    } catch (e: any) {
      toast({ title: "Consent Revocation Failed", description: e.message, variant: "destructive" });
      throw e; // Re-throw to be caught by component if needed
    } finally {
      setIsLoading(false);
    }
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
  const { apiRequestWithCsrf } = useCsrf();
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}