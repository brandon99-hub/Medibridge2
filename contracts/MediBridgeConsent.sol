// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MediBridgeConsent
 * @dev Smart contract for managing healthcare consent on Hedera
 * @notice This contract provides trustless consent management for medical records
 */
contract MediBridgeConsent {
    
    struct Consent {
        string patientDID;
        string hospitalDID;
        string recordHash;
        uint256 grantedAt;
        uint256 expiresAt;
        bool isActive;
        bool exists;
    }
    
    // Mapping: keccak256(patientDID, hospitalDID, recordHash) => Consent
    mapping(bytes32 => Consent) public consents;
    
    // Mapping: patientDID => consentId[]
    mapping(string => bytes32[]) public patientConsents;
    
    // Mapping: hospitalDID => consentId[]
    mapping(string => bytes32[]) public hospitalConsents;
    
    // Events
    event ConsentGranted(
        bytes32 indexed consentId,
        string patientDID,
        string hospitalDID,
        string recordHash,
        uint256 expiresAt
    );
    
    event ConsentRevoked(
        bytes32 indexed consentId,
        string patientDID,
        string hospitalDID,
        string recordHash
    );
    
    event ConsentExpired(
        bytes32 indexed consentId,
        string patientDID,
        string hospitalDID
    );
    
    /**
     * @dev Generate consent ID from patient DID, hospital DID, and record hash
     */
    function generateConsentId(
        string memory patientDID,
        string memory hospitalDID,
        string memory recordHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(patientDID, hospitalDID, recordHash));
    }
    
    /**
     * @dev Grant consent for a hospital to access a specific record
     * @param patientDID Patient's decentralized identifier
     * @param hospitalDID Hospital's decentralized identifier
     * @param recordHash Hash of the medical record
     * @param durationSeconds How long the consent is valid (in seconds)
     */
    function grantConsent(
        string memory patientDID,
        string memory hospitalDID,
        string memory recordHash,
        uint256 durationSeconds
    ) external returns (bytes32) {
        bytes32 consentId = generateConsentId(patientDID, hospitalDID, recordHash);
        
        // Create or update consent
        consents[consentId] = Consent({
            patientDID: patientDID,
            hospitalDID: hospitalDID,
            recordHash: recordHash,
            grantedAt: block.timestamp,
            expiresAt: block.timestamp + durationSeconds,
            isActive: true,
            exists: true
        });
        
        // Track consent for patient and hospital
        if (!_consentExists(patientConsents[patientDID], consentId)) {
            patientConsents[patientDID].push(consentId);
        }
        if (!_consentExists(hospitalConsents[hospitalDID], consentId)) {
            hospitalConsents[hospitalDID].push(consentId);
        }
        
        emit ConsentGranted(consentId, patientDID, hospitalDID, recordHash, consents[consentId].expiresAt);
        
        return consentId;
    }
    
    /**
     * @dev Revoke consent immediately
     * @param patientDID Patient's decentralized identifier
     * @param hospitalDID Hospital's decentralized identifier
     * @param recordHash Hash of the medical record
     */
    function revokeConsent(
        string memory patientDID,
        string memory hospitalDID,
        string memory recordHash
    ) external {
        bytes32 consentId = generateConsentId(patientDID, hospitalDID, recordHash);
        
        require(consents[consentId].exists, "Consent does not exist");
        require(consents[consentId].isActive, "Consent already revoked");
        
        consents[consentId].isActive = false;
        
        emit ConsentRevoked(consentId, patientDID, hospitalDID, recordHash);
    }
    
    /**
     * @dev Check if hospital has valid consent to access a record
     * @param patientDID Patient's decentralized identifier
     * @param hospitalDID Hospital's decentralized identifier
     * @param recordHash Hash of the medical record
     * @return bool True if consent is valid and not expired
     */
    function hasValidConsent(
        string memory patientDID,
        string memory hospitalDID,
        string memory recordHash
    ) external view returns (bool) {
        bytes32 consentId = generateConsentId(patientDID, hospitalDID, recordHash);
        Consent memory consent = consents[consentId];
        
        if (!consent.exists || !consent.isActive) {
            return false;
        }
        
        // Check if expired
        if (block.timestamp >= consent.expiresAt) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Get consent details
     * @param consentId The consent identifier
     * @return Consent struct with all details
     */
    function getConsent(bytes32 consentId) external view returns (Consent memory) {
        require(consents[consentId].exists, "Consent does not exist");
        return consents[consentId];
    }
    
    /**
     * @dev Get all consent IDs for a patient
     * @param patientDID Patient's decentralized identifier
     * @return Array of consent IDs
     */
    function getPatientConsents(string memory patientDID) external view returns (bytes32[] memory) {
        return patientConsents[patientDID];
    }
    
    /**
     * @dev Get all consent IDs for a hospital
     * @param hospitalDID Hospital's decentralized identifier
     * @return Array of consent IDs
     */
    function getHospitalConsents(string memory hospitalDID) external view returns (bytes32[] memory) {
        return hospitalConsents[hospitalDID];
    }
    
    /**
     * @dev Check if consent ID exists in array
     * @param consentIds Array of consent IDs
     * @param consentId Consent ID to check
     * @return bool True if exists
     */
    function _consentExists(bytes32[] memory consentIds, bytes32 consentId) private pure returns (bool) {
        for (uint i = 0; i < consentIds.length; i++) {
            if (consentIds[i] == consentId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Batch check multiple consents
     * @param patientDID Patient's decentralized identifier
     * @param hospitalDID Hospital's decentralized identifier
     * @param recordHashes Array of record hashes
     * @return Array of booleans indicating validity
     */
    function batchCheckConsent(
        string memory patientDID,
        string memory hospitalDID,
        string[] memory recordHashes
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](recordHashes.length);
        
        for (uint i = 0; i < recordHashes.length; i++) {
            bytes32 consentId = generateConsentId(patientDID, hospitalDID, recordHashes[i]);
            Consent memory consent = consents[consentId];
            
            results[i] = consent.exists && 
                         consent.isActive && 
                         block.timestamp < consent.expiresAt;
        }
        
        return results;
    }
}
