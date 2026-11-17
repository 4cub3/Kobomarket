import AppError from "../../shared/errors/appError.js";
import VendorRepository from "../vendor/vendor.repository.js";
import UserRepository from "../user/user.repository.js";
import { sanitizeVendorApplication } from "../../lib/vendor.js";

const registerVendor = async (vendorData) => {
    try {
        const user = await UserRepository.findUserById(vendorData.userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        const existingApplication = await VendorRepository.getVendorApplicationByUserId(vendorData.userId);
        if (existingApplication) {
            throw new AppError("User already has a vendor application", 400)
        }
        const vendorApplication = await VendorRepository.vendorApplication(vendorData);
        if(!vendorApplication){
            throw new AppError("Unable to create application", 400)
        }
        return vendorApplication;
    } catch (error) {
        throw error;
    }
}

const getVendorApplicationByUserId = async (userId) => {
    try {
        if (!userId) {
            throw new AppError("User id is required", 400)
        }
        const vendorApplication = await VendorRepository.getVendorApplicationByUserId(userId);
        if (!vendorApplication) {
            throw new AppError("Unable to find application with this user id", 404)
        }
        return sanitizeVendorApplication(vendorApplication)
    } catch (error) {
        throw error
    }
}

export {
    registerVendor,
    getVendorApplicationByUserId
}
