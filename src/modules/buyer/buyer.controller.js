import { sanitizeVendorApplication } from "../../lib/vendor.js";
import { getVendorApplicationByUserId, registerVendor } from "./buyer.service.js";

class BuyerController {
    static async registerVendor(req, res, next) {
        try {
            const vendorData = req.body;
            const userId = req.userId;
            const vendorApplication = await registerVendor({ ...vendorData, userId });
            res.status(201).json({
                success: true,
                message: "Vendor application submitted successfully",
                data: sanitizeVendorApplication(vendorApplication)
            });
        } catch (error) {
            next(error);
        }
    }
    static async getSingleVendorApplicationbyUserId(req, res, next) {
        const userId = req.userId
        try {
            const application = await getVendorApplicationByUserId(userId)
            res.status(200).json({
                success: true,
                message: "",
                data: application
            })
        } catch (error) {
            next(error)
        }
    }

}

export default BuyerController;
