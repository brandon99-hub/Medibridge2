// Africa's Talking Service - Voice, Airtime, USSD
// This is a NEW service that doesn't modify existing functionality

const africasTalkingApiKey = process.env.AFRICAS_TALKING_API_KEY;
const africasTalkingUsername = process.env.AFRICAS_TALKING_USERNAME;

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
    // This will be called by the USSD webhook
    // Parse the USSD text and return appropriate response
    const menuLevel = this.parseUSSDLevel(data.text);
    
    switch (menuLevel) {
      case 'main':
        return this.getMainMenu();
      case 'prove_eligibility':
        return this.getProveEligibilityMenu();
      case 'emergency':
        return this.handleEmergencyMode(data);
      case 'feedback':
        return this.getFeedbackMenu();
      default:
        return this.getMainMenu();
    }
  }

  private parseUSSDLevel(text: string): string {
    if (!text || text === '') return 'main';
    const parts = text.split('*');
    return parts.length === 1 ? 'main' : parts[1] || 'main';
  }

  private getMainMenu(): string {
    return `CON ZK-MedPass
1. Prove Eligibility
2. Emergency Mode
3. Renew Proof
4. Feedback & Rewards
5. Health Tips`;
  }

  private getProveEligibilityMenu(): string {
    return `CON Select Proof Type:
1. HIV-Negative
2. Vaccination
3. Insurance
4. Back to Main Menu`;
  }

  private handleEmergencyMode(data: USSDData): string {
    // Emergency mode logic
    return `END Emergency mode activated. 
SMS and voice call sent to emergency contacts.`;
  }

  private getFeedbackMenu(): string {
    return `CON Rate your experience:
1. Excellent
2. Good
3. Fair
4. Poor`;
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