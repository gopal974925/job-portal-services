import express from "express";
import dotenv from "dotenv";
import userroutes from "./routes/user.js";
import cors from "cors";
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/user", userroutes);



app.listen(process.env.PORT, () => {
  console.log(`User service running on http://13.200.217.93:${process.env.PORT}`);
});