import z from "zod";
const productSchema = z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    slug: z.string().optional(),
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    price: z.number().min(0, "Price must be a positive number"),
    quantity: z.number().int().min(0, "Quantity must be a non-negative integer"),
    category: z.string().optional(),
    vendorId: z.string().min(1, "Vendor ID is required"),
    images: z.array(z.string()).optional(),
});