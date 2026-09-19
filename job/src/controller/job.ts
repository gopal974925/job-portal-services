import { NextFunction } from "express";
import tryCatch from "../utils/tryCatch.js";
import { Authenticateduser } from "../middleware/auth.js";
import ErrorHandler from "../utils/errorhadler.js";
import { sql } from "../utils/db.js";
import { Response } from "express";
import getBuffer from "../utils/buffer.js";
import axios from "axios"
import { loadEnvFile, threadCpuUsage } from "process";
import { applicationStatusUpdateTemplate } from "../template.js";
import { publishtopic } from "../utils/producer.js";
import { error, log } from "console";

export const createcompany = tryCatch(
  async (
    req: Authenticateduser,
    res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    // Check authentication
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Check recruiter role
    if (user.role !== "jobrecruiter") {
      throw new ErrorHandler(403, "Forbidden");
    }

    // Get body data
    const { name, description, website } = req.body;

    // Validate fields
    if (!name || !description || !website) {
      throw new ErrorHandler(400, "All fields are required");
    }

    // Check whether company already exists
    const existingCompany = await sql`
      SELECT company_id
      FROM companies
      WHERE name = ${name}
    `;

    if (existingCompany.length > 0) {
      throw new ErrorHandler(
        409,
        "This company already exists"
      );
    }

    // Get logo
    const file = req.file;

    if (!file) {
      throw new ErrorHandler(400, "Company logo is required");
    }

    // Convert file to buffer
    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      throw new ErrorHandler(
        500,
        "Failed to create file buffer"
      );
    }

    // Upload logo
    const { data } = await axios.post(
      `${process.env.UPLOAD_SERVICE_URL}/api/upload`,
      {
        buffer: fileBuffer.content,
      }
    );

    // Create company
    const [newCompany] = await sql`
      INSERT INTO companies (
        name,
        description,
        website,
        logo,
        logo_public_id,
        recruiter_id
      )
      VALUES (
        ${name},
        ${description},
        ${website},
        ${data.url},
        ${data.public_id},
        ${user.user_id}
      )
      RETURNING *
    `;

    return res.status(201).json({
      message: "Company created successfully",
      newCompany,
    });
  }
);
export const deletecompany=tryCatch(async(req:Authenticateduser,res:Response)=>{

    const user=req.user;

    const {companyid}=req.params;

    const [company]= await sql`
    SELECT logo_public_id  FROM companies WHERE company_id=${companyid}
    AND recruiter_id=${user?.user_id}   
    `
if(!company){
    throw new ErrorHandler(404,"Company not found or unatharized ")
}

    await sql`
    DELETE FROM companies WHERE company_id=${companyid}

    `

    res.json({
        message:"Company and comanies associated jobs have deleted"
    })

})

export const createjob = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const user = req.user;

    // Authentication
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Recruiter authorization
    if (user.role !== "jobrecruiter") {
      throw new ErrorHandler(403, "Forbidden");
    }

    const {
      title,
      description,
      salary,
      job_type,
      openings,
      role,
      company_id,
      work_location,
    } = req.body;

    // Required fields
    if (
      !title ||
      !description ||
      !job_type ||
      !openings ||
      !role ||
      !company_id ||
      !work_location
    ) {
      throw new ErrorHandler(400, "All fields are required");
    }

    // Check that the company belongs to this recruiter
    const [company] = await sql`
      SELECT company_id
      FROM companies
      WHERE company_id = ${company_id}
        AND recruiter_id = ${user.user_id}
    `;

    if (!company) {
      throw new ErrorHandler(
        404,
        "Company not found or unauthorized"
      );
    }

    // Create job
    const [newjob] = await sql`
      INSERT INTO jobs (
        title,
        description,
        salary,
        role,
        job_type,
        work_location,
        company_id,
        posted_by_recruiter_id,
        openings
      )
      VALUES (
        ${title},
        ${description},
        ${salary || null},
        ${role},
        ${job_type},
        ${work_location},
        ${company_id},
        ${user.user_id},
        ${openings}
      )
      RETURNING *
    `;

    return res.status(201).json({
      message: "Job created successfully",
      newjob,
    });
  }
);


export const updatejob = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const user = req.user;

    // Authentication
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Recruiter authorization
    if (user.role !== "jobrecruiter") {
      throw new ErrorHandler(403, "Forbidden");
    }

    const jobId = req.params.job_id;

    if (!jobId) {
      throw new ErrorHandler(400, "Job ID is required");
    }

    const {
      title,
      description,
      salary,
      job_type,
      openings,
      role,
      work_location,
      is_active,
    } = req.body;

    // Find job and check ownership
    const [existingJob] = await sql`
      SELECT posted_by_recruiter_id
      FROM jobs
      WHERE job_id = ${jobId}
    `;

    if (!existingJob) {
      throw new ErrorHandler(404, "Job not found");
    }

    // Check if recruiter owns this job
    if (existingJob.posted_by_recruiter_id !== user.user_id) {
      throw new ErrorHandler(
        403,
        "You are not allowed to update this job"
      );
    }

    // Update job
    const [updatedJob] = await sql`
      UPDATE jobs
      SET
        title = ${title},
        description = ${description},
        salary = ${salary},
        job_type = ${job_type},
        role = ${role},
        work_location = ${work_location},
        openings = ${openings},
        is_active = ${is_active}
      WHERE job_id = ${jobId}
      RETURNING *
    `;

    res.status(200).json({
      message: "Job updated successfully",      
      job: updatedJob,
    });
  }
);


