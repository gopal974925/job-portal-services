import tryCatch from "../utils/tryCatch.js";
import { Authenticateduser } from "../middleware/auth.js";
import ErrorHandler from "../utils/errorhadler.js";
import { sql } from "../utils/db.js";
import { instance } from "../index.js";
import crypto from "crypto"
export const checkout=tryCatch(async(req:Authenticateduser,res)=>{
    if(!req.user){
        throw new ErrorHandler(401,"no vaild user");
    }
    const user_id=req.user.user_id;

    const [user]=await sql`SELECT * FROM users WHERE user_id=${user_id}`;


    const subTime=user?.subscription_status 
    ? new Date(user.subscription_status).getTime():
    0; 

    const now=Date.now();

    const isSubscribed=subTime>now;

    if(isSubscribed){throw new ErrorHandler(400,"You have an subscription")};


    const options={
        amount:Number(1*100),
        currency:"INR",
        notes:{
            user_id:user_id.toString(),
        }
    }

    const order=await instance.orders.create(options);

    res.status(201).json({
        order,
    })
}

)
 export const paymentverification=tryCatch(async(req:Authenticateduser,res)=>{

        const user=req.user;

        const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
        const body=razorpay_order_id + "|" + razorpay_payment_id;

        const expectedsignature=crypto.createHmac(
            "sha256",
            process.env.Razorpay_secret as string
        )
        .update(body)
        .digest("hex");

        const isAuthentic=expectedsignature === razorpay_signature;


        if(isAuthentic){
            const now =new Date();

            const thirtydays=30*24*60*60*1000;

            const expireydate=new Date(now.getTime()+thirtydays);

            const [updateduser]=await sql`UPDATE users SET subscription_status=${isAuthentic} WHERE
            user_id =${user?.user_id} RETURNING *`;



            res.json({
                message:"Subscription Puchease SucesFull",
                updateduser
            })

        }
        else{
            return res.status(400).json({
                    message:"Payment Failed"
            })
        }
    })