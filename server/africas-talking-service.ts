// Africa's Talking Service - Voice, Airtime, USSD
// This is a NEW service that doesn't modify existing functionality

import { db } from './db';
import { ussdSessions, clinicCodes, ussdAnalytics } from '../shared/schema';
import { eq } from 'drizzle-orm';

const africasTalkingApiKey = process.env.AFRICAS_TALKING_API_KEY;
const africasTalkingUsername = process.env.AFRICAS_TALKING_USERNAME;

const MENUS = {
  main: {
    en: `CON Welcome to MediBridge\n1. Prove Health Status\n2. Emergency Proof\n3. My Proofs\n4. Give Feedback (Get Airtime)\n5. Help & Language`,
    sw: `CON Karibu MediBridge\n1. Thibitisha Hali ya Afya\n2. Uthibitisho wa Dharura\n3. Uthibitisho Wangu\n4. Toa Maoni (Pata Airtime)\n5. Msaada & Lugha`
  },
  language: {
    en: `CON Choose your preferred language:\n1. English\n2. Kiswahili`,
    sw: `CON Chagua lugha unayopendelea:\n1. Kiingereza\n2. Kiswahili`
  },
  languageSaved: {
    en: `CON Language preference saved.\n\nWelcome to MediBridge\n1. Prove Health Status\n2. Emergency Proof\n3. Renew My Proof\n4. Give Feedback (Get Airtime)\n5. Help & Language`,
    sw: `CON Lugha imehifadhiwa.\n\nKaribu MediBridge\n1. Thibitisha Hali ya Afya\n2. Uthibitisho wa Dharura\n3. Fanya Upya Uthibitisho\n4. Toa Maoni (Pata Airtime)\n5. Msaada & Lugha`
  },
  // Prove Health Status menus
  proofType: {
    en: `CON Select proof to share:\n1. HIV Negative (last 90 days)\n2. Vaccination Proof\n3. Insurance/Subsidy Status\n4. Community Health Worker ID\n5. Back`,
    sw: `CON Chagua uthibitisho wa kushiriki:\n1. HIV Hasi (siku 90 za mwisho)\n2. Uthibitisho wa Chanjo\n3. Hali ya Bima/Msaada\n4. Kitambulisho cha Mfanyakazi wa Afya wa Jamii\n5. Rudi Nyuma`
  },
  recipient: {
    en: `CON Select recipient:\n1. Employer\n2. Partner\n3. Clinic\n4. NGO / Program\n5. Back`,
    sw: `CON Chagua mpokeaji:\n1. Mwajiri\n2. Mpenzi\n3. Kliniki\n4. NGO / Mpango\n5. Rudi Nyuma`
  },
  confirmShare: {
    en: `CON Confirm share? (No personal details are shared)\n1. Yes\n2. Cancel`,
    sw: `CON Thibitisha kushiriki? (Hakuna maelezo ya kibinafsi yanayoshirikiwa)\n1. Ndiyo\n2. Ghairi`
  },
  proofShared: {
    en: `END Success! Proof shared securely.\nYou've earned 10 KES airtime. Thank you.`,
    sw: `END Imefanikiwa! Uthibitisho umeshirikiwa kwa usalama.\nUmepata airtime ya KES 10. Asante.`
  },
  cancelled: {
    en: `END Cancelled.`,
    sw: `END Imekatwa.`
  },
  // Emergency Proof
  emergencySent: {
    en: `END Emergency proof sent.\nYour contact has been notified.\nYou'll be contacted shortly.`,
    sw: `END Uthibitisho wa dharura umetumwa.\nMtu wako ameonywa.\nUtawasiliana hivi karibuni.`
  },
  // Renew My Proof
  renewPrompt: {
    en: `CON Your last HIV proof expired on May 12.\nRenew now?\n1. Yes, I visited a clinic\n2. No, remind me later`,
    sw: `CON Uthibitisho wako wa mwisho wa HIV ulikoma Mei 12.\nFanya upya sasa?\n1. Ndiyo, nilitembelea kliniki\n2. Hapana, nikumbushe baadaye`
  },
  clinicCode: {
    en: `CON Enter 4-digit clinic code:`,
    sw: `CON Weka msimbo wa kliniki wa tarakimu 4:`
  },
  visitDate: {
    en: `CON Date of visit (DDMM):`,
    sw: `CON Tarehe ya ziara (DDMM):`
  },
  proofRenewed: {
    en: `END ZK Proof renewed!\nExpires in 90 days.`,
    sw: `END Uthibitisho wa ZK umefanywa upya!\nUtaisha kwa siku 90.`
  },
  remindLater: {
    en: `END We'll remind you later.`,
    sw: `END Tutakukumbusha baadaye.`
  },
  // Give Feedback
  satisfaction: {
    en: `CON Help us improve!\nHow satisfied are you with MediBridge?\n1. Very Satisfied\n2. Satisfied\n3. Neutral\n4. Unsatisfied`,
    sw: `CON Tusaidie kuboresha!\nUnafurahia MediBridge kiasi gani?\n1. Nimefurahia Sana\n2. Nimefurahia\n3. Sina Uamuzi\n4. Sijafurahia`
  },
  recommend: {
    en: `CON Would you recommend us to others?\n1. Yes\n2. No`,
    sw: `CON Ungependekeza kwetu kwa wengine?\n1. Ndiyo\n2. Hapana`
  },
  feedbackThanks: {
    en: `END Thank you!\nYou've earned 5 KES airtime.`,
    sw: `END Asante!\nUmepata airtime ya KES 5.`
  },
  invalidOption: {
    en: `END Invalid option.`,
    sw: `END Chaguo si sahihi.`
  }
};

