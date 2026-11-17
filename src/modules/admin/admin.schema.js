import z from "zod"
const approveRejectVendorApplicationSchema = z.object({
    action: z.boolean("Action is required"),
    reason: z.string().optional()
})
export {
    approveRejectVendorApplicationSchema
}