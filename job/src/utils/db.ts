import { neon,neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from "ws";
neonConfig.webSocketConstructor = ws; 

dotenv.config();

export const sql= neon(process.env.DB_URL as string);



