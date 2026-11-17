import { escapeRegex } from "../../lib/excapeRegex.js";
import Vendor from "../../models/vendor.js";
import VendorApplication from "../../models/vendorApplication.js";



class VendorRepository {
    static async vendorApplication(vendorData) {
        const vendorApplication = await VendorApplication.create(vendorData);
        return vendorApplication;
    }

    static async getAllVendorApplications(page, pageSize, filter = {}) {
        const query = {};

        // Only apply the search when q has actual text
        const q = typeof filter.q === "string" ? filter.q.trim() : "";
        if (q) {
            const regex = new RegExp(escapeRegex(q), "i");
            query.$or = [
                { businessName: regex },
                { businessAddress: regex },
                { phoneNumber: regex },
                { cacNumber: regex },
            ];
        }

        const [items, total] = await Promise.all([
            VendorApplication.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize),
            VendorApplication.countDocuments(query),
        ]);

        return { items, total };
    }

    static async getVendorApplicationByUserId(id) {
        return VendorApplication.findOne({ userId: id });
    }
    static async findApplicationById(id, { session } = {}) {
        return VendorApplication.findById(id).session(session ?? null);
    }

    // Only matches while the application is still pending, so two concurrent
    // reviews can't both succeed
    static async reviewApplication(id, update, { session } = {}) {
        return VendorApplication.findOneAndUpdate(
            { _id: id, status: "pending" },
            update,
            { returnDocument: "after", session }
        );
    }

    static async createVendor(vendorData, { session } = {}) {
        const [vendor] = await Vendor.create([vendorData], { session });
        return vendor;
    }

    static async vendorApplication(vendorData) {
        const vendorApplication = await VendorApplication.create(vendorData);
        return vendorApplication;
    }

    static async findVendorById(id) {
        const vendor = await Vendor.findById(id);
        return vendor;
    }

    static async findAllVendors(page, pageSize, filter = {}) {
        const query = {};

        // Only apply the search when q has actual text
        const q = typeof filter.q === "string" ? filter.q.trim() : "";
        if (q) {
            const regex = new RegExp(escapeRegex(q), "i");
            query.$or = [
                { businessName: regex },
                { businessAddress: regex },
                { phoneNumber: regex },
                { cacNumber: regex },
            ];
        }

        const [items, total] = await Promise.all([
            Vendor.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize),
            Vendor.countDocuments(query),
        ]);

        return { items, total };
    }

    static async findAndUpdateVendor(id, update, { session } = {}) {
        return Vendor.findByIdAndUpdate(id, update, {
            returnDocument: "after",
            session
        });
    }

    static async findVendorByUserId(userId) {
        return Vendor.findOne({ userId });
    }
}

export default VendorRepository;
