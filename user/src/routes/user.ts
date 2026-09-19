import express, { Router } from "express";
import { myProfie } from "../controller/user.js";
import { test,getuserProfile, isauth,updateprofile, updateprofilepic, updateresume, addskill, skilldelete, applyJob, getAllApplication } from "../middleware/auth.js";
import  upload from "../middleware/multer.js";

const router=express.Router();
router.get("/",test)
router.get("/me",isauth,myProfie)
router.get("/getallapplication",isauth,getAllApplication)
router.get("/:userid",isauth,getuserProfile)
router.put("/update/profile",isauth,updateprofile)
router.put("/update/picupdate",isauth,upload,updateprofilepic)
router.put("/update/resumeupdate",isauth,upload,updateresume)
router.post("/skill/add",isauth,addskill)
router.delete("/skill/delete",isauth,skilldelete)
router.post('/apply/job',isauth,applyJob)
export default router;