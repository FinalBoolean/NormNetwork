import { Router } from "express";
import { placeholder } from "./placeholder.js";

// Accounts: sign up and log in. Tables: users
export const authRouter = Router();

authRouter.get("/login", placeholder("Log in", "Log in to Norm's Network.", ["users"]));
authRouter.get("/signup", placeholder("Sign up", "Create your Norm's Network account.", ["users"]));
