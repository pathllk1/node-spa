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
    
    // Security tracking fields
    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    account_locked_until: {
      type: Date,
      default: null,
    },
    login_history: [
      {
        ip_address: String,
        device_id: String,
        timestamp: { type: Date, default: Date.now },
        user_agent: String,
      }
    ],
    device_fingerprints: [
      {
        device_id: String,
        fingerprint: String,
        is_trusted: { type: Boolean, default: false },
        added_at: { type: Date, default: Date.now },
        last_used_at: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
