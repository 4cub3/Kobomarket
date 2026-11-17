import User from "../../models/user.js";

class UserRepository {
    static async createUser(userData, { session } = {}) {
        // Mongoose requires the array form when passing options
        const [user] = await User.create([userData], { session });
        return user;
    }

    static async findUserByEmail(email, { session } = {}) {
        return await User.findOne({ email }).session(session ?? null);
    }

    static async findUserById(id) {
        return await User.findById(id);
    }

    static async updateUser(id, userData) {
        return await User.findByIdAndUpdate(id, userData, { returnDocument: "after" });
    }
}

export default UserRepository;
