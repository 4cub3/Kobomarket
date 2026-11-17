import mongoose from "mongoose"
import { sanitizeVendorApplication, sanitizeVendor } from "../../lib/vendor.js"
import VendorRepository from "../vendor/vendor.repository.js"
import AppError from "../../shared/errors/appError.js"

const approveRejectVendorApplication = async (applicationId, reviewedBy, reason, action) => {
    if (!mongoose.isValidObjectId(applicationId)) {
        throw new AppError("Invalid application id", 400)
    }
    if (!action && !reason?.trim()) {
        throw new AppError("A reason is required when rejecting an application", 400)
    }

    const session = await mongoose.startSession()
    try {
        let application = null
        let vendor = null

        // The status update and vendor creation commit together or not at all
        await session.withTransaction(async () => {
            const existing = await VendorRepository.findApplicationById(applicationId, { session })
            if (!existing) {
                throw new AppError("Unable to find application with this id", 404)
            }
            if (existing.status !== "pending") {
                throw new AppError("This application has already been reviewed", 400)
            }

            application = await VendorRepository.reviewApplication(applicationId, {
                status: action ? "approved" : "rejected",
                rejectionReason: action ? null : reason.trim(),
                reviewedBy,
                reviewedAt: new Date(),
            }, { session })

            // Another admin reviewed it between the check and the update
            if (!application) {
                throw new AppError("This application has already been reviewed", 409)
            }

            if (action) {
                vendor = await VendorRepository.createVendor({
                    userId: application.userId,
                    applicationId: application._id,
                    storeName: application.businessName,
                    address: application.businessAddress,
                    businessType: application.businessType,
                    cacNumber: application.cacNumber,
                    phoneNumber: application.phoneNumber,
                }, { session })
            }
        })

        return {
            application: sanitizeVendorApplication(application),
            vendor,
        }
    } finally {
        await session.endSession()
    }
}

const getAllVendorApplications = async (page, pageSize, filter = {}) => {
    const { items, total } = await VendorRepository.getAllVendorApplications(page, pageSize, filter)
    return {
        items: items.map(sanitizeVendorApplication),
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
    }
}

const getAllVendorsService = async (page, pageSize, filter = {}) => {
    const { items, total } = await VendorRepository.findAllVendors(page, pageSize, filter)
    return {
        items: items.map(sanitizeVendor),
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
    }
}

export {
    approveRejectVendorApplication,
    getAllVendorApplications,
    getAllVendorsService
}
