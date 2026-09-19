import  express  from "express";
import { isauth } from "../middleware/auth.js";
import upload from "../middleware/multer.js";
import { createcompany,
    createjob,deletecompany,
     getallactivejobs, 
     getallcompany
     , getcompanydetails
     , getsinglejob,
      updatejob ,
      getapplicationforjob,
      updateapplication
    } from "../controller/job.js";

const router=express.Router();

router.post("/company/new",isauth,upload,createcompany)
router.delete("/company/:companyid",isauth,deletecompany)
router.post("/new",isauth,createjob)
router.put("/:job_id",isauth,updatejob)
router.get("/company/all",isauth,getallcompany)
router.get("/company/:id",getcompanydetails)
router.get("/all",getallactivejobs)
router.get("/:job_id",getsinglejob)
router.get("/application/:job_id",isauth,getapplicationforjob)
router.put("/application/update/:id",isauth,updateapplication)

export default router;