import VendorRepository from './vendor.repository.js';
import mongoose from 'mongoose';
import AppError from '../../shared/errors/appError.js';
import { sanitizeVendor } from '../../lib/vendor.js';

const getVendorById = async (vendorId) => {
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
        throw new AppError('Invalid vendor ID', 400);
    }
    const vendor = await VendorRepository.findVendorById(vendorId);
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }
    return sanitizeVendor(vendor);
}

const getVendorByUserIdService = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid user ID', 400);
    }
    const vendor = await VendorRepository.findVendorByUserId(userId);
    if (!vendor) {
        throw new AppError('Vendor not found', 404);
    }
    return sanitizeVendor(vendor);
}

export {
    getVendorById,
    getVendorByUserIdService
}

