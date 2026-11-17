export const resetPasswordEmailTemplate = (name, link) => {
    return `
    <h1>Reset Your Password</h1>
    <p>Hello ${name},</p>
    <p>Click the link below to reset your password:</p>
    <a href="${link}">Reset Password</a>
    <p>If you did not request a password reset, please ignore this email.</p>
    <p>Thank you,</p>
    <p>The ${process.env.APP_NAME} Team</p>
    `;
}