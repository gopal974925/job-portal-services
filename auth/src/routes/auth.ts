import express from "express";
import { loginUser, registerUser, test, forgotPassword, resetpassword } from "../controller/auth.js";
import upload from "../middleware/multer.js";

const router = express.Router();


router.get("/test", test);
router.post("/register", upload, registerUser);
router.post("/login", loginUser);
router.post(["/forgot", "/forgot-password"], forgotPassword);
router.post("/reset/:token", resetpassword);


export default router;