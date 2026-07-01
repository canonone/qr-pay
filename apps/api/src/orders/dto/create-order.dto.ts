import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNumber()
  @Min(1)
  amountExpected: number;

  @IsString()
  @IsNotEmpty()
  merchantRef: string;
}