export interface VoiceCallData {
  to: string;
  message: string;
  language?: 'swahili' | 'english' | 'hausa' | 'luganda';
}

export interface AirtimeData {
  to: string;
  amount: number; // Amount in KES
}

export interface USSDData {
  sessionId: string;
  phoneNumber: string;
  text: string;
  serviceCode: string;
}

export class AfricasTalkingService {
  private static instance: AfricasTalkingService;

  private constructor() {}

  static getInstance(): AfricasTalkingService {
    if (!AfricasTalkingService.instance) {
      AfricasTalkingService.instance = new AfricasTalkingService();
    }
    return AfricasTalkingService.instance;
  }

  /**
   * Make voice call using Africa's Talking Voice API
   */
  async makeVoiceCall(data: VoiceCallData): Promise<void> {
    if (!africasTalkingApiKey || !africasTalkingUsername) {
      throw new Error('Africa\'s Talking not configured');
    }

    const url = 'https://voice.africastalking.com/call';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': africasTalkingApiKey,
      },
      body: new URLSearchParams({
        username: africasTalkingUsername,
        to: data.to.replace('+', ''),
        from: 'ZKMedPass',
        // For TTS (Text-to-Speech)
        text: data.message,
        // For pre-recorded audio files
        // audioUrl: 'https://example.com/audio.mp3',
      }),
    });

    const result = await response.json();
    if (result.errorMessage) {
      throw new Error(`Voice API error: ${result.errorMessage}`);
    }
  }

  /**
   * Send airtime using Africa's Talking Airtime API
   */
  async sendAirtime(data: AirtimeData): Promise<void> {
    if (!africasTalkingApiKey || !africasTalkingUsername) {
      throw new Error('Africa\'s Talking not configured');
    }

    const url = 'https://payments.africastalking.com/mobile/airtime/send';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': africasTalkingApiKey,
      },
      body: new URLSearchParams({
        username: africasTalkingUsername,
        recipients: JSON.stringify([{
          phoneNumber: data.to.replace('+', ''),
          amount: data.amount.toString(),
          currencyCode: 'KES'
        }]),
      }),
    });

    const result = await response.json();
    if (result.errorMessage) {
      throw new Error(`Airtime API error: ${result.errorMessage}`);
    }
  }

  /**
   * Handle USSD session
   */
  async handleUSSD(data: USSDData): Promise<string> {
    const { sessionId, phoneNumber, text } = data;
    const input = text ? text.split('*') : [];
    const step = input.length;
    
    // Get or create session
    const session = await getOrCreateSession(sessionId, phoneNumber);
    if (!session) {
      return 'END Service temporarily unavailable. Please try again.';
    }
    
    const lang = (session.language as 'en' | 'sw') || 'en';

    // Main menu
    if (step === 0 || text === '') {
      return MENUS.main[lang];
    }

    // Main menu selection
    switch (input[0]) {
      case '1': // Prove Health Status
        if (step === 1) {
          return MENUS.proofType[lang];
        }
        if (step === 2) {
          if (input[1] === '5') { // Back
            return MENUS.main[lang];
          }
          return MENUS.recipient[lang];
        }
        if (step === 3) {
          if (input[2] === '5') { // Back
            return MENUS.proofType[lang];
          }
          return MENUS.confirmShare[lang];
        }
        if (step === 4) {
          if (input[3] === '1') { // Yes, share proof
            const proofTypes = ['HIV Negative', 'Vaccination', 'Insurance', 'Community Health Worker'];
            const recipients = ['Employer', 'Partner', 'Clinic', 'NGO'];
            
            const proofType = proofTypes[parseInt(input[1]) - 1];
            const recipient = recipients[parseInt(input[2]) - 1];
            
            const success = await shareHealthProof(sessionId, proofType, recipient, phoneNumber);
            if (success) {
              return MENUS.proofShared[lang];
            } else {
              return lang === 'en' 
                ? `END Sorry, unable to share proof. Please try again.`
                : `END Samahani, haiwezi kushiriki uthibitisho. Jaribu tena.`;
            }
          } else { // Cancel
            return MENUS.cancelled[lang];
          }
        }
        break;

      case '2': // Emergency Proof
        const emergencySuccess = await handleEmergencyProof(sessionId, phoneNumber);
        if (emergencySuccess) {
          return MENUS.emergencySent[lang];
        } else {
          return lang === 'en'
            ? `END Emergency service temporarily unavailable. Please contact support.`
            : `END Huduma ya dharura haipatikani kwa sasa. Wasiliana na msaada.`;
        }

      case '3': // My Proofs (NEW)
        // Step 1: Show list of recent visits (by date or type)
        if (step === 1) {
          // Fetch recent visits/codes for this phone number
          const visits = await getRecentVisitsByPhone(phoneNumber, 5); // returns [{date, code, summary}]
          if (!visits.length) {
            return lang === 'en'
              ? 'END No proofs found for your number.'
              : 'END Hakuna uthibitisho uliopatikana kwa nambari yako.';
          }
          let menu = lang === 'en' ? 'CON Your Recent Visits:\n' : 'CON Ziara Zako za Hivi Karibuni:\n';
          visits.forEach((v, i) => {
            menu += `${i + 1}. ${v.date} - ${v.summary}\n`;
          });
          menu += `${visits.length + 1}. Back`;
          return menu;
        }
        // Step 2: Show proofs for selected visit
        if (step === 2) {
          const visitIdx = parseInt(input[1], 10) - 1;
          const visits = await getRecentVisitsByPhone(phoneNumber, 5);
          if (visitIdx < 0 || visitIdx >= visits.length) {
            return MENUS.main[lang];
          }
          const visit = visits[visitIdx];
          let proofMenu = lang === 'en'
            ? `CON Proofs for visit on ${visit.date}:\n`
            : `CON Uthibitisho wa ziara tarehe ${visit.date}:\n`;
          visit.proofs.forEach((p, i) => {
            proofMenu += `- ${p.type}: ${p.statement}\n`;
          });
          proofMenu += `\nCode: ${visit.code}\n1. Resend Code via SMS\n2. Back`;
          return proofMenu;
        }
        // Step 3: Resend code or go back
        if (step === 3) {
          const visitIdx = parseInt(input[1], 10) - 1;
          const visits = await getRecentVisitsByPhone(phoneNumber, 5);
          if (visitIdx < 0 || visitIdx >= visits.length) {
            return MENUS.main[lang];
          }
          const visit = visits[visitIdx];
          if (input[2] === '1') {
            // Resend code via SMS
            await smsService.sendOTPSMS({
              to: phoneNumber,
              otpCode: `MediBridge: Your code for your visit on ${visit.date} is ${visit.code}. Use this code to share your medical proofs.`,
              expiresInMinutes: 43200
            });
            return lang === 'en'
              ? 'END Code resent via SMS.'
              : 'END Msimbo umetumwa tena kwa SMS.';
          } else {
            return MENUS.main[lang];
          }
        }
        break;

      case '4': // Give Feedback
        if (step === 1) {
          return MENUS.satisfaction[lang];
        }
        if (step === 2) {
          return MENUS.recommend[lang];
        }
        if (step === 3) {
          const satisfaction = input[1];
          const recommend = input[2];
          
          const feedbackSuccess = await handleFeedback(sessionId, phoneNumber, satisfaction, recommend);
          if (feedbackSuccess) {
            return MENUS.feedbackThanks[lang];
          } else {
            return lang === 'en'
              ? `END Thank you for feedback. Airtime will be sent shortly.`
              : `END Asante kwa maoni. Airtime itatumwa hivi karibuni.`;
          }
        }
        break;

      case '5': // Help & Language
        if (step === 1) {
          return MENUS.language[lang];
        }
        if (step === 2) {
          const newLang = input[1] === '2' ? 'sw' : 'en';
          await updateSessionLanguage(sessionId, newLang);
          return MENUS.languageSaved[newLang];
        }
        break;

      case '911': // Emergency shortcut
        const emergencyShortcutSuccess = await handleEmergencyProof(sessionId, phoneNumber);
        if (emergencyShortcutSuccess) {
          return MENUS.emergencySent[lang];
        } else {
          return lang === 'en'
            ? `END Emergency service temporarily unavailable. Please contact support.`
            : `END Huduma ya dharura haipatikani kwa sasa. Wasiliana na msaada.`;
        }

      default:
        return MENUS.invalidOption[lang];
    }
    // Fallback return to satisfy linter
    return MENUS.main[lang];
  }

  /**
   * Check if Africa's Talking is configured
   */
  isConfigured(): boolean {
    return !!(africasTalkingApiKey && africasTalkingUsername);
  }

  /**
   * Send SMS using Africa's Talking SMS API
   */
  async sendSMS(to: string, message: string, senderId?: string): Promise<void> {
    if (!africasTalkingApiKey || !africasTalkingUsername) {
      throw new Error("Africa's Talking not configured");
    }
    const url = 'https://api.africastalking.com/version1/messaging';
    const params: Record<string, string> = {
      username: africasTalkingUsername,
      to,
      message,
    };
    if (senderId) {
      params['from'] = senderId;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': africasTalkingApiKey,
      },
      body: new URLSearchParams(params),
    });
    const text = await response.text();
    try {
      // Try JSON first (for error cases)
      const result = JSON.parse(text);
      if (result.SMSMessageData?.Recipients?.length === 0) {
        throw new Error(`Africa's Talking SMS error: ${JSON.stringify(result)}`);
      }
      return;
    } catch (e) {
      // If not JSON, check for XML success
      if (text.includes('<status>Success</status>')) {
        // Success! Do not throw.
        return;
      }
      // Otherwise, log and throw the XML/text error
      console.error("Africa's Talking SMS API non-JSON response:", text);
      throw new Error("Africa's Talking SMS error: " + text);
    }
  }
}

