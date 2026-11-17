export const sanitizeVendorApplication = (vendor) => {
    return {
        id: vendor._id,
        userId: vendor.userId,
        businessName: vendor.name,
        businessType: vendor.businessType,
        phoneNumber: vendor.phoneNumber,
        businessAddress: vendor.businessAddress,
        status: vendor.status,
        reviewedBy: vendor.reviewedBy,
        reviewedAt: vendor.reviewedAt,
        rejectionReason: vendor.rejectionReason,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
        cacNumber: vendor.cacNumber

    }
}

export const sanitizeVendor = (vendor) => {
    return {
        id: vendor._id,
        userId: vendor.userId,
        businessName: vendor.name,
        businessType: vendor.businessType,
        phoneNumber: vendor.phoneNumber,
        businessAddress: vendor.businessAddress,
        status: vendor.status,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
        cacNumber: vendor.cacNumber
    }
}

