import { request, response } from "express";
import tryCatch from "../utils/tryCatch.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/errorhadler.js";
import bcrypt from "bcrypt";
import getBuffer from "../utils/buffer.js";
import axios from "axios";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
import { forgotPasswordTemplate } from "../template.js";
import { publishtopic } from "../producer.js";
import { redisclient } from "../index.js";
dotenv.config();

export const test = tryCatch(
  async (req: typeof request, res: typeof response, next: Function) => {
    try {
      res.send("server is running");
    } catch (error) {
      throw new ErrorHandler(500, "Somthing went wrong");
    }
  },
);

export const registerUser = tryCatch(
  async (req: typeof request, res: typeof response, next: Function) => {
    const { name, email, password, phone_number, role, bio } = req.body;
    if (!name || !email || !password || !phone_number || !role) {
      throw new ErrorHandler(400, "Missing required fields");
    }
    const existingUser = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      throw new ErrorHandler(409, "User with this email already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    let registeredUser;
    if (role === "jobrecruiter") {
      const [user] =
        await sql`INSERT INTO users (name,email,password,phone_number,role,bio) VALUES 
      (${name},${email},${hashedPassword},${phone_number},${role},${bio}) RETURNING 
      user_id,name,email,phone_number,role,bio`;
      registeredUser = user;
    } else if (role === "jobseeker") {
      const file = req.file;
      if (!file) {
        throw new ErrorHandler(400, "Missing required fields");
      }
      const filebuffer = getBuffer(file);
      if (!filebuffer || !filebuffer.content) {
        throw new ErrorHandler(400, "Missing required fields");
      }
      if (!process.env.UPLOAD_SERVICE_URL) {
        throw new ErrorHandler(500, "Upload service URL is not configured");
      }
      const { data } = await axios.post(
        `${process.env.UPLOAD_SERVICE_URL}/api/upload`,
        {
          buffer: filebuffer.content,
        },
      );
      const [user] =
        await sql`INSERT INTO users (name,email,password,phone_number,role,bio,resume,resume_public_id) VALUES 
      (${name},${email},${hashedPassword},${phone_number},${role},${bio},${data.url},${data.public_id}) RETURNING 
      user_id,name,email,phone_number,role`;
      registeredUser = user;
    } else {
      throw new ErrorHandler(400, "Invalid role");
    }

    const token = jwt.sign(
      { id: registeredUser.user_id },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" },
    );
    res
      .status(201)
      .json({ message: "User registered successfully", user: registeredUser, token });
  },
);

export const loginUser = tryCatch(
  async (req: typeof request, res: typeof response, next: Function) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ErrorHandler(400, "Missing required fields");
    }

    const user =
      await sql`SELECT u.user_id,u.name,u.email,u.password,u.phone_number,u.role,u.bio,u.resume,u.subscription_status AS subscription,
      ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) AS skills
      FROM users u
      LEFT JOIN user_skills us ON u.user_id = us.user_id
      LEFT JOIN skills s ON us.skill_id = s.skill_id
      WHERE u.email=${email} GROUP BY u.user_id; 
    `;

    if (user.length === 0) {
      throw new ErrorHandler(404, "User not found");
    }

    const userObject = user[0];
    const matchpassword = await bcrypt.compare(password, userObject.password);

    if (!matchpassword) {
      throw new ErrorHandler(401, "Invalid credentials");
    }

    userObject.skills = userObject.skills || [];

    delete userObject.password;

    const token = jwt.sign(
      { id: userObject.user_id },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" },
    );

    res
      .status(200)
      .json({
        message: "User logged in successfully",
        user: userObject,
        token,
      });
  },
);

export const forgotPassword = tryCatch(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    throw new ErrorHandler(400, "Email is required");
  }
  const users = await sql`
    SELECT user_id, email
    FROM users
    WHERE email = ${email}
  `;

  if (users.length === 0) {
    return res.json({
      message: "that not email exists, ",
    });
  }

  const user = users[0];

  const resetToken = jwt.sign(
    {
      email: user.email,
      type: "reset",
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "15m",
    },
  );
  const resetLink = `${process.env.FRONTEND_URL}/reset/${resetToken}`;
  await redisclient.set(`forgot:${email}`,resetToken,{
    EX:900,
  })
  const message = {
    to: user.email,
    subject: "Reset your Password - Job App",
    html: forgotPasswordTemplate(resetLink),
  };

  try {
    await publishtopic("send-mail", message);
  } catch (error) {
    console.log("Somthing went wrong");
  }
  return res.json({
    message: "If that email exists, we sent the reset link",
  });
});


export const resetpassword = tryCatch(async (req, res, next) => {
  const token = req.params.token as string;
  const { password } = req.body;

  if (!token) {
    throw new ErrorHandler(400, "Token is required");
  }

  if (!password) {
    throw new ErrorHandler(400, "Password is required");
  }

  let decoded: JwtPayload;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;
  } catch (error) {
    throw new ErrorHandler(400, "Expired or invalid token");
  }

  if (decoded.type !== "reset") {
    throw new ErrorHandler(400, "Invalid reset token");
  }

  const email = decoded.email;

  // Get token stored in Redis
  const storedtoken = await redisclient.get(`forgot:${email}`);

  // Token must exist and must match
  if (!storedtoken || storedtoken !== token) {
    throw new ErrorHandler(400, "Token has expired or is invalid");
  }

  // Find user
  const users = await sql`
    SELECT user_id
    FROM users
    WHERE email = ${email}
  `;

  if (users.length === 0) {
    throw new ErrorHandler(400, "User not found");
  }

  const user = users[0];

  // Hash new password
  const hashedpassword = await bcrypt.hash(password, 10);

  // Update password
  await sql`
    UPDATE users
    SET password = ${hashedpassword}
    WHERE user_id = ${user.user_id}
  `;

  // Delete reset token so it cannot be reused
  await redisclient.del(`forgot:${email}`);

  res.json({
    message: "Password changed successfully"
  });
});


export const forgetPassword = forgotPassword;