export const africasTalkingService = AfricasTalkingService.getInstance();

// Backend integration functions
async function getOrCreateSession(sessionId: string, phoneNumber: string): Promise<any> {
  try {
    let session = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId)).limit(1);
    
    if (session.length === 0) {
      // Create new session
      const newSession = await db.insert(ussdSessions).values({
        sessionId,
        phoneNumber,
        language: 'en',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      }).returning();
      return newSession[0];
    }
    
    // Update last activity
    await db.update(ussdSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(ussdSessions.sessionId, sessionId));
    
    return session[0];
  } catch (error) {
    console.error('[USSD] Error managing session:', error);
    return null;
  }
}

async function updateSessionLanguage(sessionId: string, language: 'en' | 'sw'): Promise<void> {
  try {
    await db.update(ussdSessions)
      .set({ language, lastActivityAt: new Date() })
      .where(eq(ussdSessions.sessionId, sessionId));
  } catch (error) {
    console.error('[USSD] Error updating session language:', error);
  }
}

async function logUSSDEvent(sessionId: string, phoneNumber: string, eventType: string, eventData: any, success: boolean = true, errorMessage?: string): Promise<void> {
  try {
    const session = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId)).limit(1);
    const language = session.length > 0 ? session[0].language : 'en';
    
    await db.insert(ussdAnalytics).values({
      sessionId,
      phoneNumber,
      eventType,
      eventData,
      language,
      success,
      errorMessage,
    });
  } catch (error) {
    console.error('[USSD] Error logging analytics:', error);
  }
}

