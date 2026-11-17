export const sanitizeUser = (user) => {
    return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        phoneNumber:user.countryCode + user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
    };
}