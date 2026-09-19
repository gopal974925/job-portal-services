import express from "express";
import { isauth } from "../middleware/auth.js";
import { checkout,paymentverification } from "../controller/payment.js";

const router=express.Router();



router.post("/checkout",isauth,checkout);
router.post("/verify",isauth,paymentverification);

export  default router;