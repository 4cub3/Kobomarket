import transporter from "./email.config.js";
import AppError from "../../shared/errors/appError.js";
const sendEmailService = async (email, subject, text, html) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject,
            text,
            html,
        };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        throw new AppError("Failed to send email", 500, error.message);
    } finally {
         transporter.close();
    }
}


export default sendEmailService;