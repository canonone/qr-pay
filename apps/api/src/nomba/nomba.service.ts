import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface TransferToBankParams {
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  merchantTxRef: string;
  senderName: string;
  narration: string;
}

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private tokenCache: TokenCache | null = null;

  constructor(private readonly config: ConfigService) {}

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const { data } = await axios.post(
      'https://sandbox.nomba.com/v1/auth/token/issue',
      {
        grant_type: 'client_credentials',
        client_id: this.config.get('NOMBA_CLIENT_ID'),
        client_secret: this.config.get('NOMBA_CLIENT_SECRET'),
      },
      {
        headers: {
          accountId: this.config.get('NOMBA_PARENT_ACCOUNT_ID'),
        },
      },
    );

    const token = data.data.access_token;
    const expiresAt = new Date(data.data.expiresAt).getTime();

    this.tokenCache = {
      token,
      expiresAt: expiresAt - 60 * 1000,
    };

    return token;
  }

  async provisionVirtualAccount(accountRef: string, accountName: string) {
    const token = await this.getAccessToken();
    const subAccountId = this.config.get('NOMBA_SUB_ACCOUNT_ID');

    const { data } = await axios.post(
      `https://sandbox.nomba.com/v1/accounts/virtual/${subAccountId}`,
      { accountRef, accountName },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          accountId: this.config.get('NOMBA_PARENT_ACCOUNT_ID'),
        },
      },
    );

    return data.data;
  }

  async transferToBank(params: TransferToBankParams): Promise<void> {
    try {
      const token = await this.getAccessToken();

      const { data } = await axios.post<unknown>(
        'https://sandbox.nomba.com/v1/transfers/bank',
        params,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accountId: this.config.get('NOMBA_PARENT_ACCOUNT_ID'),
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Nomba bank transfer response: ${JSON.stringify(data)}`);
    } catch (err) {
      this.logger.error('Nomba bank transfer failed', err);
    }
  }
}
