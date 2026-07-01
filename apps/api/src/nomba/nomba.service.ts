import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class NombaService {
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
    const expiresInSeconds = data.data.expiresIn;

    this.tokenCache = {
      token,
      expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
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
}
