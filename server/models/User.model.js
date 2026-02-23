import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    fullname: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['user', 'manager', 'admin', 'super_admin'],
      default: 'user',
    },
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    last_mail_sent: { type: Date, default: null },
    last_login:     { type: Date, default: null },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