async function shareHealthProof(sessionId: string, proofType: string, recipient: string, phoneNumber: string): Promise<boolean> {
  try {
    console.log(`[USSD] Sharing ${proofType} proof to ${recipient} for ${phoneNumber}`);
    
    // TODO: Generate ZK proof based on proofType
    // const zkProof = await zkpService.generateProof(proofType, phoneNumber);
    
    // TODO: Send SMS/voice to recipient
    const recipientMessage = `MediBridge: Health verification received. Patient ${phoneNumber} has shared their ${proofType} proof.`;
    // await africasTalkingService.sendSMS(recipientPhone, recipientMessage);
    
    // TODO: Send airtime reward to user
    // await africasTalkingService.sendAirtime({ to: phoneNumber, amount: 10 });
    
    // Log to analytics
    await logUSSDEvent(sessionId, phoneNumber, 'PROOF_SHARED', { proofType, recipient });
    
    console.log(`[USSD] Successfully shared ${proofType} proof to ${recipient}`);
    return true;
  } catch (error) {
    console.error(`[USSD] Error sharing proof:`, error);
    await logUSSDEvent(sessionId, phoneNumber, 'PROOF_SHARED', { proofType, recipient }, false, (error as Error).message);
    return false;
  }
}

async function handleEmergencyProof(sessionId: string, phoneNumber: string): Promise<boolean> {
  try {
    console.log(`[USSD] Emergency proof requested for ${phoneNumber}`);
    
    // TODO: Get most recent valid proof
    // const recentProof = await zkpService.getMostRecentProof(phoneNumber);
    
    // TODO: Get emergency contacts
    // const emergencyContacts = await getEmergencyContacts(phoneNumber);
    
    // TODO: Send emergency notifications
    const emergencyMessage = "Mgonjwa huyu amethibitishwa. Anaweza kupokea huduma ya matibabu ya dharura.";
    // for (const contact of emergencyContacts) {
    //   await africasTalkingService.sendSMS(contact.phone, emergencyMessage);
    //   await africasTalkingService.makeVoiceCall({ to: contact.phone, message: emergencyMessage, language: 'swahili' });
    // }
    
    // Log emergency event
    await logUSSDEvent(sessionId, phoneNumber, 'EMERGENCY_PROOF', { contacts: 0 }); // TODO: actual contact count
    
    console.log(`[USSD] Emergency proof sent successfully`);
    return true;
  } catch (error) {
    console.error(`[USSD] Error handling emergency proof:`, error);
    await logUSSDEvent(sessionId, phoneNumber, 'EMERGENCY_PROOF', {}, false, (error as Error).message);
    return false;
  }
}

