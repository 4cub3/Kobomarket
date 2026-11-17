import {
    approveRejectVendorApplication as approveRejectVendorApplicationService,
    getAllVendorApplications as getAllVendorApplicationsService,
    getAllVendorsService,
} from "./admin.service.js";

class AdminController {

    static async approveRejectVendorApplication(req, res, next) {
        const { applicationId } = req.params;
        const { action, reason } = req.body;
        const reviewedBy = req.userId;
        try {
            const result = await approveRejectVendorApplicationService(applicationId, reviewedBy, reason, action);
            res.status(200).json({
                success: true,
                message: `Vendor application ${action ? "approved" : "rejected"} successfully`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAllVendorApplications(req, res, next) {
        try {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 10, 1), 100);
            const q = typeof req.query.q === "string" ? req.query.q : "";

            const result = await getAllVendorApplicationsService(page, pageSize, { q });
            res.status(200).json({
                success: true,
                message: "Vendor applications retrieved successfully",
                data: result.items,
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    }

      static async getAllVendor(req, res, next) {
        try {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 10, 1), 100);
            const q = typeof req.query.q === "string" ? req.query.q : "";

            const result = await getAllVendorsService(page, pageSize, { q });
            res.status(200).json({
                success: true,
                message: "Vendors retrieved successfully",
                data: result.items,
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    }
}

export default AdminController