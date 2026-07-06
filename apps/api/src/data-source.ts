import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { Transaction } from './entities/transaction.entity';
import { Counter } from './entities/counter.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Order, Transaction, Counter],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
