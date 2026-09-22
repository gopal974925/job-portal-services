import app from './app.js';
import dotenv from 'dotenv';
import router from './routes/auth.js';
import authroutes from './routes/auth.js';
import {sql} from "./utils/db.js"
import upload from './middleware/multer.js';
import { connnectKafka } from './producer.js';
import {createClient} from "redis";


dotenv.config();


export  const redisclient=createClient({
  url:process.env.REDIS_URL,
  pingInterval:30_000,
  socket:{
    connectTimeout:10_000,
  }
})
redisclient.on("error", (err) => console.error("Redis error:", err));
redisclient.on("reconnecting", () => console.warn("Redis reconnecting..."));
redisclient.on("ready", () => console.log("Redis is connected successfully"));

redisclient.connect()
.then(()=>{
  console.log("Redis is connected successfully");
  
})
.catch(console.error)

async function initDB() {
  try {
    // Create enum type if it doesn't exist
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'user_role'
        ) THEN
          CREATE TYPE user_role AS ENUM ('jobseeker', 'jobrecruiter');
        END IF;
      END
      $$;
    `;

    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        role user_role NOT NULL,
        bio TEXT,
        resume VARCHAR(255),
        resume_public_id VARCHAR(255),
        profile_pic VARCHAR(255),
        profile_pic_public_id VARCHAR(255),
        subscription_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Skills table
    await sql`
      CREATE TABLE IF NOT EXISTS skills (
        skill_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
    `;

    // User-skills junction table
    await sql`
      CREATE TABLE IF NOT EXISTS user_skills (
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, skill_id)
      );
    `;

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}



connnectKafka();

app.use('/api/auth', router);

initDB();

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://13.200.217.93:${process.env.PORT}`);
});








