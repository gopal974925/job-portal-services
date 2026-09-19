import express from 'express';
import dotenv from 'dotenv';
import router from './routes.js';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import { startSendMailConsumer } from './consumer.js';
import { GoogleGenAI } from '@google/genai';
const app = express();
dotenv.config();


   cloudinary.config({ 
        cloud_name: process.env.cloud_name, 
        api_key: process.env.api_key, 
        api_secret: process.env.api_secret 
    });

export const ai = new GoogleGenAI({
    apiKey: process.env['GEMINI_API_KEY'],
});

app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

startSendMailConsumer();
app.use('/api', router);


app.listen(process.env.PORT, () => {
  console.log('utils service  is ruuning on  http://13.200.217.93:' + process.env.PORT);
}
)