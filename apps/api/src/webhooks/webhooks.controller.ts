import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { NombaWebhookPayload, WebhooksService } from './webhooks.service';

type RawBodyRequest = Request<
  Record<string, string>,
  unknown,
  NombaWebhookPayload
> & { rawBody: Buffer };

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  async handleNombaWebhook(
    @Req() req: RawBodyRequest,
    @Headers('nomba-signature') signature: string,
    @Headers('nomba-timestamp') timestamp: string,
  ) {
    try {
      await this.webhooksService.processNombaWebhook(
        req.rawBody,
        signature,
        timestamp,
        req.body,
      );
    } catch (err) {
      this.logger.error('Error processing Nomba webhook', err);
    }

    return { received: true };
  }
}
