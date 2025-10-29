/**
 * Deploy MediBridge Consent Smart Contract to Hedera
 * Run with: npx tsx deploy-consent-contract.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  ContractCreateFlow,
  ContractFunctionParameters,
  Hbar,
  FileCreateTransaction,
  FileAppendTransaction,
  ContractCreateTransaction,
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function deployConsentContract() {
  console.log("\n🚀 Deploying MediBridge Consent Contract to Hedera...\n");

  try {
    // 1. Setup Hedera Client
    console.log("1️⃣ Setting up Hedera client...");
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    console.log(`   ✅ Connected as ${operatorId.toString()}\n`);

    // 2. Read compiled contract bytecode
    console.log("2️⃣ Reading contract bytecode...");
    const contractPath = path.join(__dirname, "contracts", "MediBridgeConsent.sol");
    
    // Check if we have compiled bytecode
    const binPath = path.join(__dirname, "contracts", "MediBridgeConsent.bin");
    
    if (!fs.existsSync(binPath)) {
      console.log("   ⚠️  Bytecode not found. You need to compile the contract first.");
      console.log("\n📝 To compile the contract:");
      console.log("   1. Open Remix IDE (https://remix.ethereum.org)");
      console.log("   2. Create a new file 'MediBridgeConsent.sol'");
      console.log("   3. Copy the contract code from contracts/MediBridgeConsent.sol");
      console.log("   4. Compile with Solidity 0.8.20");
      console.log("   5. Download the bytecode (.bin file)");
      console.log("   6. Save it as contracts/MediBridgeConsent.bin");
      console.log("\n   Then run this script again.\n");
      process.exit(1);
    }

    const bytecode = fs.readFileSync(binPath).toString().trim();
    console.log(`   ✅ Bytecode loaded (${bytecode.length} bytes)\n`);

    // 3. Upload contract bytecode to Hedera File Service
    console.log("3️⃣ Uploading bytecode to Hedera File Service...");
    
    // Create file to store bytecode
    const fileCreateTx = new FileCreateTransaction()
      .setKeys([operatorKey])
      .setContents(bytecode.substring(0, 4096)) // First chunk
      .setMaxTransactionFee(new Hbar(2));

    const fileCreateSubmit = await fileCreateTx.execute(client);
    const fileCreateRx = await fileCreateSubmit.getReceipt(client);
    const bytecodeFileId = fileCreateRx.fileId;

    console.log(`   ✅ File created: ${bytecodeFileId?.toString()}`);

    // Append remaining bytecode if needed
    if (bytecode.length > 4096) {
      console.log("   📎 Appending remaining bytecode...");
      for (let i = 4096; i < bytecode.length; i += 4096) {
        const chunk = bytecode.substring(i, Math.min(i + 4096, bytecode.length));
        const fileAppendTx = new FileAppendTransaction()
          .setFileId(bytecodeFileId!)
          .setContents(chunk)
          .setMaxTransactionFee(new Hbar(2));

        await fileAppendTx.execute(client);
      }
      console.log("   ✅ Bytecode fully uploaded");
    }
    console.log();

    // 4. Deploy the contract
    console.log("4️⃣ Deploying contract...");
    console.log("   ⚠️  Large contract detected - using maximum gas...");
    console.log("   ⏳ This may take 60-90 seconds...");
    const contractCreateTx = new ContractCreateTransaction()
      .setBytecodeFileId(bytecodeFileId!)
      .setGas(15000000) // Hedera's absolute maximum gas limit
      .setConstructorParameters(new ContractFunctionParameters()) // No constructor params
      .setMaxTransactionFee(new Hbar(100));

    const contractCreateSubmit = await contractCreateTx.execute(client);
    const contractCreateRx = await contractCreateSubmit.getReceipt(client);
    const contractId = contractCreateRx.contractId;

    console.log(`   ✅ Contract deployed: ${contractId?.toString()}\n`);

    // 5. Update .env file
    console.log("5️⃣ Updating .env file...");
    const envPath = path.join(__dirname, ".env");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Replace or add HEDERA_CONSENT_CONTRACT_ID
    if (envContent.includes("HEDERA_CONSENT_CONTRACT_ID=")) {
      envContent = envContent.replace(
        /HEDERA_CONSENT_CONTRACT_ID=.*/,
        `HEDERA_CONSENT_CONTRACT_ID=${contractId?.toString()}`
      );
    } else {
      envContent += `\nHEDERA_CONSENT_CONTRACT_ID=${contractId?.toString()}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("   ✅ .env file updated\n");

    // 6. Summary
    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 CONTRACT DEPLOYMENT SUCCESSFUL!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n📋 Contract Details:`);
    console.log(`   Contract ID: ${contractId?.toString()}`);
    console.log(`   Bytecode File: ${bytecodeFileId?.toString()}`);
    console.log(`   Network: Hedera Testnet`);
    console.log(`   Gas Used: 100,000`);
    console.log(`\n🔗 View on HashScan:`);
    console.log(`   https://hashscan.io/testnet/contract/${contractId?.toString()}`);
    console.log(`\n✅ Your .env has been updated with the contract ID.`);
    console.log(`   Restart your server to use the deployed contract.\n`);

    client.close();
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ Deployment Failed!");
    console.error(`   Error: ${error.message}`);
    console.error("\nTroubleshooting:");
    console.error("  1. Ensure you have compiled the contract and saved the .bin file");
    console.error("  2. Check your Hedera account has sufficient balance (>20 HBAR)");
    console.error("  3. Verify HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env");
    process.exit(1);
  }
}

deployConsentContract();
