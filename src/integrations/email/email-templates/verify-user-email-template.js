export const verifyUserEmailTemplate = (name, verificationLink) => {
    return `
    <h1>Hello ${name}</h1>
    <p>Thank you for registering on ${process.env.APP_NAME}. Please click the link below to verify your email address:</p>
    <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">Verify Email</a>
    <p>If you did not request this verification, please ignore this email.</p>
    `;
}