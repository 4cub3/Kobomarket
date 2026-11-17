import { getVendorById, getVendorByUserIdService } from "./vendor.service.js";

class VendorController {
    static async vendorById(req, res, next) {
        const vendorId = req.params.vendorId;
        try {
            const vendor = await getVendorById(vendorId);
            res.status(200).json({
                success: true,
                message: "Vendor retrieved successfully",
                data: vendor
            });
        } catch (error) {
            next(error);
        }
    }

    static async vendorByUserId(req, res, next) {
        const userId = req.params.userId;
        try {
            const vendor = await getVendorByUserIdService(userId);
            res.status(200).json({
                success: true,
                message: "Vendor retrieved successfully",
                data: vendor
            });
        } catch (error) {
            next(error);
        }
    }
}

export default VendorController;