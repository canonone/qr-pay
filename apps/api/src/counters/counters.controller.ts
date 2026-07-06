import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CountersService } from './counters.service';
import { CreateCounterDto } from './dto/create-counter.dto';

@Controller('counters')
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Post()
  create(@Body() dto: CreateCounterDto) {
    return this.countersService.createCounter(dto);
  }

  @Get(':id/qr')
  getQR(@Param('id') id: string) {
    return this.countersService.getCounterQR(id);
  }

  @Post(':id/sessions')
  createSession(
    @Param('id') id: string,
    @Body() body: { amountExpected: number },
  ) {
    return this.countersService.createSessionForCounter(
      id,
      body.amountExpected,
    );
  }

  @Get(':id/session')
  resolveSession(@Param('id') id: string, @Query('code') code: string) {
    return this.countersService.resolvePaymentCode(id, code);
  }
}
