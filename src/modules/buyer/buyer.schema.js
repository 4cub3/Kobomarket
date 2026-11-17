import z from "zod";

export const vendorApplicationSchema = z.object({
    businessName: z.string().nonempty("Business name is required"),
    businessType: z.enum(["individual", "registered_business"], {
        errorMap: () => ({ message: "Business type must be either 'individual' or 'registered_business'" }),
    }),
    cacNumber: z.string().optional(),
    businessAddress: z.string().nonempty("Business address is required"),
    phoneNumber: z.string().nonempty("Phone number is required"),
});