async function renewHealthProof(sessionId: string, phoneNumber: string, clinicCode: string, visitDate: string): Promise<boolean> {
  try {
    console.log(`[USSD] Renewing proof for ${phoneNumber} with clinic ${clinicCode} on ${visitDate}`);
    
    // Validate clinic code
    const clinic = await db.select().from(clinicCodes).where(eq(clinicCodes.clinicCode, clinicCode)).limit(1);
    if (clinic.length === 0 || !clinic[0].isActive) {
      throw new Error('Invalid clinic code');
    }
    
    // Validate visit date format (DDMM)
    if (!/^\d{4}$/.test(visitDate)) {
      throw new Error('Invalid date format. Use DDMM');
    }
    
    // TODO: Regenerate ZK proof
    // const newProof = await zkpService.renewProof(phoneNumber, clinicCode, visitDate);
    
    // TODO: Update proof expiry in database
    // await updateProofExpiry(phoneNumber, newProof.expiryDate);
    
    // Log renewal event
    await logUSSDEvent(sessionId, phoneNumber, 'PROOF_RENEWED', { clinicCode, visitDate, clinicName: clinic[0].clinicName });
    
    console.log(`[USSD] Proof renewed successfully for ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`[USSD] Error renewing proof:`, error);
    await logUSSDEvent(sessionId, phoneNumber, 'PROOF_RENEWED', { clinicCode, visitDate }, false, (error as Error).message);
    return false;
  }
}

async function handleFeedback(sessionId: string, phoneNumber: string, satisfaction: string, recommend: string): Promise<boolean> {
  try {
    console.log(`[USSD] Processing feedback from ${phoneNumber}: satisfaction=${satisfaction}, recommend=${recommend}`);
    
    // TODO: Store feedback anonymously (using existing feedback table)
    // await storeFeedback({
    //   phoneHash: hashPhone(phoneNumber), // Anonymous storage
    //   satisfaction: parseInt(satisfaction),
    //   recommend: recommend === '1',
    //   timestamp: new Date()
    // });
    
    // TODO: Send airtime reward
    // await africasTalkingService.sendAirtime({ to: phoneNumber, amount: 5 });
    
    // Log feedback event
    await logUSSDEvent(sessionId, phoneNumber, 'FEEDBACK_SUBMITTED', { satisfaction, recommend });
    
    console.log(`[USSD] Feedback processed successfully for ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`[USSD] Error processing feedback:`, error);
    await logUSSDEvent(sessionId, phoneNumber, 'FEEDBACK_SUBMITTED', { satisfaction, recommend }, false, (error as Error).message);
    return false;
  }
}

// Helper function to hash phone number for anonymous storage
function hashPhone(phoneNumber: string): string {
  // Simple hash for demo - use proper crypto in production
  return Buffer.from(phoneNumber).toString('base64').substring(0, 16);
}

// Helper: Fetch recent visits by phone number
async function getRecentVisitsByPhone(phoneNumber: string, limit: number) {
  // This should fetch from your real storage/db in production
  // For demo, use demoProofStore
  const visits = Object.entries(demoProofStore)
    .filter(([code, v]) => v && v.patientName && v.proofs && v.expiresAt && v.phoneNumber === phoneNumber)
    .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
    .slice(0, limit)
    .map(([code, v]) => ({
      code,
      date: new Date(v.expiresAt - 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      summary: v.proofs.map(p => p.type).join(', '),
      proofs: v.proofs
    }));
  return visits;
} 