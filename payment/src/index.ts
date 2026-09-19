import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Razorpay from "razorpay";
import paymetroutes from "./routes/payment.js"
dotenv.config();

export const instance=new Razorpay({
    key_id:process.env.Razorpay_key,
    key_secret:process.env.Razorpay_secret,
})

const app=express();
app.use(cors());
app.use(express.json());
app.use("/api/payment",paymetroutes)

app.listen(process.env.PORT,()=>{
    console.log(` Payment Service running on ${process.env.PORT}`);
    
    
})