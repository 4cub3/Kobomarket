import "./config/env.js";
import app from "./app.js";
import connectDB from "./database/mongo/connection.js";

const port = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch((err) => {
    console.error("Failed to connect to the database", err);
    process.exit(1);
})