import z from "zod";
const loginSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});
const passwordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters long").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
    confirmPassword: z.string(),
});
const registerSchema = z.object({
    email: z.email("Invalid email address"),
    ...passwordSchema.shape,
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    countryCode: z.string().min(1, "Country code is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
});

const verifyEmailSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

const changePasswordSchema = z.object({
    password:z.string().min(1, "Password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
});

const resetPasswordWithTokenSchema = z.object({
    email: z.email("Invalid email address"),
    ...passwordSchema.shape,
    token: z.string().min(1, "Token is required"),
}).refine(data => data.password.password === data.password.confirmPassword, {
    message: "Passwords do not match",
});
const forgotPasswordSchema = z.object({
    email: z.email("Invalid email address"),
});
export { registerSchema, verifyEmailSchema, loginSchema,changePasswordSchema,resetPasswordWithTokenSchema,forgotPasswordSchema };