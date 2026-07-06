import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  counterName: string;

  @IsString()
  @IsOptional()
  merchantLabel: string;
}
