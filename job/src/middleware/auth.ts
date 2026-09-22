import {  NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken';
import {sql} from "../utils/db.js"
import tryCatch from "../utils/tryCatch.js";
import ErrorHandler from "../utils/errorhadler.js";
import axios from "axios";
import dotenv from "dotenv";
import getBuffer from "../utils/buffer.js";

dotenv.config();
interface User {
    user_id: string;
    name: string;
    email: string;
    phone_number?: string;
    phone?: string;
    role: "jobseeker" | "jobrecruiter" | "jobrecuriter";
    bio: string | null;
    resume: string | null;
    resume_public_id: string | null;
    profile_pic: string | null;
    profile_pic_public_id: string | null;
    skills: string[];
    subscription_status: boolean;
}

export interface Authenticateduser extends Request{
    user?:User
}

export const isauth = async (
    req: Authenticateduser,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        // Check Authorization header
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            res.status(401).json({
                message: "Unauthorized"
            });
            return;
        }

        // Get token
        const token = authHeader.split(" ")[1];

        if (!token) {
            res.status(401).json({
                message: "Token is missing"
            });
            return;
        }

        // Verify JWT
        let decodedpayload: JwtPayload;

        try {
            decodedpayload = jwt.verify(
                token,
                process.env.JWT_SECRET as string
            ) as JwtPayload;
        } catch (error) {
            res.status(401).json({
                message: "Invalid or expired token"
            });
            return;
        }

        // Check user ID inside token
        if (!decodedpayload.id) {
            res.status(401).json({
                message: "Invalid token"    
            });
            return;
        }

        // Find user
        const users = await sql`
            SELECT
                u.user_id,
                u.name,
                u.email,
                u.phone_number,
                u.role,
                u.bio,
                u.resume,
                u.resume_public_id,
                u.profile_pic,
                u.profile_pic_public_id,
                u.subscription_status,
                ARRAY_AGG(s.name)
                    FILTER (WHERE s.name IS NOT NULL) AS skills 
            FROM users u
            LEFT JOIN user_skills us
                ON u.user_id = us.user_id
            LEFT JOIN skills s
                ON us.skill_id = s.skill_id
            WHERE u.user_id = ${decodedpayload.id}
            GROUP BY u.user_id
        `;

        // User doesn't exist anymore
        if (users.length === 0) {
            res.status(401).json({
                message: "User associated with this token no longer exists"
            });
            return;
        }

        // Attach user to request
        const user = users[0] as User;

        user.skills = user.skills || [];

        req.user = user;

        // Continue to controller
        next();

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Authentication error"
        });
    }
};


export const test=tryCatch(async(req,res,next)=>{
    res.json({
        message:"Working",
    })
})


export const getuserProfile=tryCatch(async(req,res,next)=>{
    const {userid}=req.params;


    const users=await sql`
            SELECT
                u.user_id,
                u.name,
                u.email,
                u.phone_number,
                u.role,
                u.bio,
                u.resume,
                u.resume_public_id,
                u.profile_pic,
                u.profile_pic_public_id,
                u.subscription_status,
                ARRAY_AGG(s.name)
                    FILTER (WHERE s.name IS NOT NULL) AS skills
            FROM users u
            LEFT JOIN user_skills us
                ON u.user_id = us.user_id
            LEFT JOIN skills s
              ON us.skill_id = s.skill_id
            WHERE u.user_id = ${userid}
            GROUP BY u.user_id
        `;


         if (users.length === 0) {
           throw new ErrorHandler(404,"User not found")
        }

        const user = users[0];
        user.skills = user.skills || [];

        res.json(user);
});


export const updateprofile = tryCatch(
    async (req: Authenticateduser, res: Response, next: NextFunction) => {
    const users = req.user;

    if (!users) {
        throw new ErrorHandler(401, "Authentication required");
    }
    const { name, phone_number, bio } = req.body;
    const newName = name || users.name;
    const newphone_number = phone_number || users.phone_number || users.phone;
    const newbio = bio !== undefined ? bio : users.bio; 

    const [updatedUser] = await sql`
    UPDATE users SET name =${newName}, phone_number=${newphone_number}, bio=${newbio}
    WHERE user_id=${users.user_id}
    RETURNING user_id, name, email, phone_number, bio 
    `;

    res.json({
        message: "Profile updated successfully",
        user: updatedUser,
    });
});