export const getallcompany = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const companies = await sql`
      SELECT *
      FROM companies
      WHERE recruiter_id = ${req.user?.user_id}
    `;

    res.status(200).json({
      companies,
    });
  }
);

export const getcompanydetails = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ErrorHandler(400, "Company not found");
    }

    const [company] = await sql`
      SELECT 
        c.*,
        COALESCE(
          (
            SELECT json_agg(j.*)
            FROM jobs j
            WHERE j.company_id = c.company_id
          ),
          '[]'::json
        ) AS jobs
      FROM companies c
      WHERE c.company_id = ${id}
    `;

    if (!company) {
      throw new ErrorHandler(404, "Company not found");
    }

    res.status(200).json(company);
  }
);

export const getallactivejobs = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const { title, location } = req.query as {
      title?: string;
      location?: string;
    };

    let queryString = `
      SELECT
        j.job_id,
        j.title,
        j.description,
        j.salary,
        j.location,
        j.job_type,
        j.role,
        j.work_location,
        j.openings,
        j.created_at,
        c.name AS company_name,
        c.logo AS company_logo,
        c.company_id AS company_id
      FROM jobs j
      JOIN companies c
        ON j.company_id = c.company_id
      WHERE j.is_active = true
    `;

    const values: string[] = [];
    let paramIndex = 1;

    if (title) {
      queryString += ` AND j.title ILIKE $${paramIndex}`;
      values.push(`%${title}%`);
      paramIndex++;
    }

    if (location) {
      queryString += ` AND j.location ILIKE $${paramIndex}`;
      values.push(`%${location}%`);
      paramIndex++;
    }

    queryString += ` ORDER BY j.created_at DESC`;

    const jobs = await sql.query(queryString, values);

    res.status(200).json({
      jobs,
    });
  }
);

export const getsinglejob=tryCatch(async(req:Authenticateduser,res:Response)=>{
  const [job]=await sql`
    SELECT 
      j.*,
      c.name AS company_name,
      c.logo AS company_logo,
      c.website AS company_website,
      c.description AS company_description
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.company_id
    WHERE j.job_id = ${req.params.job_id};
  `;

  if (!job) {
    throw new ErrorHandler(404, "Job not found");
  }

  res.json(job)
})


export const getapplicationforjob = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const user = req.user;

    // Authentication
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Recruiter authorization
    if (user.role !== "jobrecruiter") {
      throw new ErrorHandler(403, "Forbidden");
    }

    const { job_id } = req.params;

    if (!job_id) {
      throw new ErrorHandler(400, "Job ID is required");
    }

    // Check job exists and get its recruiter
    const [job] = await sql`
      SELECT posted_by_recruiter_id
      FROM jobs
      WHERE job_id = ${job_id}
    `;

    if (!job) {
      throw new ErrorHandler(404, "Job not found");
    }

    // Make sure this recruiter owns the job
    if (job.posted_by_recruiter_id !== user.user_id) {
      throw new ErrorHandler(403, "Forbidden");
    }

    // Get applications for this job
    const applications = await sql`
      SELECT *
      FROM applications
      WHERE job_id = ${job_id}
      ORDER BY subscription_status DESC, applied_at DESC
    `;

    res.status(200).json({
      applications,
    });
  }
);

export const updateapplication=tryCatch(async(req:Authenticateduser,res:Response)=>{
       const user = req.user;

    // Authentication
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Recruiter authorization
    if (user.role !== "jobrecruiter") {
      throw new ErrorHandler(403, "Forbidden");
    }
    const {id}=req.params;
    const [application]=await sql`SELECT *  FROM applications WHERE application_id=${id} `;

    if(!application){
      throw new ErrorHandler(404,"applidation not found")
    }

    const [job]=await sql`
    SELECT posted_by_recruiter_id , title FROM jobs WHERE job_id=${application.job_id}
    `

    if(!job){
      throw new ErrorHandler(404,"job not found in this id")
    }

    if(job.posted_by_recruiter_id!== user.user_id){
      throw new ErrorHandler(403,"forbidden");
    }

    const [updatedapplication]=await sql`
    UPDATE applications SET status =${req.body.status} WHERE 
    application_id =${id} RETURNING *
    `

    const message={
      to:application.application_email,
      subject:"application update job_portal ",
      html:applicationStatusUpdateTemplate(job.title)
    }
    publishtopic('send-mail',message).catch(error=>{
      console.log("Failed to publish message to kafka",error);
      
    })


    res.json({
      message:"application updated",
      job,
      updatedapplication
    })
})