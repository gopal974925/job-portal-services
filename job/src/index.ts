import app from "./app.js"
import dotenv from"dotenv"
import {sql} from "./utils/db.js"
import { connnectKafka } from "./utils/producer.js";
import client from "prom-client";
import responsetime from "response-time"
dotenv.config();

const collectDefaultmetrix=client.collectDefaultMetrics;
collectDefaultmetrix({register:client.register})

const reqResTime=new client.Histogram({
  name:"http_express_req_res_time",
  help:"This tells how much time is taken by req and res",
  labelNames:["method","route","status_code"],
  buckets:[1,50,100,200,400,500,80,1000,2000,3000]
})

app.use(responsetime((req, res, time) => {
    reqResTime.labels({
      method:req.method,
      route:req.url,
      status_code:res.statusCode,
    }).observe(time);
}))

app.get("/metrics",async (req,res)=>{
  res.setHeader("content-Type",client.register.contentType);
  const metrics=await client.register.metrics();
  res.send(metrics);
})

async function initDB() {
  try {
    // Create enum types
    await sql`
      DO $$
      BEGIN

        -- Job type
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'job_type'
        ) THEN
          CREATE TYPE job_type AS ENUM (
            'full-time',
            'part-time',
            'contract',
            'internship'
          );
        END IF;

        -- Work location
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'work_location'
        ) THEN
          CREATE TYPE work_location AS ENUM (
            'on-site',
            'remote',
            'hybrid'
          );
        END IF;

        -- Application status
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'application_status'
        ) THEN
          CREATE TYPE application_status AS ENUM (
            'submitted',
            'rejected',
            'hired'
          );
        END IF;

      END
      $$;
    `;

    // Companies table
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        company_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        website VARCHAR(255) NOT NULL,
        logo VARCHAR(255) NOT NULL,
        logo_public_id VARCHAR(255) NOT NULL,
        recruiter_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Jobs table
    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        job_id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        salary NUMERIC(10,2),
        location VARCHAR(255),
        job_type job_type NOT NULL,
        openings INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        work_location work_location NOT NULL,
        company_id INTEGER NOT NULL
          REFERENCES companies(company_id)
          ON DELETE CASCADE,
        posted_by_recruiter_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
    `;

    // Applications table
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        application_id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL
          REFERENCES jobs(job_id)
          ON DELETE CASCADE,
        applicant_id INTEGER NOT NULL,
        application_email VARCHAR(255),
        status application_status NOT NULL DEFAULT 'submitted',
        resume VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        subscription_status BOOLEAN DEFAULT FALSE,
        UNIQUE (job_id, applicant_id)
      );
    `;

    console.log("Job service DB initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}
connnectKafka()
initDB()

  app.listen(process.env.PORT,()=>{
    console.log(`Job service ruuning on http://13.200.217.93:${process.env.PORT}`);
    
})