export const updateprofilepic=tryCatch(async(req:Authenticateduser,res:Response,next:NextFunction)=>{
            const user=req.user;

        if(!user){
            throw new ErrorHandler(401,"Authentication required");
        }
        const file=req.file;

        if(!file){
            throw new ErrorHandler(400,"no image found");
        }

        const oldpublicid=user.profile_pic_public_id;
        const filebuffer=getBuffer(file);
        if(!filebuffer || !filebuffer.content){
            throw new ErrorHandler(500,"failed to generate buffer");

        }
        if (!process.env.UPLOAD_SERVICE_URL) {
            throw new ErrorHandler(500, "Upload service URL is not configured");
        }
        const {data:uploadResult}=await axios.post(`${process.env.UPLOAD_SERVICE_URL}/api/upload`,{
            buffer: filebuffer.content,
            public_id:oldpublicid,
        })
        
        
        const [updateduser]=await sql`
        UPDATE users SET profile_pic =${uploadResult.url},profile_pic_public_id=${uploadResult.public_id}
        WHERE user_id =${user.user_id} RETURNING user_id,name,profile_pic
        `;

        res.json({
            message:"Pic updated sucessfully",
            updateduser
        })
    })


    export const updateresume=tryCatch(async(req:Authenticateduser,res:Response,next:NextFunction)=>{
            const user=req.user;

        if(!user){
            throw new ErrorHandler(401,"Authentication required");
        }
        const file=req.file;

        if(!file){
            throw new ErrorHandler(400,"no pdf found");
        }

        const oldpublicid=user.resume_public_id;
        const filebuffer=getBuffer(file);
        if(!filebuffer || !filebuffer.content){
            throw new ErrorHandler(500,"failed to generate buffer");

        }
        if (!process.env.UPLOAD_SERVICE_URL) {
            throw new ErrorHandler(500, "Upload service URL is not configured");
        }
        const {data:uploadResult}=await axios.post(`${process.env.UPLOAD_SERVICE_URL}/api/upload`,{
            buffer: filebuffer.content,
            public_id:oldpublicid,
        })
        
        
        const [updateduser] = await sql`
        UPDATE users SET resume =${uploadResult.url}, resume_public_id=${uploadResult.public_id}
        WHERE user_id =${user.user_id} RETURNING user_id, name, resume, resume_public_id
        `;

        res.json({
            message: "Resume updated successfully",
            user: updateduser,
        });
    });



export const addskill = tryCatch(
  async (req: Authenticateduser, res: Response, next: NextFunction) => {
    const userid = req.user?.user_id;
    const { skillname } = req.body;

    if (!skillname || typeof skillname !== "string" || skillname.trim() === "") {
      throw new ErrorHandler(400, "Please provide a skill name");
    }
    
    if (!userid) {
      throw new ErrorHandler(401, "Authentication required");
    }

    let skillAdded = false;
    try {
      await sql`BEGIN`;

      // Check user
      const users = await sql`
        SELECT user_id
        FROM users
        WHERE user_id = ${userid}
      `;

      if (users.length === 0) {
        throw new ErrorHandler(404, "User not found");
      }
      // Create skill if it doesn't exist
      // Otherwise get the existing skill
      const skills = await sql`
        INSERT INTO skills (name)
        VALUES (${skillname.trim()})
        ON CONFLICT (name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING skill_id
      `;

      const skillid = skills[0].skill_id;
      // Add skill to user
      const insertionResult = await sql`
        INSERT INTO user_skills (user_id, skill_id)
        VALUES (${userid}, ${skillid})
        ON CONFLICT (user_id, skill_id)
        DO NOTHING
        RETURNING user_id
      `;

      if (insertionResult.length > 0) {
        skillAdded = true;
      }

      await sql`COMMIT`;
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }

    if (!skillAdded) {
      return res.status(200).json({
        message: "User already possesses this skill",
      });
    }

    res.status(201).json({
      message: `Skill ${skillname.trim()} added successfully`,
    });
  }
);

export const skilldelete = tryCatch(
  async (req: Authenticateduser, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const { skillname } = req.body;

    if (
      !skillname ||
      typeof skillname !== "string" ||
      skillname.trim() === ""
    ) {
      throw new ErrorHandler(400, "Please provide a skill name");
    }

    const result = await sql`
      DELETE FROM user_skills
      WHERE user_id = ${user.user_id}
      AND skill_id = (
        SELECT skill_id
        FROM skills
        WHERE name = ${skillname.trim()}
      )
      RETURNING user_id
    `;

    if (result.length === 0) {
      throw new ErrorHandler(
        404,
        `Skill ${skillname.trim()} was not found`
      );
    }

    res.json({
      message: `Skill ${skillname.trim()} removed successfully`,
    });
  }
);

export const applyJob = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const user = req.user;

    // Authentication check
    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    // Only jobseekers can apply
    if (user.role !== "jobseeker") {
      throw new ErrorHandler(403, "Forbidden");
    }

    const application_id = user.user_id;
    const resume = user.resume;

    // Resume is required
    if (!resume) {
      throw new ErrorHandler(
        400,
        "You need to add a resume to apply for this job"
      );
    }

    const { job_id } = req.body;

    if (!job_id) {
      throw new ErrorHandler(400, "Job is required");
    }

    // Check whether job exists and is active
    const [job] = await sql`
      SELECT is_active
      FROM jobs
      WHERE job_id = ${job_id}
    `;

    if (!job) {
      throw new ErrorHandler(404, "No job found with this ID");
    }

    if (!job.is_active) {
      throw new ErrorHandler(400, "Job is not active");
    }

    // Check subscription
    const isSubscribed = user.subscription_status === true;

    let newApplication;

    try {
      [newApplication] = await sql`
        INSERT INTO applications (
          job_id,
          applicant_id,
          application_email,
          resume,
          subscription_status
        )
        VALUES (
          ${job_id},
          ${application_id},
          ${user.email},
          ${resume},
          ${isSubscribed}
        )
        RETURNING *
      `;
    } catch (error: any) {
      if (error.code === "23505") {
        throw new ErrorHandler(409, "You have already applied");
      }

      throw error;
    }

    res.status(201).json({
      message: "Applied successfully",
      application: newApplication,
    });
  }
);

export const getAllApplication = tryCatch(
  async (req: Authenticateduser, res: Response) => {
    const applications = await sql`
      SELECT
        a.*,
        j.title AS job_title,
        j.salary AS job_salary,
        j.location AS job_location
      FROM applications AS a
      JOIN jobs AS j
        ON a.job_id = j.job_id
      WHERE a.applicant_id = ${req.user?.user_id}
    `;

    res.status(200).json({
      applications,
    });
  }
);