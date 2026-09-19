import { Authenticateduser } from "../middleware/auth.js";
import tryCatch from "../utils/tryCatch.js";

export const myProfie=tryCatch(async(req:Authenticateduser,res,next)=>{
    const user=req.user;
    res.json(user)
})