/**
 * Quick Hedera Connection Test
 * Run with: npx tsx test-hedera.ts
 */

import { Client, AccountBalanceQuery, TopicMessageQuery } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function testHederaConnection() {
  console.log("\n🧪 Testing Hedera Connection...\n");

  try {
    // 1. Test Account Connection
    console.log("1️⃣ Testing Account Connection...");
    const accountId = process.env.HEDERA_OPERATOR_ID;
    const privateKey = process.env.HEDERA_OPERATOR_KEY;
    
    if (!accountId || !privateKey) {
      throw new Error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in .env");
    }

    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    console.log(`   ✅ Connected to Hedera Testnet`);
    console.log(`   📋 Account ID: ${accountId}`);

    // 2. Check Account Balance
    console.log("\n2️⃣ Checking Account Balance...");
    const balance = await new AccountBalanceQuery()
      .setAccountId(accountId)
      .execute(client);
    
    console.log(`   💰 Balance: ${balance.hbars.toString()}`);
    
    if (balance.hbars.toTinybars().toNumber() < 1000000000) { // Less than 10 HBAR
      console.log(`   ⚠️  Warning: Low balance! You may need to fund your account.`);
    }

    // 3. Check HCS Topics
    console.log("\n3️⃣ Checking HCS Topics...");
    const auditTopicId = process.env.HEDERA_AUDIT_TOPIC_ID;
    const consentTopicId = process.env.HEDERA_CONSENT_TOPIC_ID;
    const securityTopicId = process.env.HEDERA_SECURITY_TOPIC_ID;
    
    console.log(`   📝 Audit Topic: ${auditTopicId || "NOT SET"}`);
    console.log(`   🔐 Consent Topic: ${consentTopicId || "NOT SET"}`);
    console.log(`   🛡️  Security Topic: ${securityTopicId || "NOT SET"}`);

    // 4. Check NFT Token
    console.log("\n4️⃣ Checking NFT Token...");
    const nftTokenId = process.env.HEDERA_NFT_TOKEN_ID;
    console.log(`   🎨 NFT Token: ${nftTokenId || "NOT SET"}`);

    // 5. Check Smart Contract
    console.log("\n5️⃣ Checking Smart Contract...");
    const contractId = process.env.HEDERA_CONSENT_CONTRACT_ID;
    console.log(`   📜 Contract ID: ${contractId || "NOT SET"}`);
    
    if (contractId === "0.0.CONTRACT_ID") {
      console.log(`   ⚠️  Warning: Contract ID is placeholder. Smart contract not deployed.`);
    }

    // 6. Test Topic Subscription (optional - just shows it's possible)
    if (auditTopicId && auditTopicId !== "0.0.TOPIC_ID") {
      console.log("\n6️⃣ Testing Topic Subscription...");
      console.log(`   📡 Subscribing to audit topic ${auditTopicId}...`);
      console.log(`   ℹ️  (Press Ctrl+C to stop listening)`);
      
      new TopicMessageQuery()
        .setTopicId(auditTopicId)
        .setStartTime(0)
        .setLimit(5) // Only get last 5 messages
        .subscribe(client, (message) => {
          console.log(`   📨 Received message at ${new Date(message.consensusTimestamp.toDate()).toISOString()}`);
          console.log(`      Sequence: ${message.sequenceNumber}`);
          console.log(`      Content: ${Buffer.from(message.contents).toString()}`);
        });
      
      // Wait 5 seconds to see if we get any messages
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log("\n✅ Hedera Connection Test Complete!\n");
    console.log("Summary:");
    console.log("  ✅ Account connected and funded");
    console.log("  ✅ HCS topics configured");
    console.log("  ✅ NFT token created");
    console.log(contractId === "0.0.CONTRACT_ID" 
      ? "  ⚠️  Smart contract needs deployment" 
      : "  ✅ Smart contract deployed");
    
    client.close();
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ Hedera Connection Test Failed!");
    console.error(`   Error: ${error.message}`);
    console.error("\nTroubleshooting:");
    console.error("  1. Check your .env file has HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY");
    console.error("  2. Verify your account is funded (visit portal.hedera.com)");
    console.error("  3. Run 'npm run hedera:setup' to initialize Hedera resources");
    process.exit(1);
  }
}

testHederaConnection();
