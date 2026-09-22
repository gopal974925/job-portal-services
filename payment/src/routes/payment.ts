import express from "express";
import { isauth } from "../middleware/auth.js";
import { checkout,paymentverification } from "../controller/payment.js";

const router=express.Router();


router.get("/test-payment",(req,res)=> {
  res.json({
        message:"Working",
    })
  }, );

router.post("/checkout",isauth,checkout);
router.post("/verify",isauth,paymentverification);

export  default router;